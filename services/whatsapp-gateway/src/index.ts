import express from 'express';
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

let connectionStatus: string = 'disconnected';
let qrCode: string | null = null;
let qrCodeTimestamp: string | null = null;

// Simular QR Code para teste
function generateMockQRCode() {
  const mockQR = `
╔════════════════════════════════════════╗
║█████████████████████████████████████████║
║████ ▄▄▄▄▄ █▀ ▄███▄▀▄▄▄▄▄▄▄ ███ █████║
║████ █   █ █▀▀▀█▄▀▀▀▀▀▀▀▀▀ ███ █████║
║████ █▄▄▄█ █▀ ▀▄▄▄▄▄▀▀▄▄▄▄▄ ███ █████║
║████▄▄▄▄▄▄▄█▄█▄███▄▄▄█▄▄▄▄▄▄▄████║
║████▄▄ ▄▄▄▀▄▄▀▀▄▄▀▀▀▄▀▀▄▄▀▄▄████║
║████▄▀▄▄▄▄▀▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄████║
║████▀▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄████║
║████▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄████║
║████▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄████║
║████▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄████║
║████▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄████║
║████▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄████║
║████▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄████║
║████▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄████║
║████▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄████║
║████▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄████║
║████▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄████║
║████▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄████║
║████▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄████║
║████▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄████║
║████▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄████║
║█████████████████████████████████████████║
╚════════════════════════════════════════╝
  `;
  
  qrCode = mockQR;
  qrCodeTimestamp = new Date().toISOString();
  connectionStatus = 'qr_ready';
  
  // Salvar em arquivo
  const qrFile = path.join(sessionPath, 'qrcode.txt');
  fs.writeFileSync(qrFile, mockQR);
  
  console.log('📱 QR Code simulado gerado!');
  return mockQR;
}

// Limpar QR Code
function clearQRCode() {
  qrCode = null;
  qrCodeTimestamp = null;
  connectionStatus = 'disconnected';
  
  const qrFile = path.join(sessionPath, 'qrcode.txt');
  if (fs.existsSync(qrFile)) {
    fs.unlinkSync(qrFile);
  }
}

// Simular conexão
function simulateConnection() {
  setTimeout(() => {
    connectionStatus = 'connected';
    clearQRCode();
    console.log('✅ WhatsApp conectado (simulado)!');
  }, 30000); // 30 segundos
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
        message: 'QR Code não encontrado. Clique em "Gerar QR Code" para criar um.',
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

// Endpoint para gerar QR Code
app.post('/generate-qr', (req, res) => {
  try {
    const qr = generateMockQRCode();
    simulateConnection();
    
    res.json({
      qr: qr,
      status: 'generated',
      timestamp: qrCodeTimestamp,
      connectionStatus: connectionStatus,
      message: 'QR Code gerado com sucesso! Escaneie com WhatsApp.'
    });
  } catch (error) {
    res.json({
      qr: null,
      status: 'error',
      message: 'Erro ao gerar QR Code',
      error: (error as Error).message
    });
  }
});

app.listen(port, () => {
  console.log(`🚀 WhatsApp Gateway rodando na porta ${port}`);
  console.log('📱 Modo simulado - QR Code disponível via API');
});
