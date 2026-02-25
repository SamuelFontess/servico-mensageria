import type { Request, Response, NextFunction } from 'express';
import { config } from '../../config';

export function adminAuth(req: Request, res: Response, next: NextFunction): void {
  const key = req.headers['x-admin-key'];
  if (!key || key !== config.http.adminApiKey) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}
