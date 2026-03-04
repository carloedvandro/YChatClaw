import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import jwt from 'jsonwebtoken';

const router = Router();
const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';

const createUserSchema = z.object({
  channelType: z.enum(['whatsapp', 'telegram', 'discord']),
  externalId: z.string().min(1),
  name: z.string().optional(),
  preferences: z.record(z.any()).optional(),
});

// Listar todos os usuários
router.get('/', async (req, res) => {
  try {
    const { channelType } = req.query;
    
    const where: any = {};
    if (channelType) where.channelType = channelType;

    const users = await prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    res.json({ users });
  } catch (error) {
    console.error('Erro ao listar usuários:', error);
    res.status(500).json({ error: 'Erro ao listar usuários' });
  }
});

// Obter um usuário específico
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        sessions: { take: 5, orderBy: { lastActivity: 'desc' } },
        apiKeys: { where: { isActive: true } },
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Erro ao obter usuário:', error);
    res.status(500).json({ error: 'Erro ao obter usuário' });
  }
});

// Criar ou obter usuário (upsert)
router.post('/', async (req, res) => {
  try {
    const data = createUserSchema.parse(req.body);
    
    const user = await prisma.user.upsert({
      where: {
        channelType_externalId: {
          channelType: data.channelType,
          externalId: data.externalId,
        },
      },
      update: {
        name: data.name,
        preferences: data.preferences || {},
      },
      create: {
        channelType: data.channelType,
        externalId: data.externalId,
        name: data.name,
        preferences: data.preferences || {},
        rateLimits: {},
      },
    });

    // Gerar token JWT
    const token = jwt.sign(
      { userId: user.id, channelType: user.channelType },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({ user, token });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Dados inválidos', details: error.errors });
    }
    console.error('Erro ao criar usuário:', error);
    res.status(500).json({ error: 'Erro ao criar usuário' });
  }
});

// Atualizar preferências do usuário
router.put('/:id/preferences', async (req, res) => {
  try {
    const { id } = req.params;
    const { preferences } = req.body;
    
    const user = await prisma.user.update({
      where: { id },
      data: { preferences: preferences || {} },
    });

    res.json({ user });
  } catch (error) {
    console.error('Erro ao atualizar preferências:', error);
    res.status(500).json({ error: 'Erro ao atualizar preferências' });
  }
});

// Deletar um usuário
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    await prisma.user.delete({ where: { id } });

    res.json({ message: 'Usuário deletado com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar usuário:', error);
    res.status(500).json({ error: 'Erro ao deletar usuário' });
  }
});

export { router as userRoutes };
