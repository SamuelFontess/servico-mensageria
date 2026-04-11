import { Router } from 'express';
import { Queue } from 'bullmq';
import { adminAuth } from '../middleware/adminAuth';
import { createRedisConnection } from '../../redis';
import { logger } from '../../logger';

const broadcastQueue = new Queue('broadcast', {
  connection: createRedisConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});

const router = Router();

router.post('/admin/message', adminAuth, async (req, res) => {
  const { type, content, target } = req.body as {
    type?: string;
    content?: string;
    target?: string;
  };

  if (!content || typeof content !== 'string' || !content.trim()) {
    res.status(400).json({ error: 'content is required' });
    return;
  }

  try {
    const job = await broadcastQueue.add('broadcast_message', {
      type,
      content: content.trim(),
      target: target ?? 'broadcast',
    });

    logger.info('Admin message enqueued', { jobId: job.id, type });

    res.status(200).json({ id: job.id, createdAt: new Date().toISOString() });
  } catch (err) {
    logger.error('Failed to enqueue broadcast message', err instanceof Error ? { message: err.message } : {});
    res.status(500).json({ error: 'Falha ao enfileirar mensagem' });
  }
});

export { router as adminRouter };
