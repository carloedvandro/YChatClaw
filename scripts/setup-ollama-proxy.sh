#!/bin/bash
# Permanently replace native Ollama with a proxy to Docker Ollama
# Native Ollama (old, port 11434) -> replaced by proxy -> Docker Ollama (port 11435)

set -e

echo "=== Step 1: Disable native Ollama service permanently ==="
# Rename the service file so systemd can never restart it
if [ -f ~/.config/systemd/user/ollama.service ]; then
    mv ~/.config/systemd/user/ollama.service ~/.config/systemd/user/ollama.service.disabled
    echo "Renamed ollama.service -> ollama.service.disabled"
fi
systemctl --user daemon-reload 2>/dev/null || true
sleep 1

echo "=== Step 2: Kill ALL native ollama processes ==="
pkill -9 -u user ollama 2>/dev/null || true
sleep 2

# Verify port is free
echo "=== Step 3: Check port 11434 ==="
if fuser 11434/tcp 2>/dev/null; then
    echo "Port still in use, force killing..."
    fuser -k -9 11434/tcp 2>/dev/null || true
    sleep 2
fi
fuser 11434/tcp 2>&1 || echo "Port 11434 is FREE"

echo "=== Step 4: Create proxy systemd service ==="
cat > ~/.config/systemd/user/ollama-proxy.service << 'SVCEOF'
[Unit]
Description=Ollama Port Proxy (11434 -> 11435)

[Service]
Type=simple
ExecStart=/home/user/.nvm/versions/node/v22.22.1/bin/node /home/user/ollama-proxy.js
Restart=always
RestartSec=3

[Install]
WantedBy=default.target
SVCEOF

echo "=== Step 5: Create proxy script ==="
cat > ~/ollama-proxy.js << 'JSEOF'
const net = require('net');
const server = net.createServer(function(client) {
  const target = net.connect(11435, '127.0.0.1');
  client.pipe(target);
  target.pipe(client);
  target.on('error', function() { client.destroy(); });
  client.on('error', function() { target.destroy(); });
});
server.listen(11434, '127.0.0.1', function() {
  console.log('Ollama proxy: 127.0.0.1:11434 -> 127.0.0.1:11435');
});
JSEOF

echo "=== Step 6: Enable and start proxy ==="
systemctl --user daemon-reload
systemctl --user enable ollama-proxy.service
systemctl --user start ollama-proxy.service
sleep 2
systemctl --user status ollama-proxy.service | head -5

echo "=== Step 7: Verify proxy ==="
curl -s --max-time 5 http://127.0.0.1:11434/api/tags | python3 -c 'import sys,json;[print(m["name"]) for m in json.load(sys.stdin)["models"]]'

echo "=== Step 8: Restart OpenClaw ==="
systemctl --user restart openclaw-gateway
sleep 3
systemctl --user status openclaw-gateway | head -3

echo "=== ALL DONE ==="
