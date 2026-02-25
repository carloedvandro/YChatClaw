import { Worker, Queue } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL || 'redis://redis:6379');

const BROADCAST_BATCH_SIZE = parseInt(process.env.BROADCAST_BATCH_SIZE || '10');
const BROADCAST_DELAY_MS = parseInt(process.env.BROADCAST_DELAY_MS || '200');
const WS_SERVER_URL = process.env.WS_SERVER_URL || 'http://websocket-server:3001';

// Fila para agendamentos
const scheduledQueue = new Queue('scheduled', { connection: redis });

// Worker para comandos
const commandWorker = new Worker('commands', async (job) => {
  const { commandId } = job.data;

  console.log(`Processando comando: ${commandId}`);

  try {
    // Buscar comando
    const command = await prisma.command.findUnique({
      where: { id: commandId },
      include: { device: true },
    });

    if (!command) {
      throw new Error(`Comando não encontrado: ${commandId}`);
    }

    // Atualizar status
    await prisma.command.update({
      where: { id: commandId },
      data: { status: 'PROCESSING' },
    });

    // Processar baseado no tipo
    if (command.type === 'SINGLE' && command.targetDeviceId) {
      await sendToDevice(command.targetDeviceId, command);
    } else if (command.type === 'BROADCAST' || command.targetType === 'GROUP') {
      await broadcastCommand(command);
    } else if (command.type === 'SCHEDULED') {
      // Agendamentos são tratados separadamente
      await scheduledQueue.add('scheduled', { commandId }, {
        delay: command.scheduledAt ? new Date(command.scheduledAt).getTime() - Date.now() : 0,
      });
      await prisma.command.update({
        where: { id: commandId },
        data: { status: 'PENDING' },
      });
      return { status: 'scheduled' };
    }

    // Atualizar como concluído
    await prisma.command.update({
      where: { id: commandId },
      data: {
        status: 'COMPLETED',
        executedAt: new Date(),
      },
    });

    return { status: 'completed' };
  } catch (error) {
    console.error(`Erro ao processar comando ${commandId}:`, error);

    await prisma.command.update({
      where: { id: commandId },
      data: {
        status: 'FAILED',
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      },
    });

    throw error;
  }
}, {
  connection: redis,
  concurrency: parseInt(process.env.WORKER_CONCURRENCY || '5'),
  limiter: {
    max: 100,
    duration: 1000,
  },
});

// Worker para agendamentos
const scheduledWorker = new Worker('scheduled', async (job) => {
  const { commandId } = job.data;

  console.log(`Executando tarefa agendada: ${commandId}`);

  const command = await prisma.command.findUnique({
    where: { id: commandId },
  });

  if (!command || command.status === 'CANCELLED') {
    return { status: 'skipped' };
  }

  // Re-adicionar à fila de comandos para execução
  await prisma.command.update({
    where: { id: commandId },
    data: { status: 'QUEUED' },
  });

  // Processar imediatamente
  if (command.targetType === 'DEVICE' && command.targetDeviceId) {
    await sendToDevice(command.targetDeviceId, command);
  } else {
    await broadcastCommand(command);
  }

  await prisma.command.update({
    where: { id: commandId },
    data: {
      status: 'COMPLETED',
      executedAt: new Date(),
    },
  });

  return { status: 'completed' };
}, { connection: redis });

async function sendToDevice(deviceId: string, command: any) {
  // Enviar via WebSocket server
  try {
    const response = await fetch(`${WS_SERVER_URL}/send-command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, command }),
    });

    if (!response.ok) {
      throw new Error(`Falha ao enviar comando: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`Erro ao enviar para dispositivo ${deviceId}:`, error);
    throw error;
  }
}

async function broadcastCommand(command: any) {
  let deviceIds: string[] = [];

  if (command.targetType === 'GROUP' && command.targetGroupId) {
    // Buscar dispositivos do grupo
    const devices = await prisma.device.findMany({
      where: {
        groupId: command.targetGroupId,
        status: 'ONLINE',
      },
      select: { id: true },
    });
    deviceIds = devices.map(d => d.id);
  } else if (command.targetType === 'ALL') {
    // Todos os dispositivos online
    const devices = await prisma.device.findMany({
      where: { status: 'ONLINE' },
      select: { id: true },
    });
    deviceIds = devices.map(d => d.id);
  }

  console.log(`Broadcast para ${deviceIds.length} dispositivos`);

  // Enviar em lotes
  for (let i = 0; i < deviceIds.length; i += BROADCAST_BATCH_SIZE) {
    const batch = deviceIds.slice(i, i + BROADCAST_BATCH_SIZE);
    
    await Promise.all(batch.map(deviceId => 
      sendToDevice(deviceId, command).catch(err => {
        console.error(`Falha no dispositivo ${deviceId}:`, err);
      })
    ));

    // Delay entre lotes
    if (i + BROADCAST_BATCH_SIZE < deviceIds.length) {
      await new Promise(resolve => setTimeout(resolve, BROADCAST_DELAY_MS));
    }
  }
}

// Event listeners
commandWorker.on('completed', (job) => {
  console.log(`Job ${job.id} completado`);
});

commandWorker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} falhou:`, err);
});

console.log('⚙️ Worker iniciado e aguardando jobs...');
