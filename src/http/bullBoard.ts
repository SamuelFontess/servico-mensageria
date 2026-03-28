import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { Queue } from 'bullmq';
import type { Application, Request, Response, NextFunction } from 'express';
import { createRedisConnection } from '../redis';
import { config } from '../config';
import { basicAdminAuth } from './middleware/adminAuth';

const BOARD_BASE_PATH = '/admin/queues';

function ipAllowlist(req: Request, res: Response, next: NextFunction): void {
  const allowed = config.http.bullBoardAllowedIps;
  if (!allowed) {
    next();
    return;
  }

  const clientIp = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0].trim()
    ?? req.socket.remoteAddress
    ?? '';

  const allowedList = allowed.split(',').map((ip) => ip.trim());
  if (allowedList.includes(clientIp)) {
    next();
    return;
  }

  res.status(403).send('Forbidden');
}

export function setupBullBoard(app: Application): void {
  const connection = createRedisConnection();
  const emailQueue = new Queue('email', { connection });
  const broadcastQueue = new Queue('broadcast', { connection });

  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath(BOARD_BASE_PATH);

  createBullBoard({
    queues: [new BullMQAdapter(emailQueue), new BullMQAdapter(broadcastQueue)],
    serverAdapter,
  });

  app.use(BOARD_BASE_PATH, ipAllowlist, basicAdminAuth, serverAdapter.getRouter());
}
