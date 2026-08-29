import type { ErrorRequestHandler, RequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { AppError } from '../lib/errors';
import { logger } from '../lib/logger';
import { env } from '../config/env';

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: `Rota não encontrada: ${req.method} ${req.originalUrl}` },
  });
};

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(422).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Dados inválidos.',
        details: err.flatten(),
      },
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const target = (err.meta?.target as string[] | undefined)?.join(', ') ?? 'registro';
      const isSlotLock = target.includes('slotLock');
      res.status(409).json({
        error: {
          code: isSlotLock ? 'SLOT_TAKEN' : 'DUPLICATE',
          message: isSlotLock
            ? 'Este horário acabou de ser reservado por outra pessoa. Escolha outro horário.'
            : `Já existe um registro com este valor (${target}).`,
        },
      });
      return;
    }
    if (err.code === 'P2025') {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Recurso não encontrado.' } });
      return;
    }
    if (err.code === 'P2003') {
      res.status(409).json({ error: { code: 'FK_CONSTRAINT', message: 'Registro vinculado a outros dados.' } });
      return;
    }
  }

  logger.error({ err, url: req.originalUrl, method: req.method }, 'Erro não tratado');

  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Erro interno do servidor.',
      ...(env.isProd ? {} : { debug: (err as Error)?.message }),
    },
  });
};
