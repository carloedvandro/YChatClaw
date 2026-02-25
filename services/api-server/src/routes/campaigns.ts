import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const router = Router();
const prisma = new PrismaClient();

const createCampaignSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  scheduleConfig: z.object({
    type: z.enum(['once', 'recurring', 'random']),
    cronExpression: z.string().optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    randomIntervalMinutes: z.number().int().optional(),
  }),
  targetGroupId: z.string().uuid().optional(),
  mediaIds: z.array(z.string().uuid()).optional(),
  createdBy: z.string().uuid(),
});

const updateCampaignSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  scheduleConfig: z.object({
    type: z.enum(['once', 'recurring', 'random']),
    cronExpression: z.string().optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    randomIntervalMinutes: z.number().int().optional(),
  }).optional(),
  targetGroupId: z.string().uuid().optional().nullable(),
  isActive: z.boolean().optional(),
});

// Listar campanhas
router.get('/', async (req, res) => {
  try {
    const { isActive, createdBy } = req.query;
    
    const where: any = {};
    if (isActive !== undefined) where.isActive = isActive === 'true';
    if (createdBy) where.createdBy = createdBy;

    const campaigns = await prisma.campaign.findMany({
      where,
      include: { media: true },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ campaigns });
  } catch (error) {
    console.error('Erro ao listar campanhas:', error);
    res.status(500).json({ error: 'Erro ao listar campanhas' });
  }
});

// Obter campanha específica
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: { media: true },
    });

    if (!campaign) {
      return res.status(404).json({ error: 'Campanha não encontrada' });
    }

    res.json({ campaign });
  } catch (error) {
    console.error('Erro ao obter campanha:', error);
    res.status(500).json({ error: 'Erro ao obter campanha' });
  }
});

// Criar campanha
router.post('/', async (req, res) => {
  try {
    const data = createCampaignSchema.parse(req.body);
    
    const campaign = await prisma.campaign.create({
      data: {
        name: data.name,
        description: data.description,
        scheduleConfig: data.scheduleConfig,
        targetGroupId: data.targetGroupId,
        createdBy: data.createdBy,
        isActive: true,
      },
      include: { media: true },
    });

    // Associar mídia se fornecida
    if (data.mediaIds && data.mediaIds.length > 0) {
      await prisma.media.updateMany({
        where: { id: { in: data.mediaIds } },
        data: { campaignId: campaign.id },
      });
    }

    res.status(201).json({ campaign });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Dados inválidos', details: error.errors });
    }
    console.error('Erro ao criar campanha:', error);
    res.status(500).json({ error: 'Erro ao criar campanha' });
  }
});

// Atualizar campanha
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const data = updateCampaignSchema.parse(req.body);
    
    const campaign = await prisma.campaign.update({
      where: { id },
      data,
      include: { media: true },
    });

    res.json({ campaign });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Dados inválidos', details: error.errors });
    }
    console.error('Erro ao atualizar campanha:', error);
    res.status(500).json({ error: 'Erro ao atualizar campanha' });
  }
});

// Deletar campanha
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Remover associação de mídia
    await prisma.media.updateMany({
      where: { campaignId: id },
      data: { campaignId: null },
    });

    await prisma.campaign.delete({ where: { id } });

    res.json({ message: 'Campanha deletada com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar campanha:', error);
    res.status(500).json({ error: 'Erro ao deletar campanha' });
  }
});

// Adicionar mídia à campanha
router.post('/:id/media/:mediaId', async (req, res) => {
  try {
    const { id, mediaId } = req.params;
    
    await prisma.media.update({
      where: { id: mediaId },
      data: { campaignId: id },
    });

    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: { media: true },
    });

    res.json({ campaign });
  } catch (error) {
    console.error('Erro ao adicionar mídia à campanha:', error);
    res.status(500).json({ error: 'Erro ao adicionar mídia à campanha' });
  }
});

export { router as campaignRoutes };
