import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import type { Application } from 'express';
import { config } from '../config';
import { basicAdminAuth } from './middleware/adminAuth';

const BOARD_BASE_PATH = '/admin/queues';

export function setupBullBoard(app: Application): void {
  const connection = new Redis(config.redis.url, {
    maxRetriesPerRequest: null,
  });

  const emailQueue = new Queue('email', { connection });

  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath(BOARD_BASE_PATH);

  createBullBoard({
    queues: [new BullMQAdapter(emailQueue)],
    serverAdapter,
  });

  // Protege a dashboard com a mesma API key do /admin/message
  app.use(BOARD_BASE_PATH, basicAdminAuth, serverAdapter.getRouter());
}
