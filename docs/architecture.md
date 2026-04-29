# Architecture

## System Overview

LoRa Node Manager is a Home Assistant Supervisor add-on that provides a management interface for RYLR998-based LoRa networks.

### Design Principles

1. **Peer, not proxy** — The add-on subscribes to MQTT alongside Home Assistant, not in the data path
2. **Supervisor-native** — Uses HA's ingress system for auth and sidebar integration
3. **Standalone web app** — FastAPI + React, no HA frontend framework dependencies
4. **Single gateway** — Point-to-point star topology, one ESP32 gateway
5. **Address-based identification** — Nodes identified by LoRa address, not names

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
         │addr: 5 │    │addr: 12│    │addr: N │
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

### Address-Based MQTT Topics

Topics use the node's LoRa address as the identifier. This keeps the gateway simple (no name configuration needed) and allows display names to be changed without affecting MQTT routing.

Each node has just two topics:

```
lora/{address}/state      # Telemetry + gateway metadata (retained)
lora/{address}/debug      # Commands and responses (not retained)
lora/gateway/state        # Gateway health
```

The gateway enriches node telemetry with signal metrics:

```json
{
  "temperature": 22.5,
  "humidity": 65.0,
  "seq": 42,
  "rssi": -72,
  "snr": 8.5
}
```

The `debug` topic works like a serial terminal - send commands, receive responses on the same topic.

### Node Commands

Nodes respond to plain text commands:

| Command | Description |
|---------|-------------|
| `PING` | Returns `{"ack": "PING", "result": "PONG"}` |
| `STATUS` | Returns uptime, address, heap size |
| `CONFIG?` | Returns HA discovery field definitions |
| `SETTINGS?` | Returns current node settings |
| `REBOOT` | Restarts the node |
| `SLEEP` | Enter deep sleep immediately |
| `DEFAULTS` | Reset all settings to defaults |

### Remote Node Configuration

Node settings can be updated remotely via JSON commands:

```json
{"cmd": "SET", "telemetry_interval": 300000}
{"cmd": "SET", "deep_sleep": true, "sleep_duration": 600000}
{"cmd": "SET", "tx_power": 15}
```

| Setting | Default | Description |
|---------|---------|-------------|
| `telemetry_interval` | 60000 | Telemetry send interval (ms) |
| `deep_sleep` | false | Sleep between transmissions |
| `sleep_duration` | 60000 | Deep sleep duration (ms) |
| `tx_power` | 22 | RYLR998 TX power (0-22 dBm) |

Settings are persisted to ESP32 flash (NVS).

### Frame Format

LoRa frames use a packed binary format, hex-encoded for the AT interface:

```
┌──────────┬──────────┬─────────────────────┐
│ msg_type │   seq    │   payload (varies)  │
│  1 byte  │  1 byte  │   per node type     │
└──────────┴──────────┴─────────────────────┘
```

The gateway decodes these and publishes human-readable JSON to MQTT using the source address as the topic path.

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
# In-memory node state cache (keyed by address)
nodes: dict[int, NodeState] = {}

# Updated on MQTT messages
class NodeState:
    address: int        # Primary key, used in MQTT topics
    name: str           # Display name (e.g., "Chicken Coop"), can be empty
    online: bool
    last_seen: datetime
    rssi: int
    snr: float
    telemetry: dict
    packets_rx: int
    gap_count: int
```

Auto-discovered nodes (from MQTT) get an empty name and display as "Node {address}" until renamed.

### Display Name Helper

```python
def get_node_display_name(node: NodeState) -> str:
    return node.name if node.name else f"Node {node.address}"
```

### Persistence

SQLite stores:
- Node configuration (address as primary key, display name, type, calibration)
- RSSI/SNR history (ring buffer, 24 hours)
- User preferences

## Frontend Architecture

### Tech Stack

- **React 18** with TypeScript
- **TailwindCSS** for utility-first styling
- **DaisyUI** for component library and theming
- **React Router** for navigation
- **TanStack Query** for data fetching

### React Application

```
frontend/src/
├── App.tsx               # Router, DaisyUI drawer layout
├── main.tsx              # Entry point, providers
├── index.css             # Tailwind directives
├── types.ts              # TypeScript interfaces, getNodeDisplayName()
├── api/
│   └── client.ts         # Fetch wrapper, WebSocket hook
├── context/
│   └── ThemeContext.tsx  # Light/dark theme management
├── pages/
│   ├── Dashboard.tsx     # Overview stats and alerts
│   ├── Nodes.tsx         # Node list with filters
│   ├── NodeDetail.tsx    # Single node view (by address)
│   ├── Network.tsx       # Signal strength visualization
│   ├── Commands.tsx      # Send commands to nodes
│   ├── Logs.tsx          # Log viewer with filters
│   └── Settings.tsx      # MQTT config and theme settings
└── components/
    ├── NodeTable.tsx     # Reusable node list table
    └── CreateNodeModal.tsx  # Node registration modal
```

### Routing

Routes use address as the identifier:
- `/nodes` - Node list
- `/nodes/:address` - Node detail page (e.g., `/nodes/5`)

### Theming

The app supports light and dark themes via DaisyUI:
- Theme preference stored in localStorage
- Respects system preference on first visit
- Toggle in header and Settings page
- Applied via `data-theme` attribute on `<html>`

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
