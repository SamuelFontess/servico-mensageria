import 'dotenv/config';
import { config } from './config';
import { logger } from './logger';
import { createHttpServer } from './http/server';
import { adminRouter } from './http/routes/admin';
import { setupBullBoard } from './http/bullBoard';
import { createWebSocketServer } from './websocket/server';
import { startWorker } from './queue/worker';
import { startBroadcastWorker } from './queue/broadcastWorker';

async function main(): Promise<void> {
  // 1. Cria o HTTP server (Express) sem ainda escutar
  const { server, app } = createHttpServer();

  // 2. Anexa o WebSocket server ao mesmo http.Server
  const wss = createWebSocketServer(server);

  // 3. Registra rota admin (precisa do wss já criado)
  app.use(adminRouter(wss));

  // 4. Monta o Bull Board em /admin/queues (protegido por IP + API key)
  setupBullBoard(app);

  // 5. Inicia os workers
  const emailWorker = startWorker(wss);
  const broadcastWorker = startBroadcastWorker(wss);

  // 6. Graceful shutdown: aguarda jobs em andamento antes de encerrar
  let isShuttingDown = false;

  async function shutdown(signal: string): Promise<void> {
    if (isShuttingDown) {
      logger.warn(`Received ${signal} during shutdown, ignoring`);
      return;
    }
    isShuttingDown = true;
    logger.info(`Received ${signal}, shutting down gracefully`);
    const forceExit = setTimeout(() => {
      logger.error('Graceful shutdown timed out, forcing exit');
      process.exit(1);
    }, 10_000);
    forceExit.unref();
    await Promise.all([emailWorker.close(), broadcastWorker.close()]);
    server.close(() => {
      clearTimeout(forceExit);
      logger.info('HTTP server closed');
      process.exit(0);
    });
  }

  process.on('SIGTERM', () => { shutdown('SIGTERM').catch((err) => { logger.error('Shutdown error', { error: err.message }); process.exit(1); }); });
  process.on('SIGINT', () => { shutdown('SIGINT').catch((err) => { logger.error('Shutdown error', { error: err.message }); process.exit(1); }); });

  // 7. Sobe o servidor na porta configurada
  server.listen(config.http.port, () => {
    logger.info('Email worker running', { port: config.http.port });
    logger.info('Bull Board available at /admin/queues (requires credentials + optional IP allowlist)');
  });
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
