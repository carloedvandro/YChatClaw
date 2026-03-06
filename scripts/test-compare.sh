#!/bin/bash
# Compare Qwen 3.5 4B vs 9B

echo "========================================="
echo "Testing Qwen 3.5:9b directly via Ollama"
echo "========================================="

# Test 1: Tool calling / JSON format
echo ""
echo "=== Test 1: Tool calling (JSON output) ==="
time curl -s http://localhost:11434/api/chat -d '{
  "model": "qwen3.5:9b",
  "stream": false,
  "options": {"temperature": 0.7, "num_predict": 512},
  "messages": [
    {"role": "system", "content": "Voce eh o YChatClaw, assistente de automacao. Responda APENAS com JSON valido.\nFormato: {\"actions\":[{\"action\":\"TOOL\",\"params\":{}}],\"response\":\"texto\"}\nSe nao precisa executar ferramenta: {\"actions\":[],\"response\":\"resposta\"}\nFerramentas: send_device_command (controla celular), send_whatsapp_message, list_devices"},
    {"role": "user", "content": "Oi, meu nome eh Carlo. Tudo bem?"}
  ]
}' | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('message',{}).get('content','NO RESPONSE')[:500])"

echo ""
echo "=== Test 2: Memory / context ==="
time curl -s http://localhost:11434/api/chat -d '{
  "model": "qwen3.5:9b",
  "stream": false,
  "options": {"temperature": 0.7, "num_predict": 512},
  "messages": [
    {"role": "system", "content": "Voce eh o YChatClaw, assistente de automacao. Responda APENAS com JSON valido.\nFormato: {\"actions\":[],\"response\":\"resposta\"}"},
    {"role": "user", "content": "Meu nome eh Carlo"},
    {"role": "assistant", "content": "{\"actions\":[],\"response\":\"Prazer Carlo! Sou o YChatClaw.\"}"},
    {"role": "user", "content": "Voce lembra meu nome?"}
  ]
}' | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('message',{}).get('content','NO RESPONSE')[:500])"

echo ""
echo "=== Test 3: Device command ==="
time curl -s http://localhost:11434/api/chat -d '{
  "model": "qwen3.5:9b",
  "stream": false,
  "options": {"temperature": 0.7, "num_predict": 512},
  "messages": [
    {"role": "system", "content": "Voce eh o YChatClaw. Responda APENAS JSON valido.\nFormato: {\"actions\":[{\"action\":\"send_device_command\",\"params\":{\"deviceId\":\"__first__\",\"commandName\":\"open_url\",\"params\":{\"url\":\"...\"}}}],\"response\":\"texto\"}\nSEMPRE use send_device_command para abrir sites no celular."},
    {"role": "user", "content": "Abre o Google e pesquisa cachorro"}
  ]
}' | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('message',{}).get('content','NO RESPONSE')[:800])"

echo ""
echo "========================================="
echo "Now testing Qwen 3.5:4b for comparison"
echo "========================================="

echo ""
echo "=== Test 4: Same tool calling test with 4B ==="
time curl -s http://localhost:11434/api/chat -d '{
  "model": "qwen3.5:4b",
  "stream": false,
  "options": {"temperature": 0.7, "num_predict": 512},
  "messages": [
    {"role": "system", "content": "Voce eh o YChatClaw, assistente de automacao. Responda APENAS com JSON valido.\nFormato: {\"actions\":[{\"action\":\"TOOL\",\"params\":{}}],\"response\":\"texto\"}\nSe nao precisa executar ferramenta: {\"actions\":[],\"response\":\"resposta\"}\nFerramentas: send_device_command (controla celular), send_whatsapp_message, list_devices"},
    {"role": "user", "content": "Oi, meu nome eh Carlo. Tudo bem?"}
  ]
}' | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('message',{}).get('content','NO RESPONSE')[:500])"

echo ""
echo "=== Test 5: Device command with 4B ==="
time curl -s http://localhost:11434/api/chat -d '{
  "model": "qwen3.5:4b",
  "stream": false,
  "options": {"temperature": 0.7, "num_predict": 512},
  "messages": [
    {"role": "system", "content": "Voce eh o YChatClaw. Responda APENAS JSON valido.\nFormato: {\"actions\":[{\"action\":\"send_device_command\",\"params\":{\"deviceId\":\"__first__\",\"commandName\":\"open_url\",\"params\":{\"url\":\"...\"}}}],\"response\":\"texto\"}\nSEMPRE use send_device_command para abrir sites no celular."},
    {"role": "user", "content": "Abre o Google e pesquisa cachorro"}
  ]
}' | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('message',{}).get('content','NO RESPONSE')[:800])"

echo ""
echo "Done!"
