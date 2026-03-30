import { Worker, Job } from 'bullmq';
import type WebSocket from 'ws';
import { createRedisConnection } from '../redis';
import { logger } from '../logger';
import { handleFamilyInvite } from '../email/handlers/familyInvite';
import { handleForgotPassword } from '../email/handlers/forgotPassword';
import { broadcast } from '../websocket/broadcast';
import { sendEmail } from '../email/send';
import type { FamilyInvitePayload, ForgotPasswordPayload, ManualEmailPayload } from './types';

// NOTE: retry attempts and backoff must be configured by the producer when enqueuing.
// Recommended: { attempts: 3, backoff: { type: 'exponential', delay: 2000 } }

async function dispatch(job: Job): Promise<void> {
  switch (job.name) {
    case 'family_invite':
      await handleFamilyInvite(job.data as FamilyInvitePayload);
      break;

    case 'forgot_password':
      await handleForgotPassword(job.data as ForgotPasswordPayload);
      break;

    case 'manual_email': {
      const { to, subject, html } = job.data as ManualEmailPayload;
      await sendEmail({ to, subject, html });
      break;
    }

    default:
      throw new Error(`Unknown job type: ${job.name}`);
  }
}

export function startWorker(wss: WebSocket.Server): Worker {
  const connection = createRedisConnection();

  const worker = new Worker(
    'email',
    async (job: Job) => {
      logger.info('Processing job', { jobId: job.id, type: job.name });
      await dispatch(job);
    },
    {
      connection,
      concurrency: 5,
    },
  );

  worker.on('completed', (job) => {
    logger.info('Job completed', { jobId: job.id, type: job.name });

    if (job.name === 'family_invite' || job.name === 'forgot_password' || job.name === 'manual_email') {
      const data = job.data as { invitedEmail?: string; email?: string; to?: string };
      const email = data?.invitedEmail ?? data?.email ?? data?.to;
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
    logger.error('Job failed', {
      jobId: job.id,
      type: job.name,
      attempt: job.attemptsMade,
      maxAttempts: job.opts.attempts ?? 1,
      error: err.message,
    });

    const isFinal = job.attemptsMade >= (job.opts.attempts ?? 1);
    if (isFinal && (job.name === 'family_invite' || job.name === 'forgot_password' || job.name === 'manual_email')) {
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
