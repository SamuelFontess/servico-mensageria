import WebSocket from 'ws';
import type { Server } from 'http';
import { config } from '../config';
import { logger } from '../logger';

type AliveClient = WebSocket & { isAlive: boolean };

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

  wss.on('connection', (ws) => {
    const client = ws as AliveClient;
    client.isAlive = true;
    client.on('pong', () => { client.isAlive = true; });
    logger.info('WebSocket client connected', { total: wss.clients.size });
  });

  wss.on('close', () => clearInterval(heartbeat));

  logger.info('WebSocket server attached to HTTP server');
  return wss;
}
