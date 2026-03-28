import { Worker, Job } from 'bullmq';
import type WebSocket from 'ws';
import { createRedisConnection } from '../redis';
import { logger } from '../logger';
import { broadcast } from '../websocket/broadcast';
import type { BroadcastMessagePayload } from './types';
import { randomUUID } from 'crypto';

export function startBroadcastWorker(wss: WebSocket.Server): Worker {
  const connection = createRedisConnection();

  const worker = new Worker(
    'broadcast',
    async (job: Job) => {
      if (job.name !== 'broadcast_message') {
        throw new Error(`Unknown broadcast job type: ${job.name}`);
      }

      const payload = job.data as BroadcastMessagePayload;
      broadcast(wss, {
        event: 'message',
        id: job.id ?? randomUUID(),
        type: payload.type,
        content: payload.content,
        createdAt: new Date().toISOString(),
        target: payload.target ?? 'broadcast',
      });
    },
    { connection, concurrency: 10 },
  );

  worker.on('completed', (job) => {
    logger.info('Broadcast job completed', { jobId: job.id });
  });

  worker.on('failed', (job, err) => {
    if (!job) return;
    logger.error('Broadcast job failed', { jobId: job.id, error: err.message });
  });

  logger.info('BullMQ BroadcastWorker started, listening on queue: broadcast');
  return worker;
}
