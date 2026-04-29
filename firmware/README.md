# LoRa Firmware

PlatformIO projects for the ESP32 gateway and LoRa nodes.

## Structure

```
firmware/
├── gateway/          # ESP32 MQTT gateway (RYLR998 ↔ MQTT bridge)
├── nodes/            # Generic node template
│   └── lib/          # Reusable libraries
└── shared/           # Protocol definitions
```

## Gateway

The gateway bridges LoRa (RYLR998) to MQTT. It:
- Receives LoRa packets and publishes to `lora/{address}/*` topics
- Subscribes to `lora/+/command` and forwards commands to nodes

### Build & Upload

```bash
cd firmware/gateway

# Edit include/config.h with your WiFi and MQTT settings
pio run -t upload
pio device monitor
```

### Configuration

Edit `include/config.h`:
```cpp
#define WIFI_SSID "your-ssid"
#define WIFI_PASSWORD "your-password"
#define MQTT_HOST "192.168.0.13"
```

## Nodes

Generic node template. Each node is a blank slate - customize `src/main.cpp` for your specific use case.

### Build & Upload

```bash
cd firmware/nodes

# Build with default address (5)
pio run -t upload

# Build with custom address
pio run -t upload --build-flag="-DLORA_ADDRESS=10"
```

### Customizing a Node

Edit `src/main.cpp` and modify these sections:

**1. Add your telemetry in `sendTelemetry()`:**
```cpp
void sendTelemetry() {
    JsonDocument doc;
    doc["seq"] = sequenceNumber++;
    doc["temperature"] = readTemperature();
    doc["humidity"] = readHumidity();
    // ...
}
```

**2. Add custom commands in `handleCommand()`:**
```cpp
if (command == "ON") {
    digitalWrite(RELAY_PIN, HIGH);
    response["relay"] = true;
}
```

**3. Initialize hardware in `setupNode()`:**
```cpp
void setupNode() {
    pinMode(RELAY_PIN, OUTPUT);
    dht.begin();
}
```

### Setting Node Address

Option 1: Build flag (recommended for flashing multiple nodes):
```bash
pio run -t upload --build-flag="-DLORA_ADDRESS=10"
```

Option 2: Edit `include/config.h`:
```cpp
#define LORA_ADDRESS 5
```

## Wiring

### ESP32 to RYLR998

| ESP32 | RYLR998 |
|-------|---------|
| GPIO16 (RX2) | TX |
| GPIO17 (TX2) | RX |
| 3.3V | VDD |
| GND | GND |

## MQTT Topics

The gateway publishes/subscribes to address-based topics:

```
lora/{address}/state     # Node telemetry (JSON)
lora/{address}/online    # "online" or "offline"
lora/{address}/rssi      # Signal strength (dBm)
lora/{address}/snr       # Signal-to-noise ratio (dB)
lora/{address}/command   # Commands to node (subscribed by gateway)
lora/gateway/status      # Gateway health
```

## Built-in Commands

All nodes respond to these commands:

| Command | Response |
|---------|----------|
| `PING` | `{"ack": "PING", "result": "PONG"}` |
| `STATUS` | `{"ack": "STATUS", "uptime": 3600, "address": 5, "heap": 200000}` |
| `REBOOT` | Restarts the node |

Add your own commands in `handleCommand()`.

## Telemetry Format

Nodes send JSON payloads. The only required field is `seq` (sequence number for gap detection):

```json
{
  "seq": 42,
  "temperature": 22.5,
  "humidity": 45.0,
  "your_field": "your_value"
}
```

The manager auto-discovers nodes when they first transmit.
