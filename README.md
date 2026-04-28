# LoRa Node Manager

A Home Assistant Add-on for managing a custom RYLR998-based LoRa point-to-point network.

## Overview

LoRa Node Manager provides a dedicated sidebar panel in Home Assistant for:

- **Node Inventory** — View all nodes with status, RSSI, SNR, and link quality
- **Live Telemetry** — Decoded sensor data in human-readable units
- **Link Quality Monitoring** — 24-hour RSSI/SNR charts, gap detection
- **Node Provisioning** — Wizard to add new nodes with AT command generation
- **Command Panel** — Send commands to nodes directly from the UI

This replaces the "wall of unrelated MQTT entities" experience that Home Assistant's default UI provides for multi-node LoRa networks.

## Architecture

```
RYLR nodes  ──radio──►  ESP32 gateway  ──MQTT──►  Mosquitto  ──┬──► Home Assistant (entities)
                                                               │
                                                               └──► LoRa Node Manager (this add-on)
```

The add-on is a **peer MQTT consumer** alongside Home Assistant. It does not sit in the data path — the gateway publishes MQTT independently.

### Why a Supervisor Add-on?

- **Ingress support** — Sidebar registration + HA auth proxying via manifest
- **Proven pattern** — ESPHome and Zigbee2MQTT use the same approach
- **Familiar stack** — FastAPI + React, no need for HA frontend internals (Lit, Polymer)
- **Decoupled** — Manager is not in the data path; coupling to HA lifecycle is acceptable

## Tech Stack

| Layer    | Technology           |
|----------|----------------------|
| Backend  | Python 3.12, FastAPI |
| Frontend | React, Vite, TypeScript |
| Database | SQLite               |
| Protocol | MQTT (via Mosquitto) |
| Runtime  | Docker (HA Supervisor) |

## Project Structure

```
lora-node-manager/
├── config.yaml              # HA add-on manifest
├── Dockerfile               # Multi-stage build
├── run.sh                   # Container entrypoint
├── backend/
│   ├── main.py              # FastAPI app entry
│   ├── mqtt_client.py       # Async MQTT subscriber
│   ├── db.py                # SQLite persistence
│   └── api.py               # REST + WebSocket endpoints
└── frontend/
    ├── package.json
    ├── vite.config.ts       # base: "./" for ingress
    └── src/
        ├── App.tsx
        └── pages/
            ├── Inventory.tsx
            ├── NodeDetail.tsx
            ├── AddNode.tsx
            ├── Logs.tsx
            └── Gateway.tsx
```

## Installation

### Local Add-on (Development)

1. Copy `lora-node-manager/` to `/addons/` on your HAOS host
2. Go to **Settings → Add-ons → Add-on Store**
3. Click **⋮ → Check for updates**
4. Find "LoRa Node Manager" under **Local add-ons**
5. Install and start

### Requirements

- Home Assistant OS (HAOS)
- MQTT broker (Mosquitto add-on)
- ESP32 gateway running compatible firmware

## Documentation

- [Architecture](docs/architecture.md) — Detailed system design
- [Development](docs/development.md) — Local development setup
- [Deployment](docs/deployment.md) — Deploying to HAOS
- [MQTT Topics](docs/mqtt-topics.md) — Topic structure and payloads

## License

MIT
