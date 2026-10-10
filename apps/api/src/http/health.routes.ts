import { Router } from 'express';
import type { PrismaClient } from '../generated/prisma/client.js';
import { HttpError } from './errors.js';

export function healthRouter(prisma: PrismaClient): Router {
  const router = Router();

  router.get('/health', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (error) {
      throw new HttpError(503, 'Database is unavailable', undefined, { cause: error });
    }
    res.json({ status: 'ok' });
  });

  return router;
}
