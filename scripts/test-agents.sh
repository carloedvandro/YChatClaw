#!/bin/bash
# Test Agent API and screenshot fix

echo "=== Test 1: Create Agent ==="
curl -s -X POST http://localhost:3000/api/agents \
  -H "Content-Type: application/json" \
  -d '{"name":"Assistente Carlo","description":"Agente pessoal do Carlo","systemPrompt":"Voce eh o melhor amigo do Carlo. Seja informal e divertido.","allowedNumbers":["5511999998888"]}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('Created:', d.get('name','ERR'), 'ID:', d.get('id','ERR')[:8])"

echo ""
echo "=== Test 2: List Agents ==="
curl -s http://localhost:3000/api/agents \
  | python3 -c "import sys,json; d=json.load(sys.stdin); agents=d.get('agents',[]); print(f'{len(agents)} agent(s)'); [print(f'  - {a[\"name\"]} ({a[\"model\"]}) active={a[\"isActive\"]} allowed={a.get(\"allowedNumbers\",[])}') for a in agents]"

echo ""
echo "=== Test 3: AI Chat (new personality) ==="
time curl -s -X POST http://localhost:3002/process \
  -H "Content-Type: application/json" \
  -d '{"message":"E ai mano, tudo bem?","userId":"test_agent","channel":"whatsapp","channelId":"5511888"}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('Response:', d.get('response','NONE')[:300])"

echo ""
echo "=== Test 4: Screenshot fix (site + print) ==="
time curl -s -X POST http://localhost:3002/process \
  -H "Content-Type: application/json" \
  -d '{"message":"Entre no site do Google e me mande um print","userId":"test_screenshot","channel":"whatsapp","channelId":"5511888"}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); has_ss=bool(d.get('screenshotData','')); print('Response:', d.get('response','NONE')[:200]); print('Screenshot:', 'SIM' if has_ss else 'NAO', f'({len(d.get(\"screenshotData\",\"\"))} chars)' if has_ss else '')"

echo ""
echo "=== Test 5: Dashboard agents endpoint ==="
curl -s -H "Authorization: Basic YWRtaW46eWNoYXRjbGF3MTIz" http://localhost:3000/dashboard/agents \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'{len(d.get(\"agents\",[]))} agents via dashboard')"

echo ""
echo "=== AI Service Logs ==="
docker logs ychatclaw-ai --tail 15 2>&1 | grep -E 'Intent|Fast|Roteando|screenshot|web_open|🔍|⚡|📸'
