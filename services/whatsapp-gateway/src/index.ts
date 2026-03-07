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
let connectedNumber: string | null = null;

// Atualizar status do agente no banco de dados
async function updateAgentStatus(whatsappNumber: string, status: string): Promise<void> {
  try {
    const res = await fetch('http://api-server:3000/api/agents');
    const data = await res.json() as any;
    const agents = data.agents || [];
    for (const agent of agents) {
      if (agent.whatsappNumber && whatsappNumber.includes(agent.whatsappNumber.replace(/\D/g, ''))) {
        await fetch(`http://api-server:3000/api/agents/${agent.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ whatsappStatus: status }),
        });
        console.log(`📋 Agente "${agent.name}" status atualizado: ${status}`);
      }
    }
  } catch (e) {
    console.log('⚠️ Não foi possível atualizar status do agente:', (e as Error).message);
  }
}

// Marcar todos os agentes como desconectados
async function disconnectAllAgents(): Promise<void> {
  try {
    const res = await fetch('http://api-server:3000/api/agents');
    const data = await res.json() as any;
    const agents = data.agents || [];
    for (const agent of agents) {
      if (agent.whatsappStatus !== 'disconnected') {
        await fetch(`http://api-server:3000/api/agents/${agent.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ whatsappStatus: 'disconnected' }),
        });
      }
    }
  } catch (e) {
    console.log('⚠️ Não foi possível desconectar agentes:', (e as Error).message);
  }
}

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
    
    // Evento: Mensagem recebida
    waClient.on('message', async (msg: any) => {
      try {
        const from = msg.from;
        const body = msg.body;
        const isGroup = msg.from.endsWith('@g.us');
        
        console.log(`📩 Mensagem de ${from}: ${body.substring(0, 50)}...`);
        
        // Armazenar mensagem no Redis
        const msgData = { from, body, timestamp: new Date().toISOString(), isGroup };
        await redis.lpush('whatsapp:messages', JSON.stringify(msgData));
        await redis.ltrim('whatsapp:messages', 0, 99);
        
        // Incrementar contador
        await redis.incr('whatsapp:message_count');
        
        // Ignorar mensagens de grupo, newsletters e broadcasts
        if (isGroup) return;
        if (from.endsWith('@newsletter') || from === 'status@broadcast') {
          console.log(`⏭️ Ignorando mensagem automatizada de ${from}`);
          return;
        }

        // Resolver @lid (linked device) para número real
        let resolvedFrom = from;
        if (from.endsWith('@lid')) {
          try {
            const contact = await msg.getContact();
            if (contact && contact.number) {
              resolvedFrom = contact.number + '@c.us';
              console.log(`🔗 Linked device ${from} -> número real: ${contact.number}`);
            } else {
              console.log(`⚠️ Não foi possível resolver @lid ${from}, usando ID original`);
              resolvedFrom = from;
            }
          } catch (e) {
            console.log(`⚠️ Erro ao resolver @lid: ${(e as Error).message}`);
          }
        }

        // Verificar whitelist de números por agente
        const senderNumber = resolvedFrom.replace(/@(c\.us|lid)$/, '');
        let matchedAgent: any = null;
        try {
          const agentsRes = await fetch('http://api-server:3000/api/agents');
          const agentsData = await agentsRes.json() as any;
          const agents = (agentsData.agents || []).filter((a: any) => a.isActive);
          
          if (agents.length > 0) {
            // 1. Primeiro: procurar agente pelo número WhatsApp conectado (este gateway)
            if (connectedNumber) {
              matchedAgent = agents.find((a: any) => {
                if (!a.whatsappNumber) return false;
                const agentNum = a.whatsappNumber.replace(/\D/g, '');
                return connectedNumber!.includes(agentNum) || agentNum.includes(connectedNumber!);
              });
            }
            
            // 2. Se não encontrou por número, procurar por whitelist
            if (!matchedAgent) {
              matchedAgent = agents.find((a: any) => {
                const allowed = Array.isArray(a.allowedNumbers) ? a.allowedNumbers : [];
                if (allowed.length === 0) return true; // sem whitelist = aceita todos
                return allowed.some((n: string) => senderNumber.includes(n) || n.includes(senderNumber));
              });
            }
            
            if (!matchedAgent) {
              console.log(`🚫 Número ${senderNumber} não está na whitelist de nenhum agente`);
              return;
            }
            
            // 3. Verificar whitelist do agente encontrado
            const allowed = Array.isArray(matchedAgent.allowedNumbers) ? matchedAgent.allowedNumbers : [];
            if (allowed.length > 0) {
              const isAllowed = allowed.some((n: string) => senderNumber.includes(n) || n.includes(senderNumber));
              if (!isAllowed) {
                console.log(`🚫 Número ${senderNumber} não permitido no agente ${matchedAgent.name}`);
                return;
              }
            }
            
            console.log(`✅ Número ${senderNumber} -> agente: ${matchedAgent.name}`);
          }
        } catch (agentErr) {
          // Se não conseguir verificar agentes, permitir (fallback)
          console.log('⚠️ Não foi possível verificar agentes, permitindo mensagem');
        }
        
        // Encaminhar para AI Service
        try {
          const aiResponse = await fetch('http://ai-service:3002/process', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: body,
              userId: senderNumber,
              channel: 'whatsapp',
              channelId: from,
              agentId: matchedAgent?.id || null,
              agentPrompt: matchedAgent?.systemPrompt || null,
            }),
          });
          const aiData = await aiResponse.json() as any;
          
          // Enviar screenshot como imagem se disponível
          if (aiData.screenshotData) {
            try {
              const { MessageMedia } = require('whatsapp-web.js');
              // screenshotData é "data:image/png;base64,..."
              const base64Data = aiData.screenshotData.replace(/^data:image\/\w+;base64,/, '');
              const media = new MessageMedia('image/png', base64Data, 'screenshot.png');
              await msg.reply(media, undefined, { caption: aiData.response || '📸 Screenshot' });
              console.log(`📸 Screenshot enviado para ${from}`);
            } catch (imgErr) {
              console.error('⚠️ Erro ao enviar imagem:', (imgErr as Error).message);
              // Fallback: enviar só o texto
              if (aiData.response) {
                await msg.reply(aiData.response);
              }
            }
          } else if (aiData.response) {
            await msg.reply(aiData.response);
            console.log(`🤖 Resposta AI enviada para ${from}`);
          }
        } catch (aiErr) {
          console.error('❌ Erro ao processar com AI:', (aiErr as Error).message);
        }
      } catch (error) {
        console.error('❌ Erro ao processar mensagem:', (error as Error).message);
      }
    });

    // Evento: Cliente pronto (autenticado)
    waClient.on('ready', async () => {
      console.log('✅ WhatsApp conectado com sucesso!');
      connectionStatus = 'connected';
      qrCodeImage = null;
      qrCodeTimestamp = null;
      isInitializing = false;
      
      // Obter número conectado
      try {
        const info = waClient.info;
        if (info && info.wid) {
          connectedNumber = info.wid.user || info.wid._serialized?.replace('@c.us', '') || null;
          console.log(`📱 Número conectado: ${connectedNumber}`);
          // Atualizar status do agente que usa este número
          if (connectedNumber) {
            await updateAgentStatus(connectedNumber, 'connected');
          }
        }
      } catch (e) {
        console.log('⚠️ Não foi possível obter número conectado:', (e as Error).message);
      }
      
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
    waClient.on('disconnected', async (reason: string) => {
      console.log('📵 WhatsApp desconectado:', reason);
      connectionStatus = 'disconnected';
      qrCodeImage = null;
      waClient = null;
      isInitializing = false;
      connectedNumber = null;
      // Marcar todos agentes como desconectados
      await disconnectAllAgents();
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
    connectedNumber: connectedNumber,
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

// Endpoint para enviar mensagem
app.post('/send-message', async (req, res) => {
  try {
    const { to, message } = req.body;
    
    if (!to || !message) {
      return res.status(400).json({ success: false, error: 'Parâmetros obrigatórios: to, message' });
    }
    
    if (!waClient || connectionStatus !== 'connected') {
      return res.json({ success: false, error: 'WhatsApp não está conectado' });
    }
    
    // Formatar número (adicionar @c.us se necessário)
    const chatId = to.includes('@') ? to : `${to}@c.us`;
    
    await waClient.sendMessage(chatId, message);
    
    // Armazenar mensagem enviada no Redis
    const msgData = { from: 'me', to: chatId, body: message, timestamp: new Date().toISOString(), direction: 'outgoing' };
    await redis.lpush('whatsapp:messages', JSON.stringify(msgData));
    await redis.ltrim('whatsapp:messages', 0, 99);
    await redis.incr('whatsapp:message_count');
    
    console.log(`📤 Mensagem enviada para ${chatId}`);
    res.json({ success: true, message: 'Mensagem enviada com sucesso' });
  } catch (error) {
    console.error('❌ Erro ao enviar mensagem:', (error as Error).message);
    res.json({ success: false, error: (error as Error).message });
  }
});

// Endpoint para listar mensagens recentes
app.get('/messages', async (req, res) => {
  try {
    const messages = await redis.lrange('whatsapp:messages', 0, 49);
    const count = await redis.get('whatsapp:message_count') || '0';
    res.json({
      messages: messages.map((m: string) => JSON.parse(m)),
      totalCount: parseInt(count),
    });
  } catch (error) {
    res.json({ messages: [], totalCount: 0 });
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
    connectedNumber = null;
    clearQRCode();
    isInitializing = false;
    await disconnectAllAgents();
    
    res.json({ status: 'disconnected', message: 'WhatsApp desconectado.' });
  } catch (error) {
    res.json({ status: 'error', message: (error as Error).message });
  }
});

app.listen(port, () => {
  console.log(`🚀 WhatsApp Gateway rodando na porta ${port}`);
  console.log('📱 Modo real - WhatsApp Web via whatsapp-web.js');
  
  // Auto-conectar se já existe sessão salva
  const sessionDir = path.join(sessionPath, '.wwebjs_auth');
  const sessionDirAlt = path.join(sessionPath, 'session');
  if (fs.existsSync(sessionDir) || fs.existsSync(sessionDirAlt)) {
    console.log('� Sessão anterior encontrada, reconectando automaticamente...');
    initWhatsAppClient().catch(err => {
      console.error('❌ Erro na auto-reconexão:', err.message);
    });
  } else {
    console.log('�🔗 Aguardando requisição para gerar QR Code...');
  }
});
