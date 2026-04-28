# Development Guide

## Prerequisites

- Python 3.12+
- Node.js 20+
- Docker (for local MQTT broker)
- SSH access to development LXC

## Development Environment

### Architecture

```
┌─────────────────────┐         ┌─────────────────────┐
│   Windows/WSL       │   SSH   │   Development LXC   │
│                     │ ──────► │   192.168.0.186     │
│  - Source code      │  rsync  │                     │
│  - Git repo         │         │  - Docker runtime   │
│  - IDE/editor       │         │  - FastAPI server   │
│                     │         │  - Mosquitto        │
└─────────────────────┘         └─────────────────────┘
```

### Local Development (WSL)

For rapid iteration, run the backend and frontend locally:

```bash
# Terminal 1: Backend
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8080

# Terminal 2: Frontend
cd frontend
npm install
npm run dev
```

### LXC Development Server

For integration testing closer to production:

```bash
# Deploy to LXC
./scripts/deploy.sh

# SSH in to view logs
ssh root@192.168.0.186
docker-compose logs -f
```

## Project Setup

### Clone and Initialize

```bash
cd /mnt/c/Users/Vance/Projects/Personal/lora-node-manager

# Backend setup
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
pip install -r requirements-dev.txt  # pytest, ruff, etc.

# Frontend setup
cd ../frontend
npm install
```

### Environment Variables

Create `.env` files for local development:

```bash
# backend/.env
MQTT_HOST=localhost
MQTT_PORT=1883
MQTT_TOPIC_PREFIX=lora
DATABASE_PATH=./data/lora_manager.db
DEBUG=true
```

```bash
# frontend/.env
VITE_API_URL=http://localhost:8080
```

## Development Workflow

### 1. Make Changes Locally

Edit code in your preferred editor on Windows/WSL.

### 2. Test Locally (Fast Iteration)

```bash
# Run with hot reload
cd backend && uvicorn main:app --reload
cd frontend && npm run dev
```

### 3. Deploy to LXC (Integration Test)

```bash
# Sync and restart
./scripts/deploy.sh
```

### 4. Commit When Working

```bash
git add -A
git commit -m "Description of changes"
```

## Deployment Script

`scripts/deploy.sh`:

```bash
#!/bin/bash
set -e

LXC_HOST="root@192.168.0.186"
REMOTE_DIR="/opt/lora-node-manager"

echo "Building frontend..."
cd frontend
npm run build
cd ..

echo "Syncing to LXC..."
rsync -avz --delete \
  --exclude 'venv' \
  --exclude 'node_modules' \
  --exclude '__pycache__' \
  --exclude '.git' \
  --exclude '*.pyc' \
  --exclude '.env' \
  ./ ${LXC_HOST}:${REMOTE_DIR}/

echo "Restarting services..."
ssh ${LXC_HOST} "cd ${REMOTE_DIR} && docker-compose up -d --build"

echo "Done! View logs with: ssh ${LXC_HOST} docker-compose -f ${REMOTE_DIR}/docker-compose.yml logs -f"
```

## LXC Setup

### Initial Configuration

```bash
ssh root@192.168.0.186

# Install Docker
apt update
apt install -y docker.io docker-compose

# Create project directory
mkdir -p /opt/lora-node-manager

# Enable Docker
systemctl enable docker
systemctl start docker
```

### Docker Compose for Development

`docker-compose.yml` (on LXC):

```yaml
version: "3.8"

services:
  app:
    build: .
    ports:
      - "8080:8080"
    environment:
      - MQTT_HOST=mosquitto
      - MQTT_PORT=1883
      - MQTT_TOPIC_PREFIX=lora
      - DATABASE_PATH=/data/lora_manager.db
    volumes:
      - ./data:/data
    depends_on:
      - mosquitto

  mosquitto:
    image: eclipse-mosquitto:2
    ports:
      - "1883:1883"
    volumes:
      - ./mosquitto.conf:/mosquitto/config/mosquitto.conf

volumes:
  data:
```

`mosquitto.conf`:

```
listener 1883
allow_anonymous true
```

## Testing

### Backend Tests

```bash
cd backend
pytest
pytest --cov=. --cov-report=html  # Coverage report
```

### Frontend Tests

```bash
cd frontend
npm test
npm run test:coverage
```

### Integration Tests

```bash
# Requires LXC running with Mosquitto
cd backend
pytest tests/integration/ --mqtt-host=192.168.0.186
```

## Code Quality

### Linting

```bash
# Backend
cd backend
ruff check .
ruff format .

# Frontend
cd frontend
npm run lint
npm run format
```

### Type Checking

```bash
# Backend
cd backend
mypy .

# Frontend
cd frontend
npm run typecheck
```

## Debugging

### Backend Logs

```bash
# Local
uvicorn main:app --reload --log-level debug

# LXC
ssh root@192.168.0.186 "docker-compose logs -f app"
```

### MQTT Debugging

```bash
# Subscribe to all LoRa topics
mosquitto_sub -h 192.168.0.186 -t 'lora/#' -v

# Publish test message
mosquitto_pub -h 192.168.0.186 -t 'lora/test_node/state' -m '{"temp": 25.5}'
```

### Frontend DevTools

- React DevTools browser extension
- Vite provides HMR and detailed build errors
- Network tab for API debugging

## Common Issues

### Ingress Path Issues

**Symptom**: White screen when loading in HA

**Cause**: Assets loading from wrong path

**Fix**: Ensure `vite.config.ts` has `base: './'` and `index.html` has `<base href="./">`

### MQTT Connection Refused

**Symptom**: Backend can't connect to Mosquitto

**Cause**: Firewall, wrong host, or Mosquitto not running

**Fix**:
```bash
# Check Mosquitto is running
docker-compose ps

# Test connectivity
nc -zv mosquitto 1883
```

### Hot Reload Not Working

**Symptom**: Changes not reflected

**Fix**: Check file watchers, restart dev server, clear browser cache
