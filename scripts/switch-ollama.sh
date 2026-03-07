#!/bin/bash
# Switch from native Ollama (11434) to Docker Ollama (11434)
set -e

echo "=== Step 1: Find and stop native Ollama ==="
# Find the native ollama PID
OLLAMA_PID=$(fuser 11434/tcp 2>/dev/null | tr -d ' ')
if [ -n "$OLLAMA_PID" ]; then
    echo "Native Ollama PID: $OLLAMA_PID"
    kill $OLLAMA_PID 2>/dev/null
    sleep 2
    # Force kill if still alive
    kill -9 $OLLAMA_PID 2>/dev/null || true
    sleep 1
fi

# Kill any node proxy too
pkill -f ollama-port-proxy 2>/dev/null || true
sleep 1

# Disable systemd ollama service (try both user and system)
systemctl --user disable --now ollama.service 2>/dev/null || true
systemctl --user mask ollama.service 2>/dev/null || true

echo "=== Step 2: Verify port 11434 is free ==="
if fuser 11434/tcp 2>/dev/null; then
    echo "ERROR: Port 11434 still in use!"
    fuser -v 11434/tcp 2>&1
    exit 1
else
    echo "Port 11434 is FREE"
fi

echo "=== Step 3: Restart Docker Ollama on port 11434 ==="
cd /home/user/YChatClaw
docker compose up -d ollama 2>&1
sleep 5

echo "=== Step 4: Verify Docker Ollama ==="
curl -s http://127.0.0.1:11434/api/tags | python3 -c 'import sys,json;[print(m["name"]) for m in json.load(sys.stdin)["models"]]'

echo "=== Step 5: Restart OpenClaw ==="
systemctl --user restart openclaw-gateway
sleep 3
systemctl --user status openclaw-gateway | head -3

echo "=== DONE! ==="
