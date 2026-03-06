import { WebSocketServer, WebSocket } from 'ws';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import { createServer, IncomingMessage, ServerResponse } from 'http';

dotenv.config();

const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL || 'redis://redis:6379');

const PORT = parseInt(process.env.WS_PORT || '3001');
const HTTP_PORT = parseInt(process.env.HTTP_PORT || '3005');
const HEARTBEAT_TIMEOUT = parseInt(process.env.HEARTBEAT_TIMEOUT_MS || '90000');

// Mapa de conexões ativas: deviceId -> WebSocket
const connections = new Map<string, WebSocket>();

// Mapa reverso: wsId -> deviceId (para identificar dispositivo ao desconectar)
const wsToDevice = new Map<string, string>();

// Mapa de UUIDs pendentes (aguardando registro): wsId -> { ws, timestamp }
const pendingConnections = new Map<string, { ws: WebSocket; timestamp: number }>();

const wss = new WebSocketServer({ port: PORT });

console.log(`🚀 WebSocket Server rodando na porta ${PORT}`);

// ===== HTTP API SERVER =====
const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  res.setHeader('Content-Type', 'application/json');

  // Parse body for POST requests
  let body = '';
  if (req.method === 'POST') {
    await new Promise<void>((resolve) => {
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', resolve);
    });
  }

  // GET /health
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200);
    res.end(JSON.stringify({
      status: 'ok',
      connectedDevices: connections.size,
      pendingConnections: pendingConnections.size,
    }));
    return;
  }

  // GET /devices - list connected devices
  if (req.method === 'GET' && req.url === '/devices') {
    const deviceIds = Array.from(connections.keys());
    const devices = [];
    for (const deviceId of deviceIds) {
      const ws = connections.get(deviceId);
      const deviceData = await redis.get(`device:${deviceId}`);
      devices.push({
        id: deviceId,
        connected: ws?.readyState === WebSocket.OPEN,
        ...(deviceData ? JSON.parse(deviceData) : {}),
      });
    }
    res.writeHead(200);
    res.end(JSON.stringify({ success: true, devices, total: devices.length }));
    return;
  }

  // POST /send-command - send command to a device
  if (req.method === 'POST' && req.url === '/send-command') {
    try {
      const data = JSON.parse(body);
      const { deviceId, command } = data;

      if (!deviceId || !command) {
        res.writeHead(400);
        res.end(JSON.stringify({ success: false, error: 'deviceId e command são obrigatórios' }));
        return;
      }

      const success = await sendCommandToDevice(deviceId, command);
      if (success) {
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, message: 'Comando enviado' }));
      } else {
        res.writeHead(404);
        res.end(JSON.stringify({ success: false, error: 'Dispositivo não conectado' }));
      }
    } catch (error) {
      res.writeHead(500);
      res.end(JSON.stringify({ success: false, error: (error as Error).message }));
    }
    return;
  }

  // POST /broadcast - broadcast command to multiple devices
  if (req.method === 'POST' && req.url === '/broadcast') {
    try {
      const data = JSON.parse(body);
      const { deviceIds, command } = data;

      if (!command) {
        res.writeHead(400);
        res.end(JSON.stringify({ success: false, error: 'command é obrigatório' }));
        return;
      }

      const targets = deviceIds || Array.from(connections.keys());
      const result = await broadcastCommand(targets, command);
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, ...result }));
    } catch (error) {
      res.writeHead(500);
      res.end(JSON.stringify({ success: false, error: (error as Error).message }));
    }
    return;
  }

  // 404
  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Rota não encontrada' }));
});

httpServer.listen(HTTP_PORT, () => {
  console.log(`📡 HTTP API rodando na porta ${HTTP_PORT}`);
});

