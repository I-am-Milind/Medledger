import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';
import { StatusCodes } from 'http-status-codes';
import { AppError } from '../core/errors/AppError';

export function validateBody<T>(schema: ZodType<T>): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(
        new AppError(
          'Request body validation failed',
          StatusCodes.BAD_REQUEST,
          'VALIDATION_ERROR',
          result.error.flatten(),
        ),
      );
      return;
    }

    req.body = result.data;
    next();
  };
}

export function validateQuery<T>(schema: ZodType<T>): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      next(
        new AppError(
          'Request query validation failed',
          StatusCodes.BAD_REQUEST,
          'VALIDATION_ERROR',
          result.error.flatten(),
        ),
      );
      return;
    }

    req.validatedQuery = result.data;
    next();
  };
}
