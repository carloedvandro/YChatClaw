#!/bin/bash
# Fix OpenClaw Ollama connection - port 11435 not 11434

SERVICE_FILE="$HOME/.config/systemd/user/openclaw-gateway.service"

# Read current service file
echo "=== Current service file ==="
cat "$SERVICE_FILE"

# Check if OLLAMA_HOST is already set
if grep -q "OLLAMA_HOST" "$SERVICE_FILE"; then
    echo "=== Updating existing OLLAMA_HOST ==="
    sed -i 's|OLLAMA_HOST=.*|OLLAMA_HOST=http://localhost:11435|' "$SERVICE_FILE"
else
    echo "=== Adding OLLAMA_HOST to service ==="
    sed -i '/\[Service\]/a Environment=OLLAMA_HOST=http://localhost:11435' "$SERVICE_FILE"
fi

echo "=== Updated service file ==="
cat "$SERVICE_FILE"

# Reload and restart
systemctl --user daemon-reload
systemctl --user restart openclaw-gateway
sleep 5

echo "=== Status ==="
systemctl --user status openclaw-gateway | head -5

echo "=== Testing Ollama connection ==="
curl -s http://localhost:11435/api/tags | grep -o '"name":"[^"]*"' | head -3

echo "=== Done ==="