wss.on('connection', (ws: WebSocket) => {
  const wsId = uuidv4();
  console.log(`Nova conexão: ${wsId}`);

  // Adicionar à lista de pendentes
  pendingConnections.set(wsId, { ws, timestamp: Date.now() });

  ws.on('message', async (data: Buffer) => {
    try {
      const message = JSON.parse(data.toString());
      await handleMessage(wsId, ws, message);
    } catch (error) {
      console.error('Erro ao processar mensagem:', error);
      ws.send(JSON.stringify({ type: 'error', message: 'Formato inválido' }));
    }
  });

  ws.on('close', () => {
    console.log(`Conexão fechada: ${wsId}`);
    handleDisconnect(wsId);
  });

  ws.on('error', (error) => {
    console.error(`Erro na conexão ${wsId}:`, error);
  });

  // Enviar mensagem de boas-vindas
  ws.send(JSON.stringify({ type: 'connected', message: 'Aguardando identificação...' }));
});

async function handleMessage(wsId: string, ws: WebSocket, message: any) {
  switch (message.type) {
    case 'register':
      await handleRegister(wsId, ws, message);
      break;
    case 'heartbeat':
      await handleHeartbeat(wsId, ws, message);
      break;
    case 'command_result':
      await handleCommandResult(message);
      break;
    default:
      ws.send(JSON.stringify({ type: 'error', message: 'Tipo de mensagem desconhecido' }));
  }
}

async function handleRegister(wsId: string, ws: WebSocket, message: any) {
  const { uuid, name, metadata } = message;

  if (!uuid) {
    ws.send(JSON.stringify({ type: 'error', message: 'UUID é obrigatório' }));
    return;
  }

  try {
    // Buscar ou criar dispositivo
    let device = await prisma.device.findUnique({ where: { uuid } });

    if (!device) {
      device = await prisma.device.create({
        data: {
          uuid,
          name: name || `Device-${uuid.slice(0, 8)}`,
          status: 'ONLINE',
          lastHeartbeat: new Date(),
          metadata: metadata || {},
        },
      });
      console.log(`Novo dispositivo registrado: ${uuid}`);
    } else {
      // Atualizar status para online
      device = await prisma.device.update({
        where: { id: device.id },
        data: {
          status: 'ONLINE',
          lastHeartbeat: new Date(),
          name: name || device.name,
          metadata: metadata ? { ...(device.metadata as any || {}), ...metadata } : device.metadata,
        },
      });
      console.log(`Dispositivo reconectado: ${uuid}`);
    }

    // Remover da lista de pendentes e adicionar às conexões ativas
    pendingConnections.delete(wsId);

    // Fechar conexão antiga se existir (evita duplicatas)
    const oldWs = connections.get(device.id);
    if (oldWs && oldWs !== ws && oldWs.readyState === WebSocket.OPEN) {
      oldWs.close(1000, 'Nova conexão do mesmo dispositivo');
    }

    connections.set(device.id, ws);
    wsToDevice.set(wsId, device.id);

    // Salvar no Redis
    await redis.setex(`device:${device.id}`, 300, JSON.stringify({
      id: device.id,
      uuid: device.uuid,
      status: 'ONLINE',
      connectedAt: Date.now(),
    }));

    ws.send(JSON.stringify({
      type: 'registered',
      deviceId: device.id,
      message: 'Dispositivo registrado com sucesso',
    }));
  } catch (error) {
    console.error('Erro ao registrar dispositivo:', error);
    ws.send(JSON.stringify({ type: 'error', message: 'Erro ao registrar' }));
  }
}

async function handleHeartbeat(wsId: string, ws: WebSocket, message: any) {
  let { deviceId } = message;

  // O Android pode enviar UUID ao invés do Prisma ID
  // Tentar resolver UUID -> Prisma ID se não encontrar na connections
  if (deviceId && !connections.has(deviceId)) {
    // Procurar por UUID
    try {
      const device = await prisma.device.findUnique({ where: { uuid: deviceId } });
      if (device) {
        deviceId = device.id;
        // Atualizar a conexão para usar o ID correto
        connections.set(device.id, ws);
      }
    } catch (e) {
      // Se não encontrar por UUID, manter como está
    }
  }

  if (!deviceId || !connections.has(deviceId)) {
    ws.send(JSON.stringify({ type: 'error', message: 'Dispositivo não registrado' }));
    return;
  }

  try {
    // Atualizar no banco
    await prisma.device.update({
      where: { id: deviceId },
      data: { lastHeartbeat: new Date() },
    });

    // Atualizar no Redis
    const deviceData = await redis.get(`device:${deviceId}`);
    if (deviceData) {
      const device = JSON.parse(deviceData);
      await redis.setex(`device:${deviceId}`, 300, JSON.stringify({
        ...device,
        lastHeartbeat: Date.now(),
      }));
    }

    ws.send(JSON.stringify({ type: 'heartbeat_ack' }));
  } catch (error) {
    console.error('Erro ao processar heartbeat:', error);
  }
}

