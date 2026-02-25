import { WebSocketServer, WebSocket } from 'ws';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL || 'redis://redis:6379');

const PORT = parseInt(process.env.WS_PORT || '3001');
const HEARTBEAT_TIMEOUT = parseInt(process.env.HEARTBEAT_TIMEOUT_MS || '90000');

// Mapa de conexões ativas: deviceId -> WebSocket
const connections = new Map<string, WebSocket>();

// Mapa de UUIDs pendentes (aguardando registro): wsId -> { ws, timestamp }
const pendingConnections = new Map<string, { ws: WebSocket; timestamp: number }>();

const wss = new WebSocketServer({ port: PORT });

console.log(`🚀 WebSocket Server rodando na porta ${PORT}`);

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
          metadata: metadata ? { ...device.metadata, ...metadata } : device.metadata,
        },
      });
      console.log(`Dispositivo reconectado: ${uuid}`);
    }

    // Remover da lista de pendentes e adicionar às conexões ativas
    pendingConnections.delete(wsId);
    connections.set(device.id, ws);

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
  const { deviceId } = message;

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

function handleDisconnect(wsId: string) {
  // Verificar se é uma conexão pendente
  if (pendingConnections.has(wsId)) {
    pendingConnections.delete(wsId);
    return;
  }

  // Procurar o deviceId associado ao WebSocket
  for (const [deviceId, ws] of connections.entries()) {
    if (ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
      connections.delete(deviceId);
      
      // Atualizar status no banco (não marcar como offline imediatamente)
      // O timeout do heartbeat vai cuidar disso
      console.log(`Dispositivo desconectado: ${deviceId}`);
      break;
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
