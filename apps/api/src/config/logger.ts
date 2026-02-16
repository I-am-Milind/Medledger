import pino from 'pino';
import { env } from './env';

export const logger = pino({
  level: env.nodeEnv === 'production' ? 'info' : 'debug',
  redact: {
    paths: [
      'req.headers.authorization',
      '*.profile_image_base64',
      '*.verification_docs_base64',
      '*.reports_base64',
    ],
    remove: true,
  },
});
