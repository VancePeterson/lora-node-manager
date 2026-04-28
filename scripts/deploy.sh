#!/bin/bash
set -e

TARGET_HOST="${TARGET_HOST:-192.168.0.186}"
TARGET_PATH="${TARGET_PATH:-/root/lora-manager}"

echo "Deploying to ${TARGET_HOST}:${TARGET_PATH}"

# Build frontend
echo "Building frontend..."
cd frontend
npm run build
cd ..

# Copy files to target
echo "Copying files..."
rsync -avz --delete \
    --exclude 'node_modules' \
    --exclude '__pycache__' \
    --exclude '.venv' \
    --exclude 'venv' \
    --exclude '.git' \
    --exclude '*.pyc' \
    --exclude '.env' \
    ./ root@${TARGET_HOST}:${TARGET_PATH}/

# Copy built frontend to backend static
ssh root@${TARGET_HOST} "cp -r ${TARGET_PATH}/frontend/dist/* ${TARGET_PATH}/backend/static/"

# Restart container
echo "Restarting container..."
ssh root@${TARGET_HOST} "cd ${TARGET_PATH} && docker-compose up -d --build"

echo "Deployment complete!"
echo "View logs: ssh root@${TARGET_HOST} 'docker-compose -f ${TARGET_PATH}/docker-compose.yml logs -f'"
