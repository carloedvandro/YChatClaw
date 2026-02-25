#!/bin/bash
# Script de setup do servidor YChatClaw

set -e

echo "🔧 Setup do Servidor YChatClaw"
echo "==============================="

# Detectar SO
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="linux"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macos"
else
    echo "❌ Sistema operacional não suportado"
    exit 1
fi

# Instalar dependências
echo "📦 Instalando dependências..."

if [ "$OS" == "linux" ]; then
    sudo apt-get update
    sudo apt-get install -y curl wget git vim nano
fi

# Instalar Ollama se não existir
if ! command -v ollama &> /dev/null; then
    echo "🤖 Instalando Ollama..."
    curl -fsSL https://ollama.com/install.sh | sh
    
    # Aguardar Ollama iniciar
    sleep 5
    
    # Baixar modelos
    echo "📥 Baixando modelos..."
    ollama pull llama3:8b
    ollama pull llava:13b
else
    echo "✅ Ollama já instalado"
fi

# Verificar Ollama está rodando
echo "🩺 Verificando Ollama..."
if ! curl -s http://localhost:11434/api/tags > /dev/null; then
    echo "⚠️  Iniciando Ollama..."
    ollama serve &
    sleep 5
fi

# Instalar Docker
echo "🐳 Verificando Docker..."
if ! command -v docker &> /dev/null; then
    echo "📥 Instalando Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
    echo "🔄 Por favor, faça logout e login novamente para usar Docker sem sudo"
else
    echo "✅ Docker já instalado"
fi

# Instalar Docker Compose
if ! command -v docker-compose &> /dev/null; then
    echo "📥 Instalando Docker Compose..."
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
fi

echo ""
echo "✅ Setup concluído!"
echo ""
echo "🚀 Para fazer o deploy, execute:"
echo "   bash scripts/deploy.sh"
echo ""
