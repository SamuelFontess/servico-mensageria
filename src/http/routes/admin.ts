import { Router } from 'express';
import { randomUUID } from 'crypto';
import type WebSocket from 'ws';
import { adminAuth } from '../middleware/adminAuth';
import { broadcast } from '../../websocket/broadcast';
import { logger } from '../../logger';

export function adminRouter(wss: WebSocket.Server): Router {
  const router = Router();

  router.post('/admin/message', adminAuth, (req, res) => {
    const { type, content, target } = req.body as {
      type?: string;
      content?: string;
      target?: string;
    };

    if (!content || typeof content !== 'string' || !content.trim()) {
      res.status(400).json({ error: 'content is required' });
      return;
    }

    const event = {
      event: 'message' as const,
      id: randomUUID(),
      type,
      content: content.trim(),
      createdAt: new Date().toISOString(),
      target: target ?? 'broadcast',
    };

    broadcast(wss, event);
    logger.info('Admin message broadcast', { id: event.id, type: event.type });

    res.status(200).json({ id: event.id, createdAt: event.createdAt });
  });

  return router;
}
