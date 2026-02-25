#!/bin/bash
# Script de deploy do YChatClaw
# Uso: ssh user@SERVIDOR "bash -s" < deploy.sh

set -e

PROJECT_NAME="ychatclaw"
REPO_URL="https://github.com/seu-usuario/ychatclaw.git"
INSTALL_DIR="/opt/$PROJECT_NAME"

echo "🚀 Iniciando deploy do YChatClaw..."

# Atualizar sistema
echo "📦 Atualizando pacotes..."
sudo apt-get update && sudo apt-get upgrade -y

# Instalar Docker se não estiver instalado
if ! command -v docker &> /dev/null; then
    echo "🐳 Instalando Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
fi

# Instalar Docker Compose se não estiver instalado
if ! command -v docker-compose &> /dev/null; then
    echo "🐳 Instalando Docker Compose..."
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
fi

# Clonar ou atualizar repositório
if [ -d "$INSTALL_DIR" ]; then
    echo "📁 Atualizando código..."
    cd $INSTALL_DIR
    git pull origin main
else
    echo "📁 Clonando repositório..."
    sudo mkdir -p $INSTALL_DIR
    sudo git clone $REPO_URL $INSTALL_DIR
    sudo chown -R $USER:$USER $INSTALL_DIR
    cd $INSTALL_DIR
fi

# Criar .env se não existir
if [ ! -f ".env" ]; then
    echo "⚙️ Criando arquivo .env..."
    cp .env.example .env
    echo "⚠️  Por favor, edite o arquivo .env com suas configurações antes de continuar"
    echo "   Execute: nano $INSTALL_DIR/.env"
    exit 1
fi

# Verificar Ollama
echo "🤖 Verificando Ollama..."
if ! curl -s http://localhost:11434/api/tags > /dev/null; then
    echo "⚠️  Ollama não está rodando em http://localhost:11434"
    echo "   Instale e inicie o Ollama antes de continuar"
    exit 1
fi

# Verificar modelos
if ! curl -s http://localhost:11434/api/tags | grep -q "llama3"; then
    echo "📥 Baixando modelo llama3:8b..."
    ollama pull llama3:8b
fi

if ! curl -s http://localhost:11434/api/tags | grep -q "llava"; then
    echo "📥 Baixando modelo llava:13b..."
    ollama pull llava:13b
fi

# Construir e iniciar serviços
echo "🏗️  Construindo containers..."
docker-compose build

echo "🚀 Iniciando serviços..."
docker-compose up -d

# Aguardar PostgreSQL
sleep 5

# Executar migrations
echo "🗄️  Executando migrations..."
docker-compose exec -T api-server npx prisma migrate deploy || true

echo ""
echo "✅ Deploy concluído!"
echo ""
echo "📊 Status dos serviços:"
docker-compose ps

echo ""
echo "📝 Logs:"
echo "   docker-compose logs -f"
echo ""
echo "🌐 Acesse:"
echo "   API: http://localhost:3000"
echo "   WebSocket: ws://localhost:3001"
echo ""
