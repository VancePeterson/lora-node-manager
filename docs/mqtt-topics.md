# MQTT Topics

This document describes the MQTT topic structure used by the ESP32 gateway and consumed by the LoRa Node Manager.

## Topic Prefix

All topics use a configurable prefix (default: `lora`). Examples below use this default.

## Address-Based Topics

Topics use the **node's LoRa address** (integer) as the identifier, not names. This design:

- Keeps the gateway "dumb" - it just forwards packets without needing configuration
- Allows display names to be changed without affecting MQTT routing
- Uses the same address configured on the RYLR998 module

| Node Address | Display Name | MQTT Topics |
|--------------|--------------|-------------|
| 5 | Chicken Coop | `lora/5/*` |
| 12 | Kitchen Sensor | `lora/12/*` |
| 100 | Garage Door | `lora/100/*` |

## Topic Structure

```
lora/
├── {address}/
│   ├── state           # Decoded telemetry (JSON)
│   ├── online          # Online status
│   ├── rssi            # Signal strength
│   ├── snr             # Signal-to-noise ratio
│   ├── command         # Commands TO the node
│   ├── last_seen       # Unix timestamp
│   └── gap_count       # Missed sequence numbers
└── gateway/
    └── status          # Gateway health
```

## Node Topics

### `lora/{address}/state`

Decoded telemetry from the node. Content varies by node type.

**Retained:** Yes
**QoS:** 0

**Example (sensor node at address 5):**
```json
{
  "temperature": 23.5,
  "humidity": 45.2,
  "battery_voltage": 3.7,
  "seq": 142
}
```

**Example (relay node at address 12):**
```json
{
  "relay_state": true,
  "current_draw": 0.5,
  "seq": 87
}
```

### `lora/{address}/online`

Node online/offline status based on heartbeat timeout.

**Retained:** Yes
**QoS:** 1

**Payload:** `online` or `offline`

### `lora/{address}/rssi`

Received Signal Strength Indicator of last received packet.

**Retained:** Yes
**QoS:** 0

**Payload:** Integer (dBm), e.g., `-85`

Typical ranges:
- `-30 to -50`: Excellent
- `-50 to -70`: Good
- `-70 to -90`: Fair
- `-90 to -120`: Poor

### `lora/{address}/snr`

Signal-to-Noise Ratio of last received packet.

**Retained:** Yes
**QoS:** 0

**Payload:** Float (dB), e.g., `9.5`

Typical ranges:
- `> 7`: Excellent
- `0 to 7`: Good
- `-7 to 0`: Fair
- `< -7`: Poor

### `lora/{address}/command`

Commands sent from the manager to the node via the gateway.

**Direction:** Manager → Gateway → Node
**Retained:** No
**QoS:** 0

**Payload:** Plain text command string

**Examples:**
```
PING
STATUS
REBOOT
CONFIG?
```

The manager publishes commands via `POST /api/nodes/{address}/command` which sends to this topic.

### `lora/{address}/last_seen`

Unix timestamp of last received packet.

**Retained:** Yes
**QoS:** 0

**Payload:** Integer (Unix epoch seconds), e.g., `1714300000`

### `lora/{address}/gap_count`

Count of missed sequence numbers (packet loss indicator).

**Retained:** Yes
**QoS:** 0

**Payload:** Integer, e.g., `3`

Increments when received `seq` skips expected value. Resets on gateway restart.

## Gateway Topics

### `lora/gateway/status`

Gateway health and status information.

**Retained:** Yes
**QoS:** 1

**Payload:**
```json
{
  "online": true,
  "uptime_seconds": 86400,
  "mqtt_connected": true,
  "rylr_connected": true,
  "firmware_version": "1.2.0",
  "nodes_seen": 5,
  "packets_rx_total": 12543,
  "packets_tx_total": 234
}
```

## LoRa Frame Format

The ESP32 gateway receives raw LoRa frames and decodes them to MQTT.

### AT Interface Format

RYLR998 modules use hex-encoded payloads:

```
+RCV=<address>,<length>,<hex_data>,<rssi>,<snr>
```

Example:
```
+RCV=5,8,01420A1E00FF00FF,-75,8
```

The address in `+RCV` becomes the topic path (e.g., address `5` → `lora/5/state`).

### Frame Structure

```
┌──────────┬──────────┬─────────────────────────────┐
│ msg_type │   seq    │      payload (varies)       │
│  1 byte  │  1 byte  │      per node type          │
└──────────┴──────────┴─────────────────────────────┘
```

| Byte | Field | Description |
|------|-------|-------------|
| 0 | `msg_type` | Message type identifier |
| 1 | `seq` | Sequence number (0-255, wraps) |
| 2+ | `payload` | Type-specific packed struct |

### Message Types

| Type | Name | Description |
|------|------|-------------|
| `0x01` | TELEMETRY | Periodic sensor readings |
| `0x02` | HEARTBEAT | Keep-alive (minimal payload) |
| `0x03` | COMMAND_ACK | Response to command |
| `0x04` | ALERT | Threshold exceeded |

*(Document actual message types based on your firmware)*

## Subscribing

The LoRa Node Manager subscribes to:

```
lora/#
```

This captures all topics under the prefix.

## Publishing

The manager publishes to:

```
lora/{address}/command    # Send commands to specific node
```

Commands are sent via the API endpoint `POST /api/nodes/{address}/command` with body:
```json
{
  "command": "PING"
}
```

## Testing

### Subscribe to All Topics

```bash
mosquitto_sub -h <broker> -t 'lora/#' -v
```

### Simulate Node Telemetry

```bash
# Node at address 5 (e.g., Chicken Coop)
mosquitto_pub -h <broker> -t 'lora/5/state' -r -m '{"temperature": 22.5, "humidity": 50.0, "seq": 1}'
mosquitto_pub -h <broker> -t 'lora/5/online' -r -m 'online'
mosquitto_pub -h <broker> -t 'lora/5/rssi' -r -m '-72'
mosquitto_pub -h <broker> -t 'lora/5/snr' -r -m '8.5'

# Node at address 12 (e.g., Kitchen Sensor)
mosquitto_pub -h <broker> -t 'lora/12/state' -r -m '{"temperature": 20.0, "humidity": 45.0}'
mosquitto_pub -h <broker> -t 'lora/12/online' -r -m 'online'
```

### Test Command Sending

```bash
# Listen for commands
mosquitto_sub -h <broker> -t 'lora/+/command' -v

# In another terminal, send command via API
curl -X POST http://localhost:8080/api/nodes/5/command \
  -H "Content-Type: application/json" \
  -d '{"command": "PING"}'
```

---

**Note:** This document should be updated as the gateway firmware evolves. The actual topic structure and payload formats depend on the ESP32 gateway implementation.
