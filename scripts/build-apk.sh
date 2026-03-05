#!/bin/bash
# Build YChatClaw Android Agent APK using Docker
# Usage: ./scripts/build-apk.sh

set -e

echo "=== YChatClaw Android Agent APK Builder ==="
echo ""

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUTPUT_DIR="$PROJECT_ROOT/android-agent/build/outputs"

echo "Building APK via Docker..."
docker build \
  -f "$PROJECT_ROOT/docker/Dockerfile.android-builder" \
  -t ychatclaw-android-builder \
  "$PROJECT_ROOT"

echo ""
echo "Extracting APK..."
mkdir -p "$OUTPUT_DIR"

# Copiar APK do container
CONTAINER_ID=$(docker create ychatclaw-android-builder)
docker cp "$CONTAINER_ID:/app/app/build/outputs/apk/debug/app-debug.apk" "$OUTPUT_DIR/ychatclaw-agent.apk" 2>/dev/null || \
docker cp "$CONTAINER_ID:/app/app/build/outputs/apk/release/app-release.apk" "$OUTPUT_DIR/ychatclaw-agent.apk" 2>/dev/null || \
echo "APK nao encontrado no container. Verifique os logs de build."
docker rm "$CONTAINER_ID" > /dev/null

if [ -f "$OUTPUT_DIR/ychatclaw-agent.apk" ]; then
  echo ""
  echo "APK gerado com sucesso!"
  echo "Caminho: $OUTPUT_DIR/ychatclaw-agent.apk"
  echo "Tamanho: $(du -h "$OUTPUT_DIR/ychatclaw-agent.apk" | cut -f1)"
  echo ""
  echo "Para instalar no dispositivo via ADB:"
  echo "  adb install $OUTPUT_DIR/ychatclaw-agent.apk"
else
  echo "Erro: APK nao foi gerado."
  exit 1
fi
