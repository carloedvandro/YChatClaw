#!/bin/bash
# Update OpenClaw config to use Ollama models

CONFIG="/home/user/openclaw-data/openclaw.json"

python3 << 'PYEOF'
import json

with open("/home/user/openclaw-data/openclaw.json", "r") as f:
    d = json.load(f)

d["agents"]["defaults"]["models"] = {
    "ollama/qwen3.5:4b": {"alias": "Qwen4B"},
    "ollama/qwen3.5:0.8b": {"alias": "Qwen08B"}
}

d["agents"]["list"] = [
    {"id": "main", "model": "ollama/qwen3.5:4b"},
    {
        "id": "local",
        "name": "local",
        "workspace": "/home/node/.openclaw/workspace-local",
        "agentDir": "/home/node/.openclaw/agents/local/agent",
        "model": "ollama/qwen3.5:4b"
    }
]

with open("/home/user/openclaw-data/openclaw.json", "w") as f:
    json.dump(d, f, indent=2)

print("OpenClaw config updated to use Ollama models")
PYEOF

# Also update .env
cat > /home/user/openclaw-data/.env << 'EOF'
OLLAMA_HOST=http://ychatclaw-ollama:11434
OPENAI_API_KEY=ollama
OPENAI_API_BASE=http://ychatclaw-ollama:11434/v1
EOF

echo "Env updated"

# Restart OpenClaw
docker restart openclaw
echo "OpenClaw restarted"

# Wait and show logs
sleep 8
docker logs openclaw --tail 10 2>&1
