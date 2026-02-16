import type { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ZodError } from 'zod';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { AppError } from './AppError';

export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  let normalizedError = error;

  if (error instanceof ZodError) {
    normalizedError = new AppError(
      'Validation failed',
      StatusCodes.BAD_REQUEST,
      'VALIDATION_ERROR',
      error.flatten(),
    );
  }

  if (normalizedError instanceof AppError) {
    logger.warn(
      {
        requestId: req.requestId,
        code: normalizedError.code,
        statusCode: normalizedError.statusCode,
        details: normalizedError.details,
      },
      normalizedError.message,
    );

    res.status(normalizedError.statusCode).json({
      requestId: req.requestId,
      error: {
        code: normalizedError.code,
        message: normalizedError.message,
        details: normalizedError.details,
      },
    });
    return;
  }

  logger.error({ requestId: req.requestId, error: normalizedError }, 'Unhandled error');
  const isProduction = env.nodeEnv === 'production';
  const debugMessage =
    normalizedError instanceof Error ? normalizedError.message : 'Internal server error';
  res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
    requestId: req.requestId,
    error: {
      code: 'INTERNAL_ERROR',
      message: isProduction ? 'Internal server error' : debugMessage,
      details:
        isProduction || !(normalizedError instanceof Error)
          ? undefined
          : { name: normalizedError.name },
    },
  });
}
