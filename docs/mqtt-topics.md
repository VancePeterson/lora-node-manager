# MQTT Topics

This document describes the MQTT topic structure used by the ESP32 gateway and consumed by the LoRa Node Manager.

## Topic Prefix

All topics use a configurable prefix (default: `lora`). Examples below use this default.

## Address-Based Topics

Topics use the **node's LoRa address** (integer) as the identifier. This keeps the gateway simple and allows display names to be changed without affecting MQTT routing.

## Topic Structure

Each node has two topics:

```
lora/
├── {address}/
│   ├── state           # Telemetry + gateway metadata (retained)
│   └── debug           # Commands and responses (not retained)
└── gateway/
    └── state           # Gateway health (retained)
```

That's it. Simple.

## Node Topics

### `lora/{address}/state`

All telemetry from the node, enriched with gateway metadata (RSSI, SNR).

**Direction:** Node → Gateway → MQTT
**Retained:** Yes
**QoS:** 0

The gateway merges its observed signal metrics into the node's JSON payload:

```json
{
  "temperature": 22.5,
  "humidity": 65.0,
  "seq": 42,
  "rssi": -72,
  "snr": 8.5
}
```

| Field | Source | Description |
|-------|--------|-------------|
| `temperature`, `humidity`, etc. | Node | Telemetry from node firmware |
| `seq` | Node | Sequence number for gap detection |
| `rssi` | Gateway | Signal strength (dBm) observed by gateway |
| `snr` | Gateway | Signal-to-noise ratio (dB) observed by gateway |

### `lora/{address}/debug`

Bidirectional command/response channel, like a serial terminal.

**Direction:** Bidirectional (Manager ↔ Gateway ↔ Node)
**Retained:** No
**QoS:** 0

**Sending a command:**
```
Topic: lora/5/debug
Payload: PING
```

**Receiving response:**
```
Topic: lora/5/debug
Payload: {"ack": "PING", "result": "PONG", "rssi": -70, "snr": 9.0}
```

The gateway adds RSSI/SNR to responses too.

**Built-in commands:**

| Command | Response |
|---------|----------|
| `PING` | `{"ack": "PING", "result": "PONG"}` |
| `STATUS` | `{"ack": "STATUS", "uptime": 3600, "address": 5}` |
| `CONFIG?` | `{"type": "config", "address": 5, "fields": [...]}` |
| `SETTINGS?` | `{"type": "settings", "telemetry_interval": 60000, ...}` |
| `REBOOT` | Node restarts |
| `SLEEP` | Node enters deep sleep immediately |
| `DEFAULTS` | Resets settings to defaults |

**JSON commands for remote configuration:**

```json
{"cmd": "SET", "telemetry_interval": 300000}
{"cmd": "SET", "deep_sleep": true, "sleep_duration": 600000}
{"cmd": "SET", "tx_power": 15}
```

Settings are persisted to flash.

## Gateway Topics

### `lora/gateway/state`

Gateway health and status.

**Retained:** Yes

```json
{
  "online": true,
  "ip": "192.168.1.100",
  "uptime": 86400
}
```

## Home Assistant Discovery

When a node responds to `CONFIG?`, the gateway publishes MQTT discovery messages:

```
homeassistant/sensor/lora_5_temperature/config
homeassistant/sensor/lora_5_humidity/config
homeassistant/sensor/lora_5_rssi/config
```

HA automatically creates entities grouped under "LoRa Node 5".

## RSSI Reference

| Range | Quality |
|-------|---------|
| -30 to -50 dBm | Excellent |
| -50 to -70 dBm | Good |
| -70 to -90 dBm | Fair |
| Below -90 dBm | Weak |

## SNR Reference

| Range | Quality |
|-------|---------|
| > 7 dB | Excellent |
| 0 to 7 dB | Good |
| -7 to 0 dB | Fair |
| < -7 dB | Poor |

## Testing

### Subscribe to All Topics

```bash
mosquitto_sub -h <broker> -t 'lora/#' -v
```

### Simulate Node Telemetry

```bash
# Pretend to be the gateway publishing for node 5
mosquitto_pub -h <broker> -t 'lora/5/state' -r \
  -m '{"temperature": 22.5, "humidity": 65, "seq": 1, "rssi": -72, "snr": 8.5}'
```

### Send Command

```bash
# Send PING to node 5
mosquitto_pub -h <broker> -t 'lora/5/debug' -m 'PING'

# Watch for response
mosquitto_sub -h <broker> -t 'lora/5/debug' -v
```

### Via API

```bash
curl -X POST http://localhost:8080/api/nodes/5/command \
  -H "Content-Type: application/json" \
  -d '{"command": "CONFIG?"}'
```
