# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LoRa Node Manager is a Home Assistant Supervisor add-on for managing RYLR998-based LoRa point-to-point networks. It provides a React UI sidebar panel with node inventory, live telemetry, link quality monitoring, and command capabilities.

**Tech Stack:** Python 3.12+ (FastAPI, aiomqtt, aiosqlite) backend, React/TypeScript/Vite frontend, SQLite database, MQTT messaging.

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
mosquitto_pub -h 192.168.0.186 -t 'lora/test/state' -m '{"temp": 25}'
```

## Architecture

### Key Design Patterns

1. **Peer MQTT Consumer**: The add-on subscribes to MQTT alongside Home Assistant (not in the data path). Gateway publishes to Mosquitto; both HA and this manager consume independently.

2. **Supervisor Ingress Integration**: Uses HA's ingress proxy for auth. No exposed host port—8080 only accessible via ingress. User must be logged in with admin rights.

3. **Standalone Web Stack**: FastAPI backend + React SPA with no HA-specific framework dependencies.

4. **State Management**: SQLite for persistence (`/config/lora_manager.db`), in-memory cache for real-time node state.

### MQTT Topic Structure (prefix: `lora`)
```
lora/{node_name}/state       # Decoded telemetry (JSON, retained)
lora/{node_name}/online      # "online" or "offline" (retained)
lora/{node_name}/rssi        # dBm value
lora/{node_name}/snr         # dB float
lora/gateway/status          # Gateway health JSON
```

### Critical Ingress Requirements
- `vite.config.ts` must have `base: './'`
- `index.html` must have `<base href="./">`
- Absolute paths break under ingress proxy

### In-Memory Node State Schema
```python
nodes: dict[str, NodeState] = {
    'node_name': {
        'name': str, 'address': int,
        'online': bool, 'last_seen': datetime,
        'rssi': int, 'snr': float, 'telemetry': dict,
        'packets_rx': int, 'gap_count': int
    }
}
```

## Development Environment

- **Local dev**: Backend on `uv run uvicorn --reload`, frontend on `npm run dev`
- **Integration**: LXC container at `192.168.0.186` with Docker runtime and Mosquitto
- **Deployment**: Multi-stage Dockerfile builds frontend then copies to Python container at `/static/`
