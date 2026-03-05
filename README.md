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

1. Instale o APK do agente Android nos dispositivos
2. Configure o servidor WebSocket no app
3. O dispositivo receberá um UUID único
4. Gerencie os dispositivos via API ou comandos de chat

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

- Monitorar status de todos os serviços
- Gerar e escanear QR Code do WhatsApp
- Controlar automação web (criar sessões, navegar, clicar, screenshot)
- Visualizar dispositivos conectados
- Enviar mensagens e ver logs

**Credenciais padrão**: `admin` / `ychatclaw123`

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

## Suporte

Para suporte, entre em contato através dos canais oficiais da Yrwen Technology.

---

**Nota**: Este sistema é projetado para controlar apenas dispositivos próprios ou autorizados. O uso indevido é de total responsabilidade do usuário.
