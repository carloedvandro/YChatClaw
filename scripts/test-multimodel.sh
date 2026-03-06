#!/bin/bash
# Test multi-model AI system

echo "=== Test 1: Simple chat (should use 0.8b FAST) ==="
time curl -s -X POST http://localhost:3002/process \
  -H "Content-Type: application/json" \
  -d '{"message":"Oi, meu nome eh Carlo. Tudo bem?","userId":"test1","channel":"whatsapp","channelId":"5511999"}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('Response:', d.get('response','NONE')[:300])"

echo ""
echo "=== Test 2: Memory check (should use 0.8b FAST) ==="
time curl -s -X POST http://localhost:3002/process \
  -H "Content-Type: application/json" \
  -d '{"message":"Voce lembra meu nome?","userId":"test1","channel":"whatsapp","channelId":"5511999"}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('Response:', d.get('response','NONE')[:300])"

echo ""
echo "=== Test 3: Open Google (should use regex INSTANT) ==="
time curl -s -X POST http://localhost:3002/process \
  -H "Content-Type: application/json" \
  -d '{"message":"Abre o Google","userId":"test1","channel":"whatsapp","channelId":"5511999"}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('Response:', d.get('response','NONE')[:300])"

echo ""
echo "=== Test 4: Complex task (should use 4b SMART) ==="
time curl -s -X POST http://localhost:3002/process \
  -H "Content-Type: application/json" \
  -d '{"message":"Pesquisa no google por cachorros bonitos","userId":"test1","channel":"whatsapp","channelId":"5511999"}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('Response:', d.get('response','NONE')[:300])"

echo ""
echo "=== AI Service Logs ==="
docker logs ychatclaw-ai --tail 20 2>&1 | grep -E '🔍|⚡|🧠|🤖'
