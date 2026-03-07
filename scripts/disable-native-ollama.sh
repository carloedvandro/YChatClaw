#!/bin/bash
# Disable native Ollama and forward port 11434 -> 11435 (Docker Ollama)

echo "=== Disabling native Ollama service ==="
systemctl --user stop ollama.service
systemctl --user disable ollama.service
sleep 2

# Kill any remaining ollama process
pkill -f '/usr/local/bin/ollama' 2>/dev/null || pkill ollama 2>/dev/null
sleep 2

# Kill any node proxy that failed
pkill -f ollama-port-proxy 2>/dev/null
sleep 1

# Verify port is free
echo "=== Port 11434 check ==="
fuser 11434/tcp 2>&1 || echo "Port 11434 is FREE"

# Start proxy
echo "=== Starting proxy 11434 -> 11435 ==="
source ~/.nvm/nvm.sh
nohup node /tmp/ollama-port-proxy.js > /tmp/ollama-proxy.log 2>&1 &
PROXY_PID=$!
echo "Proxy PID: $PROXY_PID"
sleep 2

# Verify
echo "=== Models on 11434 (should be qwen3.5) ==="
curl -s http://127.0.0.1:11434/api/tags | python3 -c 'import sys,json;[print(m["name"]) for m in json.load(sys.stdin)["models"]]'

echo "=== Restart OpenClaw ==="
systemctl --user restart openclaw-gateway
sleep 3
echo "=== DONE ==="
