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
- Receives LoRa packets and publishes to `lora/{address}/state` (with RSSI/SNR)
- Subscribes to `lora/+/debug` and forwards commands to nodes
- Publishes command responses to `lora/{address}/debug`

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

Each node has two topics:

```
lora/{address}/state     # Telemetry + RSSI/SNR (retained)
lora/{address}/debug     # Commands and responses (bidirectional)
lora/gateway/state       # Gateway health
```

The gateway enriches telemetry with signal metrics:

```json
{"temperature": 22.5, "humidity": 65, "seq": 42, "rssi": -72, "snr": 8.5}
```

The `debug` topic works like a serial terminal - publish a command, receive the response on the same topic.

## Built-in Commands

All nodes respond to these commands:

| Command | Response |
|---------|----------|
| `PING` | `{"ack": "PING", "result": "PONG"}` |
| `STATUS` | `{"ack": "STATUS", "uptime": 3600, "address": 5, "heap": 200000}` |
| `CONFIG?` | Returns field configuration for HA discovery |
| `SETTINGS?` | Returns current node settings |
| `REBOOT` | Restarts the node |
| `SLEEP` | Immediately enters deep sleep |
| `DEFAULTS` | Resets all settings to defaults |

Add your own commands in `handleCommand()`.

## Remote Configuration

Node settings can be updated remotely via JSON commands on the debug topic.

### Get current settings

```bash
mosquitto_pub -h <broker> -t 'lora/5/debug' -m 'SETTINGS?'
```

Response:
```json
{
  "type": "settings",
  "address": 5,
  "telemetry_interval": 60000,
  "heartbeat_interval": 30000,
  "deep_sleep": false,
  "sleep_duration": 60000,
  "tx_power": 22
}
```

### Update settings

Send a JSON object with `cmd: "SET"` and the settings to change:

```bash
# Set telemetry interval to 5 minutes
mosquitto_pub -h <broker> -t 'lora/5/debug' -m \
  '{"cmd": "SET", "telemetry_interval": 300000}'

# Enable deep sleep with 10 minute duration
mosquitto_pub -h <broker> -t 'lora/5/debug' -m \
  '{"cmd": "SET", "deep_sleep": true, "sleep_duration": 600000}'

# Reduce TX power to save battery (0-22, default 22)
mosquitto_pub -h <broker> -t 'lora/5/debug' -m \
  '{"cmd": "SET", "tx_power": 15}'

# Multiple settings at once
mosquitto_pub -h <broker> -t 'lora/5/debug' -m \
  '{"cmd": "SET", "telemetry_interval": 300000, "deep_sleep": true, "sleep_duration": 300000}'
```

### Available settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `telemetry_interval` | uint32 | 60000 | Telemetry send interval (ms) |
| `heartbeat_interval` | uint32 | 30000 | Heartbeat interval (ms) - not used in deep sleep mode |
| `deep_sleep` | bool | false | Enable deep sleep between telemetry |
| `sleep_duration` | uint32 | 60000 | Deep sleep duration (ms) |
| `tx_power` | uint8 | 22 | RYLR998 TX power (0-22 dBm) |

Settings are persisted to flash and survive reboots.

### Deep sleep behavior

When `deep_sleep` is enabled:
1. Node wakes from deep sleep
2. Sends telemetry
3. Immediately goes back to sleep for `sleep_duration`

The `telemetry_interval` is ignored in deep sleep mode - the node sleeps for exactly `sleep_duration` between transmissions.

To wake a sleeping node, you must wait for it to wake up on its own schedule (or physically reset it).

## Home Assistant Auto-Discovery

Nodes self-describe their telemetry fields via the `CONFIG?` command. The gateway uses this to register entities with Home Assistant automatically.

### 1. Define fields in your node

Edit `sendConfig()` in `nodes/src/main.cpp`:

```cpp
void sendConfig() {
    JsonDocument doc;
    doc["type"] = "config";
    doc["address"] = LORA_ADDRESS;

    JsonArray fields = doc["fields"].to<JsonArray>();

    // Temperature sensor
    JsonObject temp = fields.add<JsonObject>();
    temp["name"] = "temperature";
    temp["class"] = "temperature";  // HA device_class
    temp["unit"] = "°C";

    // Humidity sensor
    JsonObject hum = fields.add<JsonObject>();
    hum["name"] = "humidity";
    hum["class"] = "humidity";
    hum["unit"] = "%";

    // Battery voltage (no device_class needed)
    JsonObject batt = fields.add<JsonObject>();
    batt["name"] = "battery";
    batt["class"] = "voltage";
    batt["unit"] = "V";

    String payload;
    serializeJson(doc, payload);
    sendLoRa(GATEWAY_ADDRESS, payload);
}
```

### 2. Send CONFIG? to the node

From the web UI Commands page, or via MQTT:
```bash
mosquitto_pub -h <broker> -t 'lora/5/debug' -m 'CONFIG?'
```

### 3. Gateway registers with HA

The gateway receives the config response and publishes MQTT discovery messages:
```
homeassistant/sensor/lora_5_temperature/config
homeassistant/sensor/lora_5_humidity/config
homeassistant/sensor/lora_5_rssi/config
...
```

Entities appear automatically in Home Assistant, grouped under "LoRa Node 5".

### Common device_class values

| Class | Unit examples |
|-------|---------------|
| `temperature` | °C, °F |
| `humidity` | % |
| `pressure` | hPa, mbar |
| `battery` | % |
| `voltage` | V, mV |
| `current` | A, mA |
| `power` | W, kW |
| `illuminance` | lx |
| `moisture` | % |
| `co2` | ppm |
| `pm25` | µg/m³ |

See [HA Sensor Documentation](https://www.home-assistant.io/integrations/sensor/#device-class) for the full list.

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
