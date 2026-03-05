import express from 'express';
import fs from 'fs';
import path from 'path';
import Redis from 'ioredis';
import QRCode from 'qrcode';
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
let qrCodeImage: string | null = null;
let qrCodeTimestamp: string | null = null;
let waClient: any = null;
let isInitializing: boolean = false;

// Inicializar cliente WhatsApp real
async function initWhatsAppClient(): Promise<void> {
  if (isInitializing) {
    console.log('⏳ WhatsApp já está inicializando...');
    return;
  }
  
  isInitializing = true;
  connectionStatus = 'initializing';
  
  try {
    // Importar whatsapp-web.js dinamicamente
    const { Client, LocalAuth } = require('whatsapp-web.js');
    
    // Destruir cliente anterior se existir
    if (waClient) {
      try {
        await waClient.destroy();
      } catch (e) {
        console.log('⚠️ Erro ao destruir cliente anterior:', (e as Error).message);
      }
    }
    
    console.log('🔄 Inicializando cliente WhatsApp...');
    
    waClient = new Client({
      authStrategy: new LocalAuth({
        dataPath: sessionPath
      }),
      puppeteer: {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-gpu'
        ],
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser'
      }
    });
    
    // Evento: QR Code recebido do WhatsApp
    waClient.on('qr', async (qr: string) => {
      console.log('📱 QR Code real recebido do WhatsApp!');
      
      try {
        // Converter string QR para imagem PNG base64
        qrCodeImage = await QRCode.toDataURL(qr, {
          width: 300,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          },
          errorCorrectionLevel: 'L'
        });
        
        qrCodeTimestamp = new Date().toISOString();
        connectionStatus = 'qr_ready';
        
        // Salvar em arquivo
        const qrFile = path.join(sessionPath, 'qrcode.txt');
        fs.writeFileSync(qrFile, qrCodeImage);
        
        console.log('✅ QR Code WhatsApp convertido para imagem PNG!');
      } catch (error) {
        console.error('❌ Erro ao converter QR Code:', (error as Error).message);
      }
    });
    
    // Evento: Cliente pronto (autenticado)
    waClient.on('ready', () => {
      console.log('✅ WhatsApp conectado com sucesso!');
      connectionStatus = 'connected';
      qrCodeImage = null;
      qrCodeTimestamp = null;
      isInitializing = false;
      
      // Limpar arquivo QR
      const qrFile = path.join(sessionPath, 'qrcode.txt');
      if (fs.existsSync(qrFile)) fs.unlinkSync(qrFile);
    });
    
    // Evento: Autenticado
    waClient.on('authenticated', () => {
      console.log('🔐 WhatsApp autenticado!');
      connectionStatus = 'authenticated';
    });
    
    // Evento: Falha na autenticação
    waClient.on('auth_failure', (msg: string) => {
      console.error('❌ Falha na autenticação:', msg);
      connectionStatus = 'auth_failure';
      isInitializing = false;
    });
    
    // Evento: Desconectado
    waClient.on('disconnected', (reason: string) => {
      console.log('📵 WhatsApp desconectado:', reason);
      connectionStatus = 'disconnected';
      qrCodeImage = null;
      waClient = null;
      isInitializing = false;
    });
    
    // Inicializar o cliente
    await waClient.initialize();
    
  } catch (error) {
    console.error('❌ Erro ao inicializar WhatsApp:', (error as Error).message);
    connectionStatus = 'error';
    isInitializing = false;
    throw error;
  }
}

// Limpar QR Code
function clearQRCode() {
  qrCodeImage = null;
  qrCodeTimestamp = null;
  
  const qrFile = path.join(sessionPath, 'qrcode.txt');
  if (fs.existsSync(qrFile)) {
    fs.unlinkSync(qrFile);
  }
}

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'whatsapp-gateway' });
});

app.get('/logs', (req, res) => {
  res.json({ logs: 'WhatsApp Gateway logs' });
});

app.get('/qrcode', (req, res) => {
  try {
    if (qrCodeImage) {
      res.json({
        qr: qrCodeImage,
        status: 'found',
        timestamp: qrCodeTimestamp,
        connectionStatus: connectionStatus
      });
    } else {
      res.json({
        qr: null,
        status: 'not_found',
        message: 'QR Code não disponível. Clique em "Gerar QR Code" para iniciar.',
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
    qrAvailable: qrCodeImage !== null,
    qrTimestamp: qrCodeTimestamp,
    timestamp: new Date().toISOString()
  });
});

// Endpoint para gerar QR Code (inicia conexão real com WhatsApp)
app.post('/generate-qr', async (req, res) => {
  try {
    // Se já está conectado
    if (connectionStatus === 'connected') {
      return res.json({
        qr: null,
        status: 'already_connected',
        connectionStatus: connectionStatus,
        message: 'WhatsApp já está conectado!'
      });
    }
    
    // Se já tem QR Code disponível
    if (qrCodeImage && connectionStatus === 'qr_ready') {
      return res.json({
        qr: qrCodeImage,
        status: 'generated',
        timestamp: qrCodeTimestamp,
        connectionStatus: connectionStatus,
        message: 'QR Code pronto! Escaneie com WhatsApp.'
      });
    }
    
    // Iniciar cliente WhatsApp em background
    initWhatsAppClient().catch(err => {
      console.error('❌ Erro no background:', err.message);
    });
    
    // Aguardar até 15 segundos pelo QR Code
    let attempts = 0;
    const maxAttempts = 30;
    
    while (!qrCodeImage && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 500));
      attempts++;
    }
    
    if (qrCodeImage) {
      res.json({
        qr: qrCodeImage,
        status: 'generated',
        timestamp: qrCodeTimestamp,
        connectionStatus: connectionStatus,
        message: 'QR Code gerado com sucesso! Escaneie com WhatsApp.'
      });
    } else {
      res.json({
        qr: null,
        status: 'waiting',
        connectionStatus: connectionStatus,
        message: 'WhatsApp está inicializando... Tente novamente em alguns segundos.'
      });
    }
  } catch (error) {
    res.json({
      qr: null,
      status: 'error',
      message: 'Erro ao gerar QR Code: ' + (error as Error).message,
      error: (error as Error).message
    });
  }
});

// Endpoint para desconectar
app.post('/disconnect', async (req, res) => {
  try {
    if (waClient) {
      await waClient.destroy();
      waClient = null;
    }
    connectionStatus = 'disconnected';
    clearQRCode();
    isInitializing = false;
    
    res.json({ status: 'disconnected', message: 'WhatsApp desconectado.' });
  } catch (error) {
    res.json({ status: 'error', message: (error as Error).message });
  }
});

app.listen(port, () => {
  console.log(`🚀 WhatsApp Gateway rodando na porta ${port}`);
  console.log('📱 Modo real - WhatsApp Web via whatsapp-web.js');
  console.log('🔗 Aguardando requisição para gerar QR Code...');
});
