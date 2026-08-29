import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { Role } from '@prisma/client';
import { verifyAccessToken, type AccessTokenPayload } from '../lib/jwt';
import { Forbidden, Unauthorized } from '../lib/errors';
import { prisma } from '../lib/prisma';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AccessTokenPayload;
    }
  }
}

const extractToken = (req: Request): string | null => {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7).trim();
  if (typeof req.cookies?.access_token === 'string') return req.cookies.access_token;
  return null;
};

/** Exige um usuário autenticado e ativo. */
export const authenticate: RequestHandler = async (req, _res, next) => {
  try {
    const token = extractToken(req);
    if (!token) throw Unauthorized('Token de acesso ausente.');

    let payload: AccessTokenPayload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      throw Unauthorized('Sessão expirada ou token inválido.');
    }

    // Revalida o estado do usuário no banco: bloqueios têm efeito imediato.
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, role: true, status: true, email: true, deletedAt: true },
    });

    if (!user || user.deletedAt) throw Unauthorized('Usuário não encontrado.');
    if (user.status === 'BLOQUEADO') throw Forbidden('Conta bloqueada. Fale com o suporte.');

    req.user = { ...payload, role: user.role, email: user.email };
    next();
  } catch (err) {
    next(err);
  }
};

/** Autenticação opcional — usada em rotas públicas que enriquecem a resposta se houver login. */
export const optionalAuth: RequestHandler = async (req, _res, next) => {
  const token = extractToken(req);
  if (!token) return next();
  try {
    req.user = verifyAccessToken(token);
  } catch {
    /* ignora token inválido em rota pública */
  }
  return next();
};

/** RBAC — restringe a rota a um conjunto de papéis. */
export const requireRole =
  (...roles: Role[]): RequestHandler =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(Unauthorized());
    if (!roles.includes(req.user.role)) {
      return next(Forbidden('Seu perfil não tem permissão para acessar este recurso.'));
    }
    return next();
  };

export const requireAdmin = requireRole('ADMIN');
export const requireBarber = requireRole('BARBER');
export const requireClient = requireRole('CLIENT');
