#!/bin/bash
# Test AI with Qwen 3.5

cat > /tmp/test-ai.json << 'JSONEOF'
{"message":"Oi meu nome eh Carlo","userId":"test1","channel":"whatsapp","channelId":"5511999"}
JSONEOF

echo "=== Test 1: Greeting ==="
curl -s -X POST http://localhost:3002/process \
  -H "Content-Type: application/json" \
  -d @/tmp/test-ai.json | python3 -m json.tool 2>/dev/null || curl -s -X POST http://localhost:3002/process -H "Content-Type: application/json" -d @/tmp/test-ai.json

echo ""
echo "=== Test 2: Memory check ==="
cat > /tmp/test-ai2.json << 'JSONEOF'
{"message":"Voce lembra meu nome?","userId":"test1","channel":"whatsapp","channelId":"5511999"}
JSONEOF

curl -s -X POST http://localhost:3002/process \
  -H "Content-Type: application/json" \
  -d @/tmp/test-ai2.json | python3 -m json.tool 2>/dev/null || curl -s -X POST http://localhost:3002/process -H "Content-Type: application/json" -d @/tmp/test-ai2.json
