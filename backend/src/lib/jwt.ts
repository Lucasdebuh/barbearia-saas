import jwt from 'jsonwebtoken';
import type { Role } from '@prisma/client';
import { env } from '../config/env';

export interface AccessTokenPayload {
  sub: string;
  role: Role;
  email: string;
  barberId?: string | null;
  clientId?: string | null;
}

export const signAccessToken = (payload: AccessTokenPayload) =>
  jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES,
    issuer: 'barbearia-saas',
    audience: 'barbearia-app',
  } as jwt.SignOptions);

export const verifyAccessToken = (token: string): AccessTokenPayload =>
  jwt.verify(token, env.JWT_SECRET, {
    issuer: 'barbearia-saas',
    audience: 'barbearia-app',
  }) as AccessTokenPayload;

export const signRefreshToken = (userId: string, jti: string) =>
  jwt.sign({ sub: userId, jti }, env.JWT_REFRESH_SECRET, {
    expiresIn: `${env.JWT_REFRESH_EXPIRES_DAYS}d`,
    issuer: 'barbearia-saas',
    audience: 'barbearia-refresh',
  } as jwt.SignOptions);

export const verifyRefreshToken = (token: string) =>
  jwt.verify(token, env.JWT_REFRESH_SECRET, {
    issuer: 'barbearia-saas',
    audience: 'barbearia-refresh',
  }) as { sub: string; jti: string };
