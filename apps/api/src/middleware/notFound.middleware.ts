import type { RequestHandler } from 'express';
import { StatusCodes } from 'http-status-codes';
import { AppError } from '../core/errors/AppError';

export const notFoundMiddleware: RequestHandler = (req, _res, next) => {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, StatusCodes.NOT_FOUND, 'NOT_FOUND'));
};
