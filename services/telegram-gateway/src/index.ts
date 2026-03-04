import express from 'express';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import dotenv from 'dotenv';
import { Telegraf } from 'telegraf';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL || 'redis://redis:6379');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://ai-service:3002';

// Inicializar bot do Telegram
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');

// Middleware para processar mensagens
bot.on('text', async (ctx) => {
  try {
    const userId = ctx.from.id.toString();
    const chatId = ctx.chat.id.toString();
    const text = ctx.message.text;

    console.log(`[Telegram] Mensagem de ${userId}: ${text}`);

    // Criar ou buscar usuário
    let user = await prisma.user.findUnique({
      where: {
        channelType_externalId: {
          channelType: 'telegram',
          externalId: userId,
        },
      },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          channelType: 'telegram',
          externalId: userId,
          name: ctx.from.first_name || 'Telegram User',
          preferences: {},
          rateLimits: {},
        },
      });
    }

    // Enviar para AI Service
    const response = await fetch(`${AI_SERVICE_URL}/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        userId: user.id,
        channel: 'telegram',
        channelId: chatId,
      }),
    });

    const result = await response.json() as { response?: string; error?: string };

    // Responder ao usuário
    if (result.response) {
      await ctx.reply(result.response);
    } else if (result.error) {
      await ctx.reply('❌ Ocorreu um erro ao processar sua mensagem.');
    }
  } catch (error) {
    console.error('[Telegram] Erro:', error);
    await ctx.reply('❌ Erro ao processar mensagem.');
  }
});

// Comando /start
bot.start((ctx) => {
  ctx.reply('🤖 Olá! Sou o YChatClaw. Envie uma mensagem para controlar seus dispositivos.');
});

// Comando /help
bot.help((ctx) => {
  ctx.reply(`
🤖 *YChatClaw - Comandos disponíveis:*

• "Liste meus dispositivos"
• "Abra YouTube no tablet do quarto"
• "Toque o vídeo de propaganda às 20h"
• "Crie uma imagem de um gato"

Envie uma mensagem em linguagem natural!
  `, { parse_mode: 'Markdown' });
});

// Iniciar bot
bot.launch();

console.log('📱 Telegram Gateway iniciado');

// Graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
