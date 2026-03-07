# YChatClaw

Plataforma de automação com IA inspirada no OpenClaw, projetada para controlar 20–50+ dispositivos Android via WhatsApp, Telegram e Discord, utilizando IA local (Ollama) para interpretação de comandos.

## Visão Geral

YChatClaw é um sistema de automação distribuído que permite controlar dispositivos Android através de comandos de linguagem natural enviados por mensagens. O sistema interpreta as mensagens usando IA local (Ollama) e executa ações nos dispositivos conectados.

## Arquitetura

### Serviços

- **api-server**: REST API para gerenciamento de dispositivos, grupos, mídia e usuários
- **websocket-server**: Conexões WebSocket com dispositivos Android (nodes)
- **worker**: Processamento de filas BullMQ para execução de comandos
- **ai-service**: Integração com Ollama para interpretação de comandos + 18 tools de automação web
- **web-automation**: Automação web via Puppeteer (headless Chrome) - navegar, clicar, preencher, screenshot
- **whatsapp-gateway**: Integração WhatsApp via whatsapp-web.js
- **telegram-gateway**: Integração Telegram via telegraf
- **discord-gateway**: Integração Discord via discord.js
- **redis**: Fila de tarefas e cache
- **postgres**: Banco de dados principal

### Fluxo de Comando

```
Canal (WhatsApp/Telegram/Discord) → Gateway → AI Service (Ollama) → Tool Execution → Resultado
                                                                          ↓
                                                              ┌─────────────────────┐
                                                              │ Web Automation       │ → Puppeteer (navegar, clicar, screenshot)
                                                              │ Device Commands      │ → Worker → WebSocket → Dispositivo Android
                                                              │ Direct Response      │ → Resposta natural em PT-BR
                                                              └─────────────────────┘
```

## Requisitos

### Servidor

- Ubuntu 22.04 (ou similar)
- Docker e Docker Compose
- Ollama instalado e rodando em http://127.0.0.1:11434
- Modelos: llama3:8b e llava:13b

### Hardware Recomendado

- CPU: 12+ cores
- RAM: 48GB+ (para Ollama e múltiplos serviços)
- Armazenamento: SSD 100GB+

## Instalação

### 1. Clone o repositório

```bash
git clone https://github.com/seu-usuario/ychatclaw.git
cd ychatclaw
```

### 2. Configure as variáveis de ambiente

```bash
cp .env.example .env
nano .env  # Edite com suas configurações
```

### 3. Inicie os serviços

```bash
docker-compose up -d
```

### 4. Rode as migrations

```bash
docker-compose exec api-server npx prisma migrate deploy
```

### 5. Verifique se está tudo funcionando

```bash
docker-compose ps
docker-compose logs -f
```

## Deploy Automático

Para deploy em um servidor remoto:

```bash
ssh user@SEU_SERVIDOR "bash -s" < scripts/deploy.sh
```

Ou usando o script de setup:

```bash
bash scripts/setup-server.sh
```

## Configuração Ollama

O sistema utiliza Ollama já existente na VPS. Certifique-se de que:

1. Ollama está rodando em http://127.0.0.1:11434
2. Os modelos estão instalados:

```bash
ollama list  # Verificar se llama3:8b e llava:13b estão disponíveis
```

Se necessário, baixe os modelos:

```bash
ollama pull llama3:8b
ollama pull llava:13b
```

## Conexão dos Dispositivos Android

### Como gerar o APK

1. Abra o **Android Studio**
2. Importe a pasta `android-agent/`
3. Vá em **Build > Build Bundle(s) / APK(s) > Build APK(s)**
4. O APK fica em `android-agent/app/build/outputs/apk/debug/app-debug.apk`

### Como conectar um dispositivo

1. Instale o APK no dispositivo Android (minSdk 24 = Android 7.0+)
2. Abra o app e configure a URL do servidor: `ws://SEU_SERVIDOR:3001`
3. Clique em **Iniciar** — o dispositivo se registra automaticamente com UUID único
4. O dispositivo aparece no Dashboard na seção "Controle de Dispositivos"
5. Envie comandos pelo Dashboard ou via WhatsApp/AI

### Comandos de Dispositivo

