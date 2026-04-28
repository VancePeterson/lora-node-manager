# MQTT Topics

This document describes the MQTT topic structure used by the ESP32 gateway and consumed by the LoRa Node Manager.

## Topic Prefix

All topics use a configurable prefix (default: `lora`). Examples below use this default.

## Topic Structure

```
lora/
├── {node_name}/
│   ├── state           # Decoded telemetry (JSON)
│   ├── online          # Online status
│   ├── rssi            # Signal strength
│   ├── snr             # Signal-to-noise ratio
│   ├── last_seen       # Unix timestamp
│   └── gap_count       # Missed sequence numbers
└── gateway/
    └── status          # Gateway health
```

## Node Topics

### `lora/{node_name}/state`

Decoded telemetry from the node. Content varies by node type.

**Retained:** Yes
**QoS:** 0

**Example (sensor node):**
```json
{
  "temperature": 23.5,
  "humidity": 45.2,
  "battery_voltage": 3.7,
  "seq": 142
}
```

**Example (relay node):**
```json
{
  "relay_state": true,
  "current_draw": 0.5,
  "seq": 87
}
```

### `lora/{node_name}/online`

Node online/offline status based on heartbeat timeout.

**Retained:** Yes
**QoS:** 1

**Payload:** `online` or `offline`

### `lora/{node_name}/rssi`

Received Signal Strength Indicator of last received packet.

**Retained:** Yes
**QoS:** 0

**Payload:** Integer (dBm), e.g., `-85`

Typical ranges:
- `-30 to -50`: Excellent
- `-50 to -70`: Good
- `-70 to -90`: Fair
- `-90 to -120`: Poor

### `lora/{node_name}/snr`

Signal-to-Noise Ratio of last received packet.

**Retained:** Yes
**QoS:** 0

**Payload:** Float (dB), e.g., `9.5`

Typical ranges:
- `> 7`: Excellent
- `0 to 7`: Good
- `-7 to 0`: Fair
- `< -7`: Poor

### `lora/{node_name}/last_seen`

Unix timestamp of last received packet.

**Retained:** Yes
**QoS:** 0

**Payload:** Integer (Unix epoch seconds), e.g., `1714300000`

### `lora/{node_name}/gap_count`

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

## Command Topics (Future)

Reserved for sending commands to nodes via the gateway:

### `lora/{node_name}/command`

**Direction:** Manager → Gateway → Node

**Payload:**
```json
{
  "action": "set_relay",
  "params": {
    "state": true
  }
}
```

### `lora/{node_name}/command/result`

**Direction:** Node → Gateway → Manager

**Payload:**
```json
{
  "success": true,
  "action": "set_relay",
  "error": null
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
+RCV=2,8,01420A1E00FF00FF,-75,8
```

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
lora/+/state
lora/+/online
lora/+/rssi
lora/+/snr
lora/+/last_seen
lora/+/gap_count
lora/gateway/status
```

Using `+` wildcard to match all node names.

## Publishing

The manager may publish to (future):

```
lora/{node_name}/command
lora/gateway/command
```

## Testing

### Subscribe to All Topics

```bash
mosquitto_sub -h <broker> -t 'lora/#' -v
```

### Simulate Node Telemetry

```bash
mosquitto_pub -h <broker> -t 'lora/test_node/state' -r -m '{"temperature": 22.5, "humidity": 50.0, "seq": 1}'
mosquitto_pub -h <broker> -t 'lora/test_node/online' -r -m 'online'
mosquitto_pub -h <broker> -t 'lora/test_node/rssi' -r -m '-72'
mosquitto_pub -h <broker> -t 'lora/test_node/snr' -r -m '8.5'
```

---

**Note:** This document should be updated as the gateway firmware evolves. The actual topic structure and payload formats depend on the ESP32 gateway implementation.
