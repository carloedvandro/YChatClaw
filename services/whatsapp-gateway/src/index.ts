import express from 'express';
import { Client, LocalAuth } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3003;
const redis = new Redis(process.env.REDIS_URL);

app.use(express.json());

async function startWhatsApp() {
  const client = new Client({
    authStrategy: new LocalAuth({
      dataPath: process.env.WHATSAPP_SESSION_PATH || './sessions'
    }),
    puppeteer: {
      headless: 'new',
      executablePath: '/usr/bin/chromium',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    }
  });

  client.on('qr', (qr) => {
    console.log('📱 QR Code gerado! Escaneie com WhatsApp:');
    qrcode.generate(qr, { small: false });
  });

  client.on('ready', () => {
    console.log('✅ WhatsApp conectado com sucesso!');
  });

  client.on('disconnected', (reason) => {
    console.log('❌ WhatsApp desconectado:', reason);
  });

  client.on('message', async (msg) => {
    if (msg.fromMe) return;

    const text = msg.body;
    if (!text) return;

    // Enviar para AI Service
    try {
      await redis.lpush('messages:queue', JSON.stringify({
        type: 'whatsapp',
        from: msg.from,
        text,
        timestamp: new Date().toISOString(),
      }));
    } catch (err) {
      console.error('Erro ao enviar mensagem para fila:', err);
    }
  });

  await client.initialize();
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'whatsapp-gateway' });
});

app.get('/logs', (req, res) => {
  res.json({ logs: 'WhatsApp Gateway logs placeholder' });
});

app.listen(port, () => {
  console.log(`🚀 WhatsApp Gateway rodando na porta ${port}`);
  startWhatsApp();
});
