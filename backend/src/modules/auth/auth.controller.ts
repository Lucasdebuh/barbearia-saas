import type { Request, Response } from 'express';
import { env } from '../../config/env';
import { asyncHandler } from '../../lib/http';
import { audit, clientIp } from '../../middleware/audit';
import * as service from './auth.service';

const REFRESH_COOKIE = 'refresh_token';

const cookieOptions = {
  httpOnly: true,
  secure: env.isProd,
  sameSite: env.isProd ? ('none' as const) : ('lax' as const),
  path: '/api/auth',
  maxAge: env.JWT_REFRESH_EXPIRES_DAYS * 24 * 60 * 60 * 1000,
};

const ctxOf = (req: Request) => ({ ip: clientIp(req), userAgent: req.headers['user-agent'] });

export const register = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.register(req.body, ctxOf(req));
  await audit(req, { action: 'auth.register', entity: 'User', entityId: result.user.id, metadata: { role: result.user.role } });
  res.cookie(REFRESH_COOKIE, result.refreshToken, cookieOptions);
  res.status(201).json(result);
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.login(req.body.email, req.body.password, ctxOf(req));
  await audit(req, { action: 'auth.login', entity: 'User', entityId: result.user.id });
  res.cookie(REFRESH_COOKIE, result.refreshToken, cookieOptions);
  res.json(result);
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const token: string | undefined = req.body?.refreshToken ?? req.cookies?.[REFRESH_COOKIE];
  const result = await service.refresh(token ?? '', ctxOf(req));
  res.cookie(REFRESH_COOKIE, result.refreshToken, cookieOptions);
  res.json(result);
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const token: string | undefined = req.body?.refreshToken ?? req.cookies?.[REFRESH_COOKIE];
  await service.logout(token, req.user?.sub);
  await audit(req, { action: 'auth.logout' });
  res.clearCookie(REFRESH_COOKIE, { ...cookieOptions, maxAge: undefined });
  res.status(204).send();
});

export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.forgotPassword(req.body.email);
  res.json({ ...result, message: 'Se o e-mail existir, enviaremos as instruções de redefinição.' });
});

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.resetPassword(req.body.token, req.body.password);
  await audit(req, { action: 'auth.reset_password' });
  res.json(result);
});

export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.changePassword(req.user!.sub, req.body.currentPassword, req.body.newPassword);
  await audit(req, { action: 'auth.change_password', entity: 'User', entityId: req.user!.sub });
  res.json(result);
});

export const verifyEmail = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.verifyEmail(req.body.token);
  res.json(result);
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  res.json({ user: await service.me(req.user!.sub) });
});
