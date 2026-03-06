#!/bin/bash
# Test raw Ollama speed for both models

echo "=== Direct Ollama test: 0.8b with minimal prompt ==="
time curl -s http://localhost:11435/api/chat -d '{
  "model": "qwen3.5:0.8b",
  "stream": false,
  "options": {"num_predict": 50},
  "messages": [{"role":"user","content":"Oi, meu nome eh Carlo. Tudo bem?"}]
}' | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('message',{}).get('content','NONE')[:300])"

echo ""
echo "=== Direct Ollama test: 0.8b with system prompt + 3 msgs ==="
time curl -s http://localhost:11435/api/chat -d '{
  "model": "qwen3.5:0.8b",
  "stream": false,
  "options": {"num_predict": 100},
  "messages": [
    {"role":"system","content":"Voce eh o YChatClaw. Responda em portugues. Seja breve, maximo 2 frases."},
    {"role":"user","content":"Oi meu nome eh Carlo"},
    {"role":"assistant","content":"Oi Carlo! Como posso te ajudar?"},
    {"role":"user","content":"Voce lembra meu nome?"}
  ]
}' | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('message',{}).get('content','NONE')[:300])"

echo ""
echo "=== Direct Ollama test: 4b with tool prompt ==="
time curl -s http://localhost:11435/api/chat -d '{
  "model": "qwen3.5:4b",
  "stream": false,
  "options": {"num_predict": 200},
  "messages": [
    {"role":"system","content":"Responda APENAS JSON. Formato: {\"actions\":[],\"response\":\"texto\"}"},
    {"role":"user","content":"Pesquisa cachorro no google"}
  ]
}' | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('message',{}).get('content','NONE')[:500])"

echo ""
echo "=== Ollama model status ==="
curl -s http://localhost:11435/api/ps | python3 -c "import sys,json;d=json.load(sys.stdin);[print(f'{m[\"name\"]}: {m[\"size\"]//1024//1024}MB, expires: {m.get(\"expires_at\",\"?\")}') for m in d.get('models',[])]"
