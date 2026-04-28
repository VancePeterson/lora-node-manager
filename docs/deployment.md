# Deployment Guide

## Deploying to Home Assistant OS

### Prerequisites

- Home Assistant OS (HAOS) on bare metal or VM
- SSH or Samba add-on installed for file access
- Mosquitto add-on installed and running

### Local Add-on Installation

#### 1. Access the Add-ons Directory

**Via Samba:**
```
\\homeassistant.local\addons\
```

**Via SSH:**
```bash
ssh root@homeassistant.local
cd /addons/
```

#### 2. Copy the Add-on

Copy the entire `lora-node-manager/` directory to `/addons/`:

```
/addons/
└── lora-node-manager/
    ├── config.yaml
    ├── Dockerfile
    ├── run.sh
    ├── backend/
    └── frontend/
```

#### 3. Refresh Add-on Store

1. Go to **Settings → Add-ons**
2. Click **Add-on Store**
3. Click the **⋮** menu (top right)
4. Select **Check for updates**

#### 4. Install the Add-on

1. Scroll to **Local add-ons** section
2. Click **LoRa Node Manager**
3. Click **Install**
4. Wait for the build to complete

#### 5. Configure

Before starting, configure the add-on:

```yaml
mqtt_host: core-mosquitto    # Default for Mosquitto add-on
mqtt_port: 1883
mqtt_topic_prefix: lora       # Must match your gateway
```

#### 6. Start and Access

1. Toggle **Start on boot** if desired
2. Click **Start**
3. Once running, the **LoRa Manager** icon appears in the sidebar
4. Click to access the panel

## Configuration Options

| Option | Default | Description |
|--------|---------|-------------|
| `mqtt_host` | `core-mosquitto` | MQTT broker hostname |
| `mqtt_port` | `1883` | MQTT broker port |
| `mqtt_topic_prefix` | `lora` | Topic prefix for LoRa messages |

## Add-on Manifest Reference

`config.yaml`:

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

# Ingress (sidebar panel)
ingress: true
ingress_port: 8080
panel_icon: mdi:radio-tower
panel_title: LoRa Manager
panel_admin: true

# No exposed ports - ingress only
ports:
  8080/tcp: null

# Map config directory for database
map:
  - config:rw

# Default options
options:
  mqtt_host: core-mosquitto
  mqtt_port: 1883
  mqtt_topic_prefix: lora

# Options schema
schema:
  mqtt_host: str
  mqtt_port: port
  mqtt_topic_prefix: str

# Build configuration
image: ghcr.io/yourusername/lora-node-manager-{arch}
```

## Dockerfile

Multi-stage build for Python backend + React frontend:

```dockerfile
# Stage 1: Build frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Production image
FROM python:3.12-slim

WORKDIR /app

# Install Python dependencies
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/ ./

# Copy built frontend
COPY --from=frontend-builder /app/frontend/dist ./static/

# Create data directory
RUN mkdir -p /data

# Expose port for ingress
EXPOSE 8080

# Run the application
CMD ["python", "main.py"]
```

## Updating the Add-on

### Development Updates

1. Make changes locally
2. Copy updated files to `/addons/lora-node-manager/`
3. Go to the add-on page in HA
4. Click **Rebuild**

### Version Bumps

1. Update `version` in `config.yaml`
2. Copy to HAOS
3. Refresh add-on store
4. Update will be available

## Troubleshooting

### Add-on Won't Start

**Check logs:**
Settings → Add-ons → LoRa Node Manager → Log

**Common causes:**
- Port conflict (unlikely with ingress-only)
- Missing MQTT broker
- Python dependency issues

### Sidebar Icon Missing

- Ensure `ingress: true` in config.yaml
- Check `panel_icon` is a valid MDI icon
- Restart Home Assistant Core

### White Screen on Panel Load

- Check browser console for 404 errors
- Verify `base: './'` in vite.config.ts
- Verify `<base href="./">` in index.html
- Rebuild the add-on

### MQTT Connection Failed

**Verify Mosquitto is running:**
Settings → Add-ons → Mosquitto broker → Started

**Check network:**
The add-on should reach Mosquitto at `core-mosquitto:1883` on the internal Docker network.

**Check credentials:**
If Mosquitto requires authentication, add username/password options to config.yaml and schema.

### Database Errors

The SQLite database is stored at `/config/lora_manager.db` (mapped from HAOS config directory).

**Reset database:**
```bash
# SSH into HAOS
rm /config/lora_manager.db
# Restart add-on
```

## Logs

### Viewing Logs

**In HA UI:**
Settings → Add-ons → LoRa Node Manager → Log

**Via SSH:**
```bash
docker logs addon_local_lora-node-manager
```

### Log Levels

Set via environment variable in Dockerfile or run.sh:
```bash
export LOG_LEVEL=DEBUG  # DEBUG, INFO, WARNING, ERROR
```

## Backup

The add-on stores data in:
- `/config/lora_manager.db` — SQLite database

This is included in standard HAOS backups (Settings → System → Backups).

## Uninstalling

1. Settings → Add-ons → LoRa Node Manager
2. Click **Uninstall**
3. Optionally delete `/addons/lora-node-manager/`

Note: The database in `/config/lora_manager.db` is preserved. Delete manually if needed.
