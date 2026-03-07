#!/bin/bash
# Stop native Ollama (old, port 11434) and forward 11434 -> 11435 (Docker Ollama)

echo "=== Stopping native Ollama on port 11434 ==="
kill $(fuser 11434/tcp 2>/dev/null | tr -d ' ') 2>/dev/null
sleep 2

# Verify it's stopped
if fuser 11434/tcp 2>/dev/null; then
    echo "WARNING: Port 11434 still in use, force killing..."
    kill -9 $(fuser 11434/tcp 2>/dev/null | tr -d ' ') 2>/dev/null
    sleep 2
fi

# Also stop ollama systemd service if it exists
systemctl --user stop ollama 2>/dev/null
systemctl stop ollama 2>/dev/null

# Kill any leftover node proxy on 11434
kill $(fuser 11434/tcp 2>/dev/null | tr -d ' ') 2>/dev/null
sleep 1

echo "=== Port 11434 status ==="
fuser 11434/tcp 2>&1 || echo "Port 11434 is FREE"

echo "=== Starting port forward 11434 -> 11435 ==="
source ~/.nvm/nvm.sh
nohup node /tmp/ollama-port-proxy.js > /tmp/ollama-proxy.log 2>&1 &
sleep 2

echo "=== Verify proxy works ==="
curl -s http://127.0.0.1:11434/api/tags | python3 -c 'import sys,json;[print(m["name"]) for m in json.load(sys.stdin)["models"]]'

echo "=== Restart OpenClaw ==="
systemctl --user restart openclaw-gateway
sleep 5
systemctl --user status openclaw-gateway | head -3

echo "=== DONE ==="
