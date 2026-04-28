# Architecture

## System Overview

LoRa Node Manager is a Home Assistant Supervisor add-on that provides a management interface for RYLR998-based LoRa networks.

### Design Principles

1. **Peer, not proxy** — The add-on subscribes to MQTT alongside Home Assistant, not in the data path
2. **Supervisor-native** — Uses HA's ingress system for auth and sidebar integration
3. **Standalone web app** — FastAPI + React, no HA frontend framework dependencies
4. **Single gateway** — Point-to-point star topology, one ESP32 gateway

## Component Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Home Assistant OS                              │
│  ┌─────────────┐    ┌─────────────┐    ┌──────────────────────────────┐ │
│  │   HA Core   │    │  Mosquitto  │    │    LoRa Node Manager Add-on │ │
│  │             │    │   Add-on    │    │  ┌────────┐    ┌──────────┐ │ │
│  │  Entities   │◄───│             │◄───│  │FastAPI │◄──►│  React   │ │ │
│  │  Dashboard  │    │   :1883     │    │  │ :8080  │    │   SPA    │ │ │
│  └─────────────┘    └──────┬──────┘    │  └───┬────┘    └──────────┘ │ │
│                            │           │      │                       │ │
│                            │           │  ┌───▼────┐                  │ │
│                            │           │  │ SQLite │                  │ │
│                            │           │  └────────┘                  │ │
│                            │           └──────────────────────────────┘ │
└────────────────────────────┼────────────────────────────────────────────┘
                             │
                    ┌────────▼────────┐
                    │  ESP32 Gateway  │
                    │  RYLR998 ↔ MQTT │
                    └────────┬────────┘
                             │ radio
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
         ┌────────┐    ┌────────┐    ┌────────┐
         │ Node 1 │    │ Node 2 │    │ Node N │
         │RYLR998 │    │RYLR998 │    │RYLR998 │
         └────────┘    └────────┘    └────────┘
```

## Add-on Manifest

The `config.yaml` manifest configures how the Supervisor runs the add-on:

```yaml
name: LoRa Node Manager
version: "0.1.0"
slug: lora-node-manager
description: Management panel for RYLR998 LoRa networks
url: https://github.com/yourusername/lora-node-manager

arch:
  - amd64
  - aarch64
  - armv7

# Ingress configuration (sidebar panel)
ingress: true
ingress_port: 8080
panel_icon: mdi:radio-tower
panel_title: LoRa Manager
panel_admin: true

# Network and permissions
ports:
  8080/tcp: null    # null = no host port exposure (ingress only)
map:
  - config:rw       # /config mapped for SQLite database

options:
  mqtt_host: core-mosquitto
  mqtt_port: 1883
  mqtt_topic_prefix: lora

schema:
  mqtt_host: str
  mqtt_port: port
  mqtt_topic_prefix: str
```

### Key Ingress Settings

| Field | Purpose |
|-------|---------|
| `ingress: true` | Enables the HA ingress proxy |
| `ingress_port: 8080` | Internal port the add-on listens on |
| `panel_icon` | MDI icon for sidebar |
| `panel_title` | Display name in sidebar |
| `panel_admin` | Only admin users see the panel |

## Data Flow

### MQTT Topics

The ESP32 gateway publishes to these topics:

```
lora/{node_name}/state      # Decoded telemetry JSON
lora/{node_name}/online     # "online" or "offline"
lora/{node_name}/rssi       # Last received RSSI
lora/{node_name}/snr        # Last received SNR
lora/{node_name}/last_seen  # Unix timestamp
lora/{node_name}/gap_count  # Missed sequence numbers
lora/gateway/status         # Gateway health
```

### Frame Format

LoRa frames use a packed binary format, hex-encoded for the AT interface:

```
┌──────────┬──────────┬─────────────────────┐
│ msg_type │   seq    │   payload (varies)  │
│  1 byte  │  1 byte  │   per node type     │
└──────────┴──────────┴─────────────────────┘
```

The gateway decodes these and publishes human-readable JSON to MQTT.

## Backend Architecture

### FastAPI Application

```
backend/
├── main.py           # App factory, lifespan, static file serving
├── api.py            # REST and WebSocket routes
├── mqtt_client.py    # Async MQTT subscriber
├── db.py             # SQLite via aiosqlite
├── models.py         # Pydantic models
└── config.py         # Settings from environment/options
```

### State Management

```python
# In-memory node state cache
nodes: dict[str, NodeState] = {}

# Updated on MQTT messages
class NodeState:
    name: str
    address: int
    node_type: str
    online: bool
    last_seen: datetime
    rssi: int
    snr: float
    telemetry: dict
    packets_rx: int
    gap_count: int
```

### Persistence

SQLite stores:
- Node configuration (name, address, type, calibration)
- RSSI/SNR history (ring buffer, 24 hours)
- User preferences

## Frontend Architecture

### React Application

```
frontend/src/
├── App.tsx               # Router, layout
├── api/
│   └── client.ts         # Fetch wrapper, WebSocket hook
├── pages/
│   ├── Inventory.tsx     # Node table
│   ├── NodeDetail.tsx    # Single node view
│   ├── AddNode.tsx       # Provisioning wizard
│   ├── Logs.tsx          # Live log stream
│   └── Gateway.tsx       # Gateway health
└── components/
    ├── NodeTable.tsx
    ├── RssiChart.tsx
    └── TelemetryCard.tsx
```

### Ingress Path Handling

**Critical**: Assets must load correctly under HA's ingress proxy path.

```typescript
// vite.config.ts
export default defineConfig({
  base: './',  // Relative paths for all assets
  // ...
});
```

```html
<!-- index.html -->
<base href="./">
```

## Security

### Authentication

The Supervisor ingress proxy handles authentication:
1. User accesses add-on via HA sidebar
2. HA verifies user is logged in and has admin rights
3. Request is proxied to add-on with auth headers
4. Add-on trusts requests from ingress (internal network only)

### MQTT

The add-on connects to Mosquitto using:
- Internal Docker network (`core-mosquitto` hostname)
- HA's MQTT credentials if authentication is enabled

## Future Considerations

### Out of Scope for v1

- Mesh routing visualization (network is star topology)
- HA entity config flow (gateway handles MQTT discovery)
- Multi-gateway support
- HACS distribution

### Potential v2 Features

- WebSocket from gateway for live AT command passthrough
- Log streaming without MQTT (direct serial bridge)
- OTA firmware updates via LoRa
- Network topology visualization
