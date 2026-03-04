import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();
const prisma = new PrismaClient();

const MEDIA_PATH = process.env.MEDIA_STORAGE_PATH || './media';

// Garantir que o diretório existe
if (!fs.existsSync(MEDIA_PATH)) {
  fs.mkdirSync(MEDIA_PATH, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, MEDIA_PATH);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE_MB || '50') * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'video/webm', 'audio/mpeg'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de arquivo não suportado'));
    }
  },
});

// Listar mídia
router.get('/', async (req, res) => {
  try {
    const { userId, type, campaignId } = req.query;
    
    const where: any = {};
    if (userId) where.userId = userId;
    if (type) where.type = type;
    if (campaignId) where.campaignId = campaignId;

    const media = await prisma.media.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    res.json({ media });
  } catch (error) {
    console.error('Erro ao listar mídia:', error);
    res.status(500).json({ error: 'Erro ao listar mídia' });
  }
});

// Upload de mídia
router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }

    const { userId, campaignId } = req.body;
    
    // Determinar tipo
    let type = 'DOCUMENT';
    if (req.file.mimetype.startsWith('image/')) type = 'IMAGE';
    else if (req.file.mimetype.startsWith('video/')) type = 'VIDEO';
    else if (req.file.mimetype.startsWith('audio/')) type = 'AUDIO';

    const media = await prisma.media.create({
      data: {
        userId,
        filename: req.file.originalname,
        path: req.file.filename,
        type,
        size: req.file.size,
        campaignId: campaignId || null,
        metadata: { mimetype: req.file.mimetype },
      },
    });

    res.status(201).json({ media });
  } catch (error) {
    console.error('Erro ao fazer upload:', error);
    res.status(500).json({ error: 'Erro ao fazer upload de mídia' });
  }
});

// Obter mídia específica
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const media = await prisma.media.findUnique({ where: { id } });

    if (!media) {
      return res.status(404).json({ error: 'Mídia não encontrada' });
    }

    res.json({ media });
  } catch (error) {
    console.error('Erro ao obter mídia:', error);
    res.status(500).json({ error: 'Erro ao obter mídia' });
  }
});

// Servir arquivo
router.get('/:id/file', async (req, res) => {
  try {
    const { id } = req.params;
    
    const media = await prisma.media.findUnique({ where: { id } });

    if (!media) {
      return res.status(404).json({ error: 'Mídia não encontrada' });
    }

    const filePath = path.join(MEDIA_PATH, media.path);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Arquivo não encontrado' });
    }

    res.sendFile(path.resolve(filePath));
  } catch (error) {
    console.error('Erro ao servir arquivo:', error);
    res.status(500).json({ error: 'Erro ao servir arquivo' });
  }
});

// Deletar mídia
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const media = await prisma.media.findUnique({ where: { id } });
    
    if (!media) {
      return res.status(404).json({ error: 'Mídia não encontrada' });
    }

    // Deletar arquivo físico
    const filePath = path.join(MEDIA_PATH, media.path);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await prisma.media.delete({ where: { id } });

    res.json({ message: 'Mídia deletada com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar mídia:', error);
    res.status(500).json({ error: 'Erro ao deletar mídia' });
  }
});

export { router as mediaRoutes };
