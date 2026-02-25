import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { Queue } from 'bullmq';
import { z } from 'zod';

const router = Router();
const prisma = new PrismaClient();

const commandQueue = new Queue('commands', {
  connection: { url: process.env.REDIS_URL },
});

const createCommandSchema = z.object({
  type: z.enum(['SINGLE', 'BROADCAST', 'SCHEDULED']),
  targetType: z.enum(['DEVICE', 'GROUP', 'ALL']).optional(),
  targetDeviceId: z.string().uuid().optional(),
  targetGroupId: z.string().uuid().optional(),
  commandName: z.string().min(1),
  params: z.record(z.any()).optional(),
  scheduledAt: z.string().datetime().optional(),
  createdBy: z.string().uuid(),
});

// Listar comandos
router.get('/', async (req, res) => {
  try {
    const { status, deviceId, groupId, createdBy } = req.query;
    
    const where: any = {};
    if (status) where.status = status;
    if (deviceId) where.targetDeviceId = deviceId;
    if (groupId) where.targetGroupId = groupId;
    if (createdBy) where.createdBy = createdBy;

    const commands = await prisma.command.findMany({
      where,
      include: { device: true },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ commands });
  } catch (error) {
    console.error('Erro ao listar comandos:', error);
    res.status(500).json({ error: 'Erro ao listar comandos' });
  }
});

// Obter comando específico
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const command = await prisma.command.findUnique({
      where: { id },
      include: { device: true },
    });

    if (!command) {
      return res.status(404).json({ error: 'Comando não encontrado' });
    }

    res.json({ command });
  } catch (error) {
    console.error('Erro ao obter comando:', error);
    res.status(500).json({ error: 'Erro ao obter comando' });
  }
});

// Criar comando
router.post('/', async (req, res) => {
  try {
    const data = createCommandSchema.parse(req.body);
    
    // Criar comando no banco
    const command = await prisma.command.create({
      data: {
        type: data.type,
        targetType: data.targetType,
        targetDeviceId: data.targetDeviceId,
        targetGroupId: data.targetGroupId,
        commandName: data.commandName,
        params: data.params || {},
        status: data.scheduledAt ? 'PENDING' : 'QUEUED',
        scheduledAt: data.scheduledAt,
        createdBy: data.createdBy,
      },
    });

    // Adicionar à fila se não for agendado
    if (!data.scheduledAt) {
      await commandQueue.add('command', { commandId: command.id }, {
        delay: data.scheduledAt ? new Date(data.scheduledAt).getTime() - Date.now() : 0,
      });
    }

    res.status(201).json({ command });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Dados inválidos', details: error.errors });
    }
    console.error('Erro ao criar comando:', error);
    res.status(500).json({ error: 'Erro ao criar comando' });
  }
});

// Cancelar comando
router.post('/:id/cancel', async (req, res) => {
  try {
    const { id } = req.params;
    
    const command = await prisma.command.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    // Remover da fila se estiver lá
    const jobs = await commandQueue.getJobs(['waiting', 'delayed']);
    const job = jobs.find(j => j.data.commandId === id);
    if (job) {
      await job.remove();
    }

    res.json({ command });
  } catch (error) {
    console.error('Erro ao cancelar comando:', error);
    res.status(500).json({ error: 'Erro ao cancelar comando' });
  }
});

// Retry de comando falho
router.post('/:id/retry', async (req, res) => {
  try {
    const { id } = req.params;
    
    const command = await prisma.command.update({
      where: { id },
      data: { 
        status: 'QUEUED',
        retryCount: { increment: 1 },
      },
    });

    await commandQueue.add('command', { commandId: command.id });

    res.json({ command });
  } catch (error) {
    console.error('Erro ao fazer retry do comando:', error);
    res.status(500).json({ error: 'Erro ao fazer retry do comando' });
  }
});

export { router as commandRoutes };
