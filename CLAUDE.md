# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LoRa Node Manager is a Home Assistant Supervisor add-on for managing RYLR998-based LoRa point-to-point networks. It provides a React UI sidebar panel with node inventory, live telemetry, link quality monitoring, and command capabilities.

**Tech Stack:** Python 3.12+ (FastAPI, aiomqtt, aiosqlite) backend, React/TypeScript/Vite frontend with TailwindCSS + DaisyUI, SQLite database, MQTT messaging.

## Commands

### Backend (from `/backend`)
```bash
uv sync                                   # Install dependencies
uv run uvicorn main:app --reload --port 8080    # Development server

uv run pytest                             # Run tests
uv run pytest tests/test_api.py::test_name      # Single test
uv run pytest --cov=. --cov-report=html         # Coverage

uv run ruff check . && uv run ruff format .     # Lint and format
uv run mypy .                                   # Type check
```

### Frontend (from `/frontend`)
```bash
npm install
npm run dev                              # Development server (Vite)
npm run build                            # Production build

npm test                                 # Run tests
npm run test:coverage                    # Coverage

npm run lint && npm run format           # Lint and format
npm run typecheck                        # TypeScript check
```

### Integration Testing
```bash
./scripts/deploy.sh                      # Deploy to LXC at 192.168.0.186
ssh root@192.168.0.186 "docker-compose logs -f"

# MQTT debugging
mosquitto_sub -h 192.168.0.186 -t 'lora/#' -v
mosquitto_pub -h 192.168.0.186 -t 'lora/5/state' -m '{"temp": 25}'
mosquitto_pub -h 192.168.0.186 -t 'lora/5/online' -m 'online'
```

## Architecture

### Key Design Patterns

1. **Peer MQTT Consumer**: The add-on subscribes to MQTT alongside Home Assistant (not in the data path). Gateway publishes to Mosquitto; both HA and this manager consume independently.

2. **Supervisor Ingress Integration**: Uses HA's ingress proxy for auth. No exposed host port—8080 only accessible via ingress. User must be logged in with admin rights.

3. **Standalone Web Stack**: FastAPI backend + React SPA with no HA-specific framework dependencies.

4. **State Management**: SQLite for persistence (`/config/lora_manager.db`), in-memory cache for real-time node state.

5. **Address-Based Identification**: Nodes are identified by their LoRa address (integer), not by name. This keeps the gateway "dumb" and allows display names to be changed without affecting MQTT routing.

### Node Identification

Nodes have two identifiers:
- **Address** (`address`): Primary key, integer, used in MQTT topics (e.g., `5`)
- **Display name** (`name`): Human-readable, optional (e.g., "Chicken Coop")

Auto-discovered nodes get an empty name and display as "Node {address}" until renamed.

```python
def get_node_display_name(node: NodeState) -> str:
    return node.name if node.name else f"Node {node.address}"
```

### MQTT Topic Structure (prefix: `lora`)

Topics use the node's address as the identifier:
```
lora/{address}/state       # Decoded telemetry (JSON, retained)
lora/{address}/online      # "online" or "offline" (retained)
lora/{address}/rssi        # dBm value
lora/{address}/snr         # dB float
lora/{address}/command     # Commands TO the node (published by manager)
lora/gateway/status        # Gateway health JSON
```

Example for node at address 5 (display name: "Chicken Coop"):
```
lora/5/state
lora/5/online
lora/5/command
```

### API Endpoints

Key endpoints (using address as identifier):
```
GET  /api/nodes                      # List all nodes
POST /api/nodes                      # Register node (address required, name optional)
GET  /api/nodes/{address}            # Get node details
PUT  /api/nodes/{address}            # Update node (e.g., set display name)
GET  /api/nodes/{address}/history    # Get RSSI history
POST /api/nodes/{address}/command    # Send command to node
GET  /api/gateway                    # Gateway status
GET  /api/settings                   # App settings
PUT  /api/settings                   # Update settings
GET  /api/settings/mqtt/status       # MQTT connection status
GET  /api/logs                       # Query logs (filter by node_address)
WS   /api/ws                         # Real-time updates
```

### Critical Ingress Requirements
- `vite.config.ts` must have `base: './'`
- `index.html` must have `<base href="./">`
- Absolute paths break under ingress proxy

### In-Memory Node State Schema
```python
nodes: dict[int, NodeState] = {
    5: {
        'address': int,        # Primary key, used in MQTT topics
        'name': str,           # Display name (e.g., "Chicken Coop"), can be empty
        'online': bool,
        'last_seen': datetime,
        'rssi': int,
        'snr': float,
        'telemetry': dict,
        'packets_rx': int,
        'gap_count': int
    }
}
```

## Frontend Architecture

### UI Framework
- **TailwindCSS**: Utility-first CSS framework
- **DaisyUI**: Component library with theme support
- **Themes**: Light and dark mode with system preference detection

Theme is managed via `ThemeContext` and persisted to localStorage. The `data-theme` attribute on `<html>` controls the active theme.

### Layout
- **DaisyUI Drawer**: Responsive sidebar that collapses on mobile
- **Sticky header**: Contains hamburger menu (mobile), theme toggle, and "Create Node" button
- **Theme toggle**: Sun/moon swap icon in header, also available in Settings page

### Routing
Routes use address as the identifier:
- `/nodes` - Node list
- `/nodes/:address` - Node detail page (e.g., `/nodes/5`)

### Key Components
```
src/
├── types.ts                 # TypeScript interfaces, getNodeDisplayName()
├── context/
│   └── ThemeContext.tsx     # Theme state management
├── components/
│   ├── NodeTable.tsx        # Reusable node list table
│   └── CreateNodeModal.tsx  # Modal for registering nodes by address
├── pages/
│   ├── Dashboard.tsx        # Overview stats and alerts
│   ├── Nodes.tsx            # Node list with filters
│   ├── NodeDetail.tsx       # Single node details (by address)
│   ├── Network.tsx          # Signal strength visualization
│   ├── Commands.tsx         # Send commands to nodes
│   ├── Logs.tsx             # Log viewer with filters
│   └── Settings.tsx         # MQTT config and theme settings
└── api/
    └── client.ts            # API client functions
```

## Development Environment

- **Local dev**: Backend on `uv run uvicorn --reload`, frontend on `npm run dev`
- **Integration**: LXC container at `192.168.0.186` with Docker runtime and Mosquitto
- **Deployment**: Multi-stage Dockerfile builds frontend then copies to Python container at `/static/`
