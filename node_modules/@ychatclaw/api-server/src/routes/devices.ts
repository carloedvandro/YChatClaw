import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const router = Router();
const prisma = new PrismaClient();

const createDeviceSchema = z.object({
  uuid: z.string().min(1),
  name: z.string().optional(),
  groupId: z.string().uuid().optional(),
  metadata: z.record(z.any()).optional(),
});

const updateDeviceSchema = z.object({
  name: z.string().optional(),
  status: z.enum(['ONLINE', 'OFFLINE', 'BUSY', 'ERROR']).optional(),
  groupId: z.string().uuid().optional().nullable(),
  metadata: z.record(z.any()).optional(),
});

// Listar todos os dispositivos
router.get('/', async (req, res) => {
  try {
    const { status, groupId } = req.query;
    
    const where: any = {};
    if (status) where.status = status;
    if (groupId) where.groupId = groupId;

    const devices = await prisma.device.findMany({
      where,
      include: { group: true },
      orderBy: { updatedAt: 'desc' },
    });

    res.json({ devices });
  } catch (error) {
    console.error('Erro ao listar dispositivos:', error);
    res.status(500).json({ error: 'Erro ao listar dispositivos' });
  }
});

// Obter um dispositivo específico
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const device = await prisma.device.findUnique({
      where: { id },
      include: { group: true },
    });

    if (!device) {
      return res.status(404).json({ error: 'Dispositivo não encontrado' });
    }

    res.json({ device });
  } catch (error) {
    console.error('Erro ao obter dispositivo:', error);
    res.status(500).json({ error: 'Erro ao obter dispositivo' });
  }
});

// Criar um dispositivo
router.post('/', async (req, res) => {
  try {
    const data = createDeviceSchema.parse(req.body);
    
    const device = await prisma.device.create({
      data: {
        ...data,
        status: 'OFFLINE',
      },
      include: { group: true },
    });

    res.status(201).json({ device });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Dados inválidos', details: error.errors });
    }
    console.error('Erro ao criar dispositivo:', error);
    res.status(500).json({ error: 'Erro ao criar dispositivo' });
  }
});

// Atualizar um dispositivo
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const data = updateDeviceSchema.parse(req.body);
    
    const device = await prisma.device.update({
      where: { id },
      data,
      include: { group: true },
    });

    res.json({ device });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Dados inválidos', details: error.errors });
    }
    console.error('Erro ao atualizar dispositivo:', error);
    res.status(500).json({ error: 'Erro ao atualizar dispositivo' });
  }
});

// Deletar um dispositivo
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    await prisma.device.delete({ where: { id } });

    res.json({ message: 'Dispositivo deletado com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar dispositivo:', error);
    res.status(500).json({ error: 'Erro ao deletar dispositivo' });
  }
});

export { router as deviceRoutes };
