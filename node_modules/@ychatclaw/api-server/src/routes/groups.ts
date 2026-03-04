import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const router = Router();
const prisma = new PrismaClient();

const createGroupSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

const updateGroupSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
});

// Listar todos os grupos
router.get('/', async (req, res) => {
  try {
    const groups = await prisma.deviceGroup.findMany({
      include: {
        devices: {
          select: { id: true, uuid: true, name: true, status: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ groups });
  } catch (error) {
    console.error('Erro ao listar grupos:', error);
    res.status(500).json({ error: 'Erro ao listar grupos' });
  }
});

// Obter um grupo específico
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const group = await prisma.deviceGroup.findUnique({
      where: { id },
      include: {
        devices: {
          select: { id: true, uuid: true, name: true, status: true, lastHeartbeat: true },
        },
      },
    });

    if (!group) {
      return res.status(404).json({ error: 'Grupo não encontrado' });
    }

    res.json({ group });
  } catch (error) {
    console.error('Erro ao obter grupo:', error);
    res.status(500).json({ error: 'Erro ao obter grupo' });
  }
});

// Criar um grupo
router.post('/', async (req, res) => {
  try {
    const data = createGroupSchema.parse(req.body);
    
    const group = await prisma.deviceGroup.create({
      data,
      include: { devices: true },
    });

    res.status(201).json({ group });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Dados inválidos', details: error.errors });
    }
    console.error('Erro ao criar grupo:', error);
    res.status(500).json({ error: 'Erro ao criar grupo' });
  }
});

// Atualizar um grupo
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const data = updateGroupSchema.parse(req.body);
    
    const group = await prisma.deviceGroup.update({
      where: { id },
      data,
      include: { devices: true },
    });

    res.json({ group });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Dados inválidos', details: error.errors });
    }
    console.error('Erro ao atualizar grupo:', error);
    res.status(500).json({ error: 'Erro ao atualizar grupo' });
  }
});

// Deletar um grupo
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Atualizar dispositivos para remover do grupo
    await prisma.device.updateMany({
      where: { groupId: id },
      data: { groupId: null },
    });

    await prisma.deviceGroup.delete({ where: { id } });

    res.json({ message: 'Grupo deletado com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar grupo:', error);
    res.status(500).json({ error: 'Erro ao deletar grupo' });
  }
});

// Adicionar dispositivo ao grupo
router.post('/:id/devices/:deviceId', async (req, res) => {
  try {
    const { id, deviceId } = req.params;
    
    const device = await prisma.device.update({
      where: { id: deviceId },
      data: { groupId: id },
      include: { group: true },
    });

    res.json({ device });
  } catch (error) {
    console.error('Erro ao adicionar dispositivo ao grupo:', error);
    res.status(500).json({ error: 'Erro ao adicionar dispositivo ao grupo' });
  }
});

// Remover dispositivo do grupo
router.delete('/:id/devices/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    
    const device = await prisma.device.update({
      where: { id: deviceId },
      data: { groupId: null },
      include: { group: true },
    });

    res.json({ device });
  } catch (error) {
    console.error('Erro ao remover dispositivo do grupo:', error);
    res.status(500).json({ error: 'Erro ao remover dispositivo do grupo' });
  }
});

export { router as groupRoutes };
