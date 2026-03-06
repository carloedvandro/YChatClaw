import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const router = Router();
const prisma = new PrismaClient();

const createAgentSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  systemPrompt: z.string().optional(),
  model: z.string().optional(),
  whatsappNumber: z.string().optional(),
  allowedNumbers: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

const updateAgentSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  systemPrompt: z.string().optional(),
  model: z.string().optional(),
  whatsappNumber: z.string().optional().nullable(),
  whatsappStatus: z.string().optional(),
  allowedNumbers: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

// Listar todos os agentes
router.get('/', async (req, res) => {
  try {
    const agents = await prisma.agent.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json({ agents });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao listar agentes', details: (error as Error).message });
  }
});

// Obter agente por ID
router.get('/:id', async (req, res) => {
  try {
    const agent = await prisma.agent.findUnique({ where: { id: req.params.id } });
    if (!agent) return res.status(404).json({ error: 'Agente não encontrado' });
    res.json(agent);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar agente', details: (error as Error).message });
  }
});

// Criar agente
router.post('/', async (req, res) => {
  try {
    const data = createAgentSchema.parse(req.body);
    const agent = await prisma.agent.create({
      data: {
        name: data.name,
        description: data.description,
        systemPrompt: data.systemPrompt || '',
        model: data.model || 'qwen3.5:0.8b',
        whatsappNumber: data.whatsappNumber,
        allowedNumbers: data.allowedNumbers || [],
        isActive: data.isActive ?? true,
      },
    });
    res.status(201).json(agent);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Dados inválidos', details: error.errors });
    }
    res.status(500).json({ error: 'Erro ao criar agente', details: (error as Error).message });
  }
});

// Atualizar agente
router.put('/:id', async (req, res) => {
  try {
    const data = updateAgentSchema.parse(req.body);
    const agent = await prisma.agent.update({
      where: { id: req.params.id },
      data,
    });
    res.json(agent);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Dados inválidos', details: error.errors });
    }
    res.status(500).json({ error: 'Erro ao atualizar agente', details: (error as Error).message });
  }
});

// Deletar agente
router.delete('/:id', async (req, res) => {
  try {
    await prisma.agent.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao deletar agente', details: (error as Error).message });
  }
});

// Obter agente por número do WhatsApp (usado pelo gateway)
router.get('/by-whatsapp/:number', async (req, res) => {
  try {
    const agent = await prisma.agent.findFirst({
      where: { whatsappNumber: req.params.number, isActive: true },
    });
    if (!agent) return res.status(404).json({ error: 'Nenhum agente para este número' });
    res.json(agent);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar agente', details: (error as Error).message });
  }
});

export const agentRoutes = router;
