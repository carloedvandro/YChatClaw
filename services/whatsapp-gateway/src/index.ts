import express from 'express';
import { makeWASocket, useMultiFileAuthState } from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3003;
const redis = new Redis(process.env.REDIS_URL);

app.use(express.json());

async function startWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState(process.env.WHATSAPP_SESSION_PATH || './sessions');
  
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
  });

  sock.ev.on('connection.update', (update) => {
    const { qr, connection, lastDisconnect } = update;
    console.log('Connection update:', { connection, hasQR: !!qr });
    
    if (qr) {
      console.log('📱 QR Code gerado! Escaneie com WhatsApp:');
      qrcode.generate(qr, { small: true });
    }
    
    if (connection === 'open') {
      console.log('✅ WhatsApp conectado com sucesso!');
    }
    
    if (connection === 'close') {
      console.log('❌ Conexão fechada:', lastDisconnect?.error);
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const text = msg.message.conversation || msg.message.extendedTextMessage?.text;
    if (!text) return;

    // Enviar para AI Service
    try {
      await redis.lpush('messages:queue', JSON.stringify({
        type: 'whatsapp',
        from: msg.key.remoteJid,
        text,
        timestamp: new Date().toISOString(),
      }));
    } catch (err) {
      console.error('Erro ao enviar mensagem para fila:', err);
    }
  });
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'whatsapp-gateway' });
});

app.listen(port, () => {
  console.log(`🚀 WhatsApp Gateway rodando na porta ${port}`);
  startWhatsApp();
});
