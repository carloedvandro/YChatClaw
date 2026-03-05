import express from 'express';
import { makeWASocket, makeInMemoryStore, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import fs from 'fs';
import path from 'path';
import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3003;
const sessionPath = process.env.WHATSAPP_SESSION_PATH || './sessions';
const redis = new Redis(process.env.REDIS_URL);

// Garantir que o diretório de sessões exista
if (!fs.existsSync(sessionPath)) {
  fs.mkdirSync(sessionPath, { recursive: true });
}

let qrCode: string | null = null;
let connectionStatus: string = 'disconnected';
let qrCodeTimestamp: string | null = null;

// Salvar QR Code em arquivo para compartilhamento
function saveQRCode(qr: string) {
  qrCode = qr;
  qrCodeTimestamp = new Date().toISOString();
  
  // Salvar em arquivo para leitura externa
  const qrFile = path.join(sessionPath, 'qrcode.txt');
  fs.writeFileSync(qrFile, qr);
  
  console.log(' QR Code salvo em:', qrFile);
}

// Limpar QR Code
function clearQRCode() {
  qrCode = null;
  qrCodeTimestamp = null;
  
  // Remover arquivo
  const qrFile = path.join(sessionPath, 'qrcode.txt');
  if (fs.existsSync(qrFile)) {
    fs.unlinkSync(qrFile);
  }
}

async function startWhatsApp() {
  try {
    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(` Usando WA v${version.join('.')}, isLatest: ${isLatest}`);

    const store = makeInMemoryStore({});
    
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    
    const client = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys: state.keys,
      },
      printQRInTerminal: true,
      qrMaxRetries: 5,
      browser: ['YChatClaw', 'Chrome', '120.0.0.0'],
      syncFullHistory: false,
      markOnlineOnConnect: true,
      connectTimeoutMs: 60000,
      retryRequestDelayMs: 3000,
      maxMsgRetryCount: 3,
      shouldIgnoreJid: (jid) => jid.endsWith('@newsletter') || jid.endsWith('@broadcast'),
      shouldSyncHistoryMessage: (msg) => !msg.key.fromMe,
      generateHighQualityLinkPreview: true,
      getMessage: async (key) => {
        const msg = await store.loadMessage(key.remoteJid!, key.id!);
        return msg?.message || undefined;
      },
    });

    store.bind(client.ev);

    client.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr) {
        console.log(' QR Code recebido!');
        qrcode.generate(qr, { small: false });
        saveQRCode(qr);
        connectionStatus = 'qr_ready';
      }
      
      if (connection === 'close') {
        const shouldReconnect = (lastDisconnect?.error as any)?.output?.statusCode !== DisconnectReason.loggedOut;
        console.log(' Conexão fechada:', shouldReconnect ? 'Reconectando...' : 'Não reconectando');
        
        if (shouldReconnect) {
          connectionStatus = 'reconnecting';
          startWhatsApp();
        } else {
          connectionStatus = 'disconnected';
          clearQRCode();
        }
      } else if (connection === 'open') {
        console.log(' WhatsApp conectado com sucesso!');
        connectionStatus = 'connected';
        clearQRCode();
      }
    });

    client.ev.on('creds.update', saveCreds);

    client.ev.on('messages.upsert', async (m) => {
      const message = m.messages[0];
      if (!message.message) return;
      
      console.log(' Mensagem recebida:', message.key.remoteJid);
      
      // Aqui você pode processar a mensagem
      // Por exemplo, enviar para uma fila ou processar diretamente
      try {
        await redis.lpush('messages:queue', JSON.stringify({
          type: 'whatsapp',
          from: message.key.remoteJid,
          text: message.message,
          timestamp: new Date().toISOString(),
        }));
      } catch (err) {
        console.error('Erro ao enviar mensagem para fila:', err);
      }
    });

    await client.initialize();
  } catch (error) {
    console.error(' Erro ao iniciar WhatsApp:', error);
    connectionStatus = 'error';
  }
}

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'whatsapp-gateway' });
});

app.get('/logs', (req, res) => {
  res.json({ logs: 'WhatsApp Gateway logs placeholder' });
});

app.get('/qrcode', (req, res) => {
  try {
    const qrFile = path.join(sessionPath, 'qrcode.txt');
    
    if (fs.existsSync(qrFile)) {
      const qrData = fs.readFileSync(qrFile, 'utf8');
      res.json({
        qr: qrData,
        status: 'found',
        timestamp: qrCodeTimestamp,
        connectionStatus: connectionStatus
      });
    } else {
      res.json({
        qr: null,
        status: 'not_found',
        message: 'QR Code não encontrado. Verifique se o WhatsApp está aguardando conexão.',
        connectionStatus: connectionStatus
      });
    }
  } catch (error) {
    res.json({
      qr: null,
      status: 'error',
      message: 'Erro ao ler QR Code',
      error: (error as Error).message,
      connectionStatus: connectionStatus
    });
  }
});

app.get('/status', (req, res) => {
  res.json({
    connectionStatus: connectionStatus,
    qrAvailable: qrCode !== null,
    qrTimestamp: qrCodeTimestamp,
    timestamp: new Date().toISOString()
  });
});

app.listen(port, () => {
  console.log(`🚀 WhatsApp Gateway rodando na porta ${port}`);
  startWhatsApp();
});
