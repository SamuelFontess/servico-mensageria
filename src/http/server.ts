import http from 'http';
import express from 'express';

export function createHttpServer(): { server: http.Server; app: express.Application } {
  const app = express();
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  const server = http.createServer(app);
  return { server, app };
}
