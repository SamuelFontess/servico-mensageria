import WebSocket from 'ws';
import type { Server, IncomingMessage } from 'http';
import { URL } from 'url';
import { config } from '../config';
import { logger } from '../logger';

type AliveClient = WebSocket & { isAlive: boolean };

function isAuthorized(req: IncomingMessage): boolean {
  try {
    const url = new URL(req.url ?? '/', `http://localhost`);
    return url.searchParams.get('token') === config.http.adminApiKey;
  } catch {
    return false;
  }
}

export function createWebSocketServer(httpServer: Server): WebSocket.Server {
  const wss = new WebSocket.Server({ server: httpServer });

  const heartbeat = setInterval(() => {
    wss.clients.forEach((ws) => {
      const client = ws as AliveClient;
      if (!client.isAlive) {
        client.terminate();
        return;
      }
      client.isAlive = false;
      client.ping();
    });
  }, config.ws.heartbeatIntervalMs);

  wss.on('connection', (ws, req) => {
    if (!isAuthorized(req)) {
      ws.close(4401, 'Unauthorized');
      logger.warn('WebSocket connection rejected — missing or invalid token', {
        ip: req.socket.remoteAddress,
      });
      return;
    }

    const client = ws as AliveClient;
    client.isAlive = true;
    client.on('pong', () => { client.isAlive = true; });
    logger.info('WebSocket client connected', { total: wss.clients.size });
  });

  wss.on('close', () => clearInterval(heartbeat));

  logger.info('WebSocket server attached to HTTP server');
  return wss;
}
