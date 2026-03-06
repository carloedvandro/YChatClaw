#!/bin/bash
# Final test of multi-model AI system

echo "=== Test 1: Simple greeting (0.8b FAST) ==="
time curl -s -X POST http://localhost:3002/process \
  -H "Content-Type: application/json" \
  -d '{"message":"Oi, meu nome eh Carlo","userId":"test_final","channel":"whatsapp","channelId":"5511888"}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('Response:', d.get('response','NONE')[:300])" 2>/dev/null

echo ""
echo "=== Test 2: Memory check (0.8b FAST) ==="
time curl -s -X POST http://localhost:3002/process \
  -H "Content-Type: application/json" \
  -d '{"message":"Qual meu nome?","userId":"test_final","channel":"whatsapp","channelId":"5511888"}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('Response:', d.get('response','NONE')[:300])" 2>/dev/null

echo ""
echo "=== Test 3: Open Google (REGEX instant) ==="
time curl -s -X POST http://localhost:3002/process \
  -H "Content-Type: application/json" \
  -d '{"message":"Abre o Google","userId":"test_final","channel":"whatsapp","channelId":"5511888"}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('Response:', d.get('response','NONE')[:300])" 2>/dev/null

echo ""
echo "=== Test 4: Search (REGEX instant) ==="
time curl -s -X POST http://localhost:3002/process \
  -H "Content-Type: application/json" \
  -d '{"message":"Pesquisa cachorro bonito no google","userId":"test_final","channel":"whatsapp","channelId":"5511888"}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('Response:', d.get('response','NONE')[:300])" 2>/dev/null

echo ""
echo "=== Test 5: Open YouTube (REGEX instant) ==="
time curl -s -X POST http://localhost:3002/process \
  -H "Content-Type: application/json" \
  -d '{"message":"Abre o YouTube","userId":"test_final","channel":"whatsapp","channelId":"5511888"}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('Response:', d.get('response','NONE')[:300])" 2>/dev/null

echo ""
echo "=== LOGS ==="
docker logs ychatclaw-ai --tail 25 2>&1 | grep -E '🔍|⚡|🧠|🤖|Fast|Intent|Roteando'
