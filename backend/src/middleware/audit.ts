import type { Request } from 'express';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';

export interface AuditInput {
  action: string;
  entity?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}

export const clientIp = (req: Request) =>
  (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ?? req.ip ?? undefined;

/**
 * Registra uma ação relevante na trilha de auditoria.
 * Nunca lança: auditoria não pode derrubar a requisição principal.
 */
export const audit = async (req: Request, input: AuditInput) => {
  try {
    await prisma.auditLog.create({
      data: {
        userId: req.user?.sub ?? null,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId,
        ip: clientIp(req),
        userAgent: req.headers['user-agent']?.slice(0, 255),
        metadata: (input.metadata ?? {}) as object,
      },
    });
  } catch (err) {
    logger.warn({ err, action: input.action }, 'Falha ao gravar audit log');
  }
};
