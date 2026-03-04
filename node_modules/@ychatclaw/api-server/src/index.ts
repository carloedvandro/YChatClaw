import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

import { deviceRoutes } from './routes/devices';
import { groupRoutes } from './routes/groups';
import { userRoutes } from './routes/users';
import { mediaRoutes } from './routes/media';
import { campaignRoutes } from './routes/campaigns';
import { commandRoutes } from './routes/commands';
import { healthRoutes } from './routes/health';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware de segurança
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 100, // 100 requisições por minuto
  message: { error: 'Muitas requisições. Tente novamente mais tarde.' },
});
app.use(limiter);

// Rotas
app.use('/api/devices', deviceRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/users', userRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/commands', commandRoutes);
app.use('/health', healthRoutes);

// Rota padrão
app.get('/', (req, res) => {
  res.json({
    name: 'YChatClaw API',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString(),
  });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Erro:', err);
  res.status(500).json({
    error: 'Erro interno do servidor',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

app.listen(PORT, () => {
  console.log(`🚀 API Server rodando na porta ${PORT}`);
});
