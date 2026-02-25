import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

const router = Router();
const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL || 'redis://redis:6379');

// Health check geral
router.get('/', async (req, res) => {
  try {
    const checks = await Promise.all([
      checkDatabase(),
      checkRedis(),
    ]);

    const allHealthy = checks.every(c => c.status === 'healthy');

    res.status(allHealthy ? 200 : 503).json({
      status: allHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      services: checks,
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Erro ao verificar saúde do sistema',
    });
  }
});

// Health check do banco de dados
router.get('/db', async (req, res) => {
  const check = await checkDatabase();
  res.status(check.status === 'healthy' ? 200 : 503).json(check);
});

// Health check do Redis
router.get('/redis', async (req, res) => {
  const check = await checkRedis();
  res.status(check.status === 'healthy' ? 200 : 503).json(check);
});

// Estatísticas do sistema
router.get('/stats', async (req, res) => {
  try {
    const [deviceStats, commandStats, userStats] = await Promise.all([
      prisma.device.groupBy({ by: ['status'], _count: { id: true } }),
      prisma.command.groupBy({ by: ['status'], _count: { id: true } }),
      prisma.user.count(),
    ]);

    const queueCount = await redis.get('bull:commands:count') || '0';

    res.json({
      devices: deviceStats.reduce((acc, curr) => {
        acc[curr.status] = curr._count.id;
        return acc;
      }, {} as Record<string, number>),
      commands: commandStats.reduce((acc, curr) => {
        acc[curr.status] = curr._count.id;
        return acc;
      }, {} as Record<string, number>),
      users: userStats,
      queueSize: parseInt(queueCount),
    });
  } catch (error) {
    console.error('Erro ao obter estatísticas:', error);
    res.status(500).json({ error: 'Erro ao obter estatísticas' });
  }
});

async function checkDatabase() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { name: 'database', status: 'healthy', latency: 'ok' };
  } catch (error) {
    return { name: 'database', status: 'unhealthy', error: 'Connection failed' };
  }
}

async function checkRedis() {
  try {
    await redis.ping();
    return { name: 'redis', status: 'healthy', latency: 'ok' };
  } catch (error) {
    return { name: 'redis', status: 'unhealthy', error: 'Connection failed' };
  }
}

export { router as healthRoutes };
