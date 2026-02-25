import 'dotenv/config';
import { config } from './config';
import { logger } from './logger';
import { createHttpServer } from './http/server';
import { adminRouter } from './http/routes/admin';
import { setupBullBoard } from './http/bullBoard';
import { createWebSocketServer } from './websocket/server';
import { startWorker } from './queue/worker';

async function main(): Promise<void> {
  // 1. Cria o HTTP server (Express) sem ainda escutar
  const { server, app } = createHttpServer();

  // 2. Anexa o WebSocket server ao mesmo http.Server
  const wss = createWebSocketServer(server);

  // 3. Registra rota admin (precisa do wss já criado)
  app.use(adminRouter(wss));

  // 4. Monta o Bull Board em /admin/queues (protegido por API key)
  setupBullBoard(app);

  // 5. Inicia o BullMQ Worker
  startWorker(wss);

  // 6. Sobe o servidor na porta configurada
  server.listen(config.http.port, () => {
    logger.info('Email worker running', { port: config.http.port });
    logger.info('Bull Board available at /admin/queues (requires X-Admin-Key header)');
  });
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
