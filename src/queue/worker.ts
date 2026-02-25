import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import type WebSocket from 'ws';
import { config } from '../config';
import { logger } from '../logger';
import { handleFamilyInvite } from '../email/handlers/familyInvite';
import { handleForgotPassword } from '../email/handlers/forgotPassword';
import { broadcast } from '../websocket/broadcast';
import type {
  FamilyInvitePayload,
  ForgotPasswordPayload,
  BroadcastMessagePayload,
} from './types';
import { randomUUID } from 'crypto';

async function dispatch(job: Job, wss: WebSocket.Server): Promise<void> {
  switch (job.name) {
    case 'family_invite':
      await handleFamilyInvite(job.data as FamilyInvitePayload);
      break;

    case 'forgot_password':
      await handleForgotPassword(job.data as ForgotPasswordPayload);
      break;

    case 'broadcast_message': {
      const payload = job.data as BroadcastMessagePayload;
      broadcast(wss, {
        event: 'message',
        id: job.id ?? randomUUID(),
        type: payload.type,
        content: payload.content,
        createdAt: new Date().toISOString(),
        target: payload.target ?? 'broadcast',
      });
      break;
    }

    default:
      throw new Error(`Unknown job type: ${job.name}`);
  }
}

export function startWorker(wss: WebSocket.Server): Worker {
  const connection = new Redis(config.redis.url, {
    maxRetriesPerRequest: null,
  });

  connection.on('error', (err) => {
    logger.warn('Worker Redis connection error', { error: err.message });
  });

  const worker = new Worker(
    'email',
    async (job: Job) => {
      logger.info('Processing job', { jobId: job.id, type: job.name });
      await dispatch(job, wss);
    },
    {
      connection,
      concurrency: 5,
    },
  );

  worker.on('completed', (job) => {
    logger.info('Job completed', { jobId: job.id, type: job.name });

    if (job.name === 'family_invite' || job.name === 'forgot_password') {
      const data = job.data as { invitedEmail?: string; email?: string };
      const email = data?.invitedEmail ?? data?.email;
      broadcast(wss, {
        event: 'email:status',
        jobId: job.id ?? '',
        type: job.name,
        status: 'sent',
        ...(email && { email }),
      });
    }
  });

  worker.on('failed', (job, err) => {
    if (!job) return;
    logger.error('Job failed', { jobId: job.id, type: job.name, error: err.message });

    if (job.name === 'family_invite' || job.name === 'forgot_password') {
      broadcast(wss, {
        event: 'email:status',
        jobId: job.id ?? '',
        type: job.name,
        status: 'failed',
        error: err.message,
      });
    }
  });

  logger.info('BullMQ Worker started, listening on queue: email');
  return worker;
}
