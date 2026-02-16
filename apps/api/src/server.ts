import { createServer } from 'node:http';
import { app } from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { liveHub } from './realtime/liveHub';

const httpServer = createServer(app);
liveHub.init(httpServer);

const server = httpServer.listen(env.port, () => {
  logger.info(`MedLedger API listening on http://localhost:${env.port}`);
});

process.on('SIGINT', () => {
  logger.info('Received SIGINT. Closing API server.');
  liveHub.shutdown();
  server.close(() => process.exit(0));
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM. Closing API server.');
  liveHub.shutdown();
  server.close(() => process.exit(0));
});