- `open_app` - Abrir aplicativo
- `open_url` - Abrir URL no navegador
- `open_webview` - Abrir WebView interno
- `play_video` - Reproduzir vídeo
- `display_image` - Exibir imagem
- `slideshow` - Apresentação de slides
- `get_device_info` - Informações do dispositivo

### Comandos de Automação Web (Puppeteer)

- `web_open_browser` - Abrir navegador e navegar para URL
- `web_navigate` - Navegar para outra página
- `web_click` / `web_click_text` - Clicar em elementos por seletor CSS ou texto
- `web_type` - Digitar texto em campos
- `web_login` - Login automático (usuário + senha)
- `web_fill_form` - Preencher formulários completos
- `web_screenshot` - Capturar screenshot da página
- `web_get_content` - Analisar conteúdo (texto, links, botões, inputs)
- `web_scroll` - Rolar página
- `web_select` / `web_checkbox` - Selecionar opções e checkboxes
- `web_execute_js` - Executar JavaScript customizado
- `web_hover` / `web_press_key` - Hover e teclas
- `web_dropdown_options` - Listar opções de dropdown
- `web_close_browser` - Fechar sessão

### Comandos de Automação Web no Android (WebView)

- `web_navigate` - Navegar no WebView
- `web_click` - Clicar via JavaScript injection
- `web_type` - Digitar via JavaScript injection
- `web_screenshot` - Capturar WebView
- `web_get_content` - Extrair conteúdo da página
- `web_login` - Login automático no WebView

## Dashboard

Acesse o dashboard em `http://SEU_SERVIDOR:3000/dashboard` para:

- **Status dos Serviços** — monitorar todos os 5 serviços em tempo real
- **WhatsApp Gateway** — gerar QR Code, conectar/desconectar, enviar mensagens
- **AI Agent** — testar comandos para a IA, ver modelos Ollama disponíveis
- **Controle de Dispositivos** — listar dispositivos Android, enviar comandos (abrir URL, app, screenshot)
- **Web Automation** — criar sessões de navegador, navegar, clicar, digitar, fazer login, screenshot
- **Logs do Sistema** — acompanhar eventos em tempo real

**Credenciais padrão**: `admin` / `ychatclaw123`

### Comandos via WhatsApp / AI

O agente IA reconhece linguagem natural em português. Exemplos:

| Mensagem | Ação |
|----------|------|
| "Abre o site https://google.com e tira um print" | Abre navegador + screenshot |
| "Rola a página e clica em Login" | Scroll + click por texto |
| "Abre o YouTube no celular" | Envia `open_app` para dispositivo Android |
| "Abre https://site.com no dispositivo" | Envia `open_url` para dispositivo |
| "Quais dispositivos estão conectados?" | Lista dispositivos |
| "Manda oi pro 5511999999999" | Envia mensagem WhatsApp |

## Configuração WhatsApp

O gateway WhatsApp usa whatsapp-web.js. Na primeira execução:

1. Acesse o dashboard e clique em "Gerar QR Code"
2. Escaneie com seu WhatsApp
3. A sessão será salva em `./sessions/whatsapp`

O agente IA responde automaticamente via WhatsApp em português do Brasil, executando ferramentas quando solicitado e enviando screenshots como imagens.

## Uso

### Comandos de Exemplo

**Listar dispositivos:**
```
Quais dispositivos estão conectados?
```

**Enviar comando:**
```
Abra o YouTube em todos os tablets do restaurante
```

**Agendar tarefa:**
```
Todo dia às 20h, toque o vídeo de propaganda no grupo tablets
```

**Gerar mídia:**
```
Crie uma imagem de um gato astronauta
```

## Sistema de Tools/Skills

YChatClaw implementa um sistema modular de Tools inspirado no OpenClaw:

```
tools/
├── registry.ts              # Registro central de tools
├── web-automation-tools.ts  # 18 tools de automação web (Puppeteer)
├── devices/                 # Comandos de dispositivos
├── scheduling/              # Agendamento
└── media/                   # Geração e processamento de mídia
```

Cada Tool é uma função que a IA pode chamar baseada na intenção do usuário.
A IA suporta execução multi-step (várias ferramentas em sequência numa única mensagem).

## Estrutura do Projeto

