import type { Request, Response, NextFunction } from 'express';
import { config } from '../../config';

// Autenticação para chamadas de API (curl, fetch): header X-Admin-Key
export function adminAuth(req: Request, res: Response, next: NextFunction): void {
  const key = req.headers['x-admin-key'];
  if (!key || key !== config.http.adminApiKey) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}

// Autenticação para acesso via browser (Bull Board): HTTP Basic Auth
// Username: admin | Password: ADMIN_API_KEY
export function basicAdminAuth(req: Request, res: Response, next: NextFunction): void {
  const authorization = req.headers.authorization;

  if (!authorization || !authorization.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Admin Dashboard"');
    res.status(401).send('Authentication required');
    return;
  }

  const credentials = Buffer.from(authorization.slice(6), 'base64').toString('utf-8');
  const colonIndex = credentials.indexOf(':');
  const password = colonIndex !== -1 ? credentials.slice(colonIndex + 1) : credentials;

  if (password !== config.http.adminApiKey) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Admin Dashboard"');
    res.status(401).send('Invalid credentials');
    return;
  }

  next();
}