async function handleCommandResult(message: any) {
  const { commandId, result, error } = message;

  try {
    await prisma.command.update({
      where: { id: commandId },
      data: {
        status: error ? 'FAILED' : 'COMPLETED',
        result: result || {},
        error: error || null,
        executedAt: new Date(),
      },
    });
  } catch (err) {
    console.error('Erro ao salvar resultado do comando:', err);
  }
}

async function handleDisconnect(wsId: string) {
  // Verificar se é uma conexão pendente
  if (pendingConnections.has(wsId)) {
    pendingConnections.delete(wsId);
    return;
  }

  // Usar mapa reverso para encontrar o deviceId
  const deviceId = wsToDevice.get(wsId);
  wsToDevice.delete(wsId);

  if (deviceId) {
    // Só remover se esta é a conexão ativa (evita remover reconexão nova)
    const currentWs = connections.get(deviceId);
    if (currentWs?.readyState === WebSocket.CLOSED || currentWs?.readyState === WebSocket.CLOSING) {
      connections.delete(deviceId);
    }

    // Marcar como OFFLINE no banco
    try {
      await prisma.device.update({
        where: { id: deviceId },
        data: { status: 'OFFLINE' },
      });
      await redis.del(`device:${deviceId}`);
      console.log(`Dispositivo desconectado e marcado OFFLINE: ${deviceId}`);
    } catch (e) {
      console.error('Erro ao marcar dispositivo offline:', e);
    }
  }
}

// Verificação periódica de heartbeats
setInterval(async () => {
  const devices = await prisma.device.findMany({
    where: { status: 'ONLINE' },
  });

  const now = Date.now();

  for (const device of devices) {
    if (!device.lastHeartbeat) continue;

    const lastHeartbeat = new Date(device.lastHeartbeat).getTime();
    if (now - lastHeartbeat > HEARTBEAT_TIMEOUT) {
      await prisma.device.update({
        where: { id: device.id },
        data: { status: 'OFFLINE' },
      });

      // Remover do Redis
      await redis.del(`device:${device.id}`);

      // Fechar conexão se ainda estiver aberta
      const ws = connections.get(device.id);
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
      connections.delete(device.id);

      console.log(`Dispositivo marcado como offline: ${device.uuid}`);
    }
  }
}, 30000); // Verificar a cada 30 segundos

// Limpar conexões pendentes antigas (mais de 5 minutos)
setInterval(() => {
  const now = Date.now();
  for (const [wsId, data] of pendingConnections.entries()) {
    if (now - data.timestamp > 5 * 60 * 1000) {
      data.ws.close();
      pendingConnections.delete(wsId);
      console.log(`Conexão pendente removida: ${wsId}`);
    }
  }
}, 60000);

// Função para enviar comando para um dispositivo
export async function sendCommandToDevice(deviceId: string, command: any): Promise<boolean> {
  const ws = connections.get(deviceId);
  
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    return false;
  }

  ws.send(JSON.stringify({
    type: 'command',
    commandId: command.id,
    commandName: command.commandName,
    params: command.params,
  }));

  return true;
}

// Função para broadcast de comandos
export async function broadcastCommand(deviceIds: string[], command: any): Promise<{ sent: string[]; failed: string[] }> {
  const sent: string[] = [];
  const failed: string[] = [];

  for (const deviceId of deviceIds) {
    const success = await sendCommandToDevice(deviceId, command);
    if (success) {
      sent.push(deviceId);
    } else {
      failed.push(deviceId);
    }
  }

  return { sent, failed };
}
