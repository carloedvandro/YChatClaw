#!/bin/bash
# Check what's on port 11434 vs 11435

echo "=== Port 11434 models ==="
curl -s http://127.0.0.1:11434/api/tags | python3 -c 'import sys,json;[print(m["name"]) for m in json.load(sys.stdin)["models"]]'

echo "=== Port 11435 models ==="
curl -s http://127.0.0.1:11435/api/tags | python3 -c 'import sys,json;[print(m["name"]) for m in json.load(sys.stdin)["models"]]'

echo "=== What process is on 11434? ==="
fuser 11434/tcp 2>&1 || echo "fuser not available"
lsof -i :11434 2>&1 | head -5 || echo "lsof not available"

echo "=== Pull qwen3.5:4b to native Ollama on 11434 ==="
curl -s http://127.0.0.1:11434/api/pull -d '{"name":"qwen3.5:4b","stream":false}' --max-time 300

echo "=== Pull qwen3.5:0.8b to native Ollama on 11434 ==="
curl -s http://127.0.0.1:11434/api/pull -d '{"name":"qwen3.5:0.8b","stream":false}' --max-time 300

echo ""
echo "=== Verify 11434 models after pull ==="
curl -s http://127.0.0.1:11434/api/tags | python3 -c 'import sys,json;[print(m["name"]) for m in json.load(sys.stdin)["models"]]'

echo "=== Done ==="
