import { createHmac } from 'node:crypto';
import type { RequestHandler } from 'express';
import { env } from '../config/env';

function normalizeBody(body: unknown): string {
  if (!body || typeof body !== 'object') {
    return '';
  }
  return JSON.stringify(body);
}

export const requestSignerMiddleware: RequestHandler = (req, res, next) => {
  const canonicalRequest = [
    req.method.toUpperCase(),
    req.originalUrl,
    req.requestId,
    req.actor?.uid ?? 'anonymous',
    normalizeBody(req.body),
  ].join(':');

  req.requestSignature = createHmac('sha256', env.requestSigningSecret)
    .update(canonicalRequest)
    .digest('hex');

  res.setHeader('x-request-signature', req.requestSignature);
  next();
};