```
ychatclaw/
├── services/              # Microserviços
│   ├── api-server/       # REST API + Dashboard
│   ├── websocket-server/ # WebSocket para nodes
│   ├── ai-service/       # Integração Ollama + Tools
│   ├── web-automation/   # Puppeteer (headless Chrome)
│   ├── worker/           # BullMQ worker
│   ├── whatsapp-gateway/ # WhatsApp (whatsapp-web.js)
│   ├── telegram-gateway/ # Telegram bot
│   └── discord-gateway/  # Discord bot
├── android-agent/        # Agente Android (Kotlin)
│   ├── app/src/main/java/com/ychatclaw/agent/
│   │   ├── MainActivity.kt       # UI principal
│   │   ├── WebSocketManager.kt   # Conexão WebSocket
│   │   ├── CommandExecutor.kt    # Executor de comandos + web automation
│   │   ├── WebViewActivity.kt    # WebView com JS injection
│   │   ├── YChatClawService.kt   # Foreground service
│   │   └── DeviceIdManager.kt    # UUID único por dispositivo
├── shared/               # Código compartilhado (Prisma)
├── scripts/              # Scripts de deploy e build APK
├── docker/               # Dockerfiles
├── media/                # Armazenamento de mídia
└── sessions/             # Sessões WhatsApp persistentes
```

## Estabilidade

O sistema é projetado para operar 20-100+ dispositivos simultaneamente:

- Broadcast em lotes configuráveis
- Retry automático de comandos
- Heartbeat com timeout de 90s
- Rate limiting por usuário
- Circuit breakers para APIs externas

## Contribuição

Contribuições são bem-vindas! Por favor, leia nosso guia de contribuição antes de submeter PRs.

## Licença

MIT License - veja [LICENSE](LICENSE) para detalhes.

## OpenClaw — Assistente IA Pessoal

O servidor também roda o [OpenClaw](https://github.com/openclaw/openclaw), um assistente IA pessoal open-source que utiliza os mesmos modelos Ollama do YChatClaw.

### Acesso

| Recurso | URL |
|---------|-----|
| Control UI | `http://167.86.84.197:18789` |
| WebSocket | `ws://167.86.84.197:18789` |
| Browser Control | `http://127.0.0.1:18791` (local) |

**Autenticação**: modo `password` — senha: `openclaw`

### Configuração

- **Versão**: OpenClaw v2026.3.2
- **Node.js**: v22.22.1 (via nvm)
- **Modelo**: `ollama/llama3:8b` (Ollama local em `127.0.0.1:11434`)
- **Porta Gateway**: 18789 (não conflita com YChatClaw: 3000-3005)
- **Porta Browser**: 18791
- **Config**: `~/.openclaw/openclaw.json`
- **Logs**: `/tmp/openclaw/openclaw-YYYY-MM-DD.log`

### Gerenciamento (via SSH)

```bash
# Status do gateway
systemctl --user status openclaw-gateway

# Reiniciar
systemctl --user restart openclaw-gateway

# Parar
systemctl --user stop openclaw-gateway

# Ver logs
journalctl --user -u openclaw-gateway -f

# Listar modelos disponíveis
source ~/.nvm/nvm.sh && openclaw models list

# Alterar modelo
source ~/.nvm/nvm.sh && openclaw config set agents.defaults.model.primary ollama/MODELO
systemctl --user restart openclaw-gateway
```

### Portas em uso

| Porta | Serviço |
|-------|---------|
| 3000 | API Server / Dashboard (YChatClaw) |
| 3001 | WebSocket Server WS (YChatClaw) |
| 3002 | AI Service (YChatClaw) |
| 3003 | WhatsApp Gateway (YChatClaw) |
| 3004 | Web Automation (YChatClaw) |
| 3005 | WebSocket HTTP API (YChatClaw) |
| 11434 | Ollama (host) |
| 11435 | Ollama (Docker) |
| 18789 | OpenClaw Gateway |
| 18791 | OpenClaw Browser Control |

## Suporte

Para suporte, entre em contato através dos canais oficiais da Yrwen Technology.

---

**Nota**: Este sistema é projetado para controlar apenas dispositivos próprios ou autorizados. O uso indevido é de total responsabilidade do usuário.
