import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import dotenv from 'dotenv';
import { Client, GatewayIntentBits, Events } from 'discord.js';

dotenv.config();

const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL || 'redis://redis:6379');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://ai-service:3002';

// Inicializar cliente Discord
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once(Events.ClientReady, () => {
  console.log(`🤖 Discord Bot conectado como ${client.user?.tag}`);
});

client.on(Events.MessageCreate, async (message) => {
  // Ignorar mensagens do próprio bot
  if (message.author.bot) return;

  // Ignorar mensagens que não mencionam o bot (opcional)
  // if (!message.mentions.has(client.user)) return;

  try {
    const userId = message.author.id;
    const channelId = message.channel.id;
    const guildId = message.guild?.id;
    const text = message.content.replace(/<@!?\d+>/g, '').trim(); // Remover menções

    console.log(`[Discord] Mensagem de ${userId}: ${text}`);

    // Criar ou buscar usuário
    let user = await prisma.user.findUnique({
      where: {
        channelType_externalId: {
          channelType: 'discord',
          externalId: userId,
        },
      },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          channelType: 'discord',
          externalId: userId,
          name: message.author.username,
          preferences: { guildId },
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
        channel: 'discord',
        channelId,
      }),
    });

    const result = await response.json();

    // Responder no Discord
    if (result.response) {
      await message.reply(result.response);
    } else if (result.error) {
      await message.reply('❌ Ocorreu um erro ao processar sua mensagem.');
    }
  } catch (error) {
    console.error('[Discord] Erro:', error);
    await message.reply('❌ Erro ao processar mensagem.');
  }
});

// Login
client.login(process.env.DISCORD_BOT_TOKEN);

console.log('💬 Discord Gateway iniciado');
