import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { env } from './config/env';
import { logger } from './config/logger';
import { apiRouter } from './routes';
import { requestIdMiddleware } from './middleware/requestId.middleware';
import { requestSignerMiddleware } from './middleware/requestSigner.middleware';
import { notFoundMiddleware } from './middleware/notFound.middleware';
import { errorHandler } from './core/errors/errorHandler';
import { liveHub } from './realtime/liveHub';

export const app = express();

app.disable('x-powered-by');
app.use(
  cors({
    origin: env.corsOrigin,
    credentials: true,
  }),
);
app.use(helmet());
app.use(requestIdMiddleware);
app.use(
  pinoHttp({
    logger,
    customProps: (req) => ({
      requestId: req.requestId,
    }),
  }),
);
app.use(express.json({ limit: '12mb' }));
app.use(express.urlencoded({ extended: false, limit: '12mb' }));
app.use(requestSignerMiddleware);
app.use((req, res, next) => {
  res.on('finish', () => {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
      return;
    }

    if (res.statusCode >= 400) {
      return;
    }

    liveHub.publishDataChange({
      method: req.method,
      path: req.originalUrl,
      requestId: req.requestId,
    });
  });
  next();
});
app.use('/api', apiRouter);
app.use(notFoundMiddleware);
app.use(errorHandler);
