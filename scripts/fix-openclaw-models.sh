#!/bin/bash
# Fix OpenClaw models.json - correct port and models

MODELS_FILE="$HOME/.openclaw/agents/main/agent/models.json"

cat > "$MODELS_FILE" << 'EOF'
{
  "providers": {
    "ollama": {
      "baseUrl": "http://127.0.0.1:11435",
      "api": "ollama",
      "models": [
        {
          "id": "qwen3.5:4b",
          "name": "Qwen 3.5 4B",
          "reasoning": false,
          "input": ["text"],
          "cost": { "input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0 },
          "contextWindow": 32768,
          "maxTokens": 8192
        },
        {
          "id": "qwen3.5:0.8b",
          "name": "Qwen 3.5 0.8B",
          "reasoning": false,
          "input": ["text"],
          "cost": { "input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0 },
          "contextWindow": 32768,
          "maxTokens": 8192
        }
      ],
      "apiKey": "ollama-local"
    }
  }
}
EOF

echo "models.json updated"
cat "$MODELS_FILE"

# Restart OpenClaw
systemctl --user restart openclaw-gateway
sleep 5
echo "=== Restarted ==="
systemctl --user status openclaw-gateway | head -3

# Verify Ollama access
echo "=== Ollama test ==="
curl -s http://127.0.0.1:11435/api/generate -d '{"model":"qwen3.5:4b","prompt":"hi","stream":false}' --max-time 30 | head -c 200
echo ""
echo "=== Done ==="
