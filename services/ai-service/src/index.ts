import express from 'express';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import dotenv from 'dotenv';
import { OllamaClient } from './ollama-client';
import { ToolRegistry } from './tools/registry';
import { processMessage } from './message-processor';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;

const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL || 'redis://redis:6379');

// Inicializar cliente Ollama
const ollamaClient = new OllamaClient({
  baseUrl: process.env.OLLAMA_URL || 'http://host.docker.internal:11434',
  model: process.env.OLLAMA_MODEL || 'llama3:8b',
  visionModel: process.env.OLLAMA_VISION_MODEL || 'llava:13b',
});

// Inicializar registry de tools
const toolRegistry = new ToolRegistry();

app.use(express.json({ limit: '10mb' }));

// Endpoint principal para processar mensagens
app.post('/process', async (req, res) => {
  try {
    const { message, userId, channel, channelId, sessionId } = req.body;

    if (!message || !userId || !channel) {
      return res.status(400).json({
        error: 'Parâmetros obrigatórios: message, userId, channel',
      });
    }

    const result = await processMessage({
      message,
      userId,
      channel,
      channelId,
      sessionId,
      prisma,
      redis,
      ollamaClient,
      toolRegistry,
    });

    res.json(result);
  } catch (error) {
    console.error('Erro ao processar mensagem:', error);
    res.status(500).json({
      error: 'Erro ao processar mensagem',
      details: error instanceof Error ? error.message : undefined,
    });
  }
});

// Endpoint para obter tools disponíveis
app.get('/tools', (req, res) => {
  res.json({
    tools: toolRegistry.getAllTools(),
  });
});

// Health check
app.get('/health', async (req, res) => {
  try {
    const ollamaHealth = await ollamaClient.healthCheck();
    res.json({
      status: ollamaHealth ? 'healthy' : 'unhealthy',
      ollama: ollamaHealth ? 'connected' : 'disconnected',
    });
  } catch (error) {
    res.status(503).json({ status: 'unhealthy', ollama: 'disconnected' });
  }
});

app.listen(PORT, () => {
  console.log(`🤖 AI Service rodando na porta ${PORT}`);
  console.log(`📡 Conectando ao Ollama em: ${process.env.OLLAMA_URL}`);
});
