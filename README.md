# YChatClaw

Plataforma de automação com IA inspirada no OpenClaw, projetada para controlar 20–50+ dispositivos Android via WhatsApp, Telegram e Discord, utilizando IA local (Ollama) para interpretação de comandos.

## Visão Geral

YChatClaw é um sistema de automação distribuído que permite controlar dispositivos Android através de comandos de linguagem natural enviados por mensagens. O sistema interpreta as mensagens usando IA local (Ollama) e executa ações nos dispositivos conectados.

## Arquitetura

### Serviços

- **api-server**: REST API para gerenciamento de dispositivos, grupos, mídia e usuários
- **websocket-server**: Conexões WebSocket com dispositivos Android (nodes)
- **worker**: Processamento de filas BullMQ para execução de comandos
- **ai-service**: Integração com Ollama para interpretação de comandos
- **whatsapp-gateway**: Integração WhatsApp via Baileys
- **telegram-gateway**: Integração Telegram via telegraf
- **discord-gateway**: Integração Discord via discord.js
- **redis**: Fila de tarefas e cache
- **postgres**: Banco de dados principal

### Fluxo de Comando

```
Canal (WhatsApp/Telegram/Discord) → Gateway → AI Service (Ollama) → Skill → Worker → WebSocket → Dispositivo
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

### Comandos Suportados

- `open_app` - Abrir aplicativo
- `open_url` - Abrir URL no navegador
- `open_webview` - Abrir WebView interno
- `play_video` - Reproduzir vídeo
- `display_image` - Exibir imagem
- `slideshow` - Apresentação de slides
- `input_text` - Inserir texto
- `capture_screenshot` - Capturar tela

## Configuração WhatsApp

O gateway WhatsApp usa Baileys. Na primeira execução:

1. Um QR code será exibido nos logs
2. Escaneie com seu WhatsApp
3. A sessão será salva em `./sessions/whatsapp`

```bash
docker-compose logs -f whatsapp-gateway
```

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
├── devices/       # Comandos de dispositivos
├── scheduling/    # Agendamento
├── media/         # Geração e processamento de mídia
└── external/      # Integrações externas
```

Cada Tool é uma função que a IA pode chamar baseada na intenção do usuário.

## Estrutura do Projeto

```
ychatclaw/
├── services/              # Microserviços
│   ├── api-server/       # REST API
│   ├── websocket-server/ # WebSocket para nodes
│   ├── ai-service/       # Integração Ollama
│   ├── worker/           # BullMQ worker
│   ├── whatsapp-gateway/ # WhatsApp Baileys
│   ├── telegram-gateway/ # Telegram bot
│   └── discord-gateway/  # Discord bot
├── android-agent/        # Agente Android (Kotlin)
├── shared/               # Código compartilhado
├── tools/                # Sistema de Skills
├── scripts/              # Scripts de deploy
├── docker/               # Dockerfiles
├── media/                # Armazenamento de mídia
└── docs/                 # Documentação
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
