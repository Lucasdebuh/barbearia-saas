import type { Prisma, Role, User } from '@prisma/client';
import dayjs from 'dayjs';
import { prisma } from '../../lib/prisma';
import { hashPassword, randomToken, sha256, verifyPassword } from '../../lib/crypto';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../lib/jwt';
import { BadRequest, Conflict, Forbidden, NotFound, Unauthorized } from '../../lib/errors';
import { uniqueSlug } from '../../lib/slug';
import { env } from '../../config/env';
import { logger } from '../../lib/logger';
import type { RegisterInput } from './auth.schemas';

const TERMS_VERSION = '1.0';

export interface SessionContext {
  ip?: string;
  userAgent?: string;
}

const buildAccessToken = async (user: User) => {
  const [barber, client] = await Promise.all([
    user.role === 'BARBER' ? prisma.barber.findUnique({ where: { userId: user.id }, select: { id: true } }) : null,
    user.role === 'CLIENT' ? prisma.client.findUnique({ where: { userId: user.id }, select: { id: true } }) : null,
  ]);

  return signAccessToken({
    sub: user.id,
    role: user.role,
    email: user.email,
    barberId: barber?.id ?? null,
    clientId: client?.id ?? null,
  });
};

const issueRefreshToken = async (userId: string, ctx: SessionContext) => {
  const jti = randomToken(24);
  const token = signRefreshToken(userId, jti);
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: sha256(token),
      ip: ctx.ip,
      userAgent: ctx.userAgent?.slice(0, 255),
      expiresAt: dayjs().add(env.JWT_REFRESH_EXPIRES_DAYS, 'day').toDate(),
    },
  });
  return token;
};

export const publicUser = (user: User & { barber?: { id: string; slug: string } | null; client?: { id: string } | null }) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  role: user.role,
  status: user.status,
  avatarUrl: user.avatarUrl,
  emailVerified: user.emailVerified,
  createdAt: user.createdAt,
  barberId: user.barber?.id ?? null,
  barberSlug: user.barber?.slug ?? null,
  clientId: user.client?.id ?? null,
});

export const register = async (input: RegisterInput, ctx: SessionContext) => {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw Conflict('Já existe uma conta com este e-mail.');

  const passwordHash = await hashPassword(input.password);
  const emailVerifyToken = randomToken(24);

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        name: input.name,
        email: input.email,
        phone: input.phone,
        passwordHash,
        role: input.role as Role,
        status: 'ATIVO',
        emailVerifyToken,
      },
    });

    if (input.role === 'BARBER') {
      const slug = await uniqueSlug(input.shopName ?? input.name, async (candidate) =>
        Boolean(await tx.barber.findUnique({ where: { slug: candidate }, select: { id: true } })),
      );

      const barber = await tx.barber.create({
        data: {
          userId: created.id,
          slug,
          shopName: input.shopName ?? `Barbearia ${input.name.split(' ')[0]}`,
          city: input.city,
          state: input.state?.toUpperCase(),
        },
      });

      // Agenda padrão: segunda a sábado, 09:00–19:00, almoço 12:00–13:00
      await tx.availability.createMany({
        data: [1, 2, 3, 4, 5, 6].map((weekday) => ({
          barberId: barber.id,
          weekday,
          startMinute: 9 * 60,
          endMinute: weekday === 6 ? 17 * 60 : 19 * 60,
          breakStart: 12 * 60,
          breakEnd: 13 * 60,
        })),
      });

      // Assinatura em período de teste no plano de entrada
      const plan = await tx.plan.findFirst({ where: { active: true }, orderBy: { sortOrder: 'asc' } });
      if (plan) {
        const trialEnd = dayjs().add(plan.trialDays, 'day').toDate();
        await tx.subscription.create({
          data: {
            barberId: barber.id,
            planId: plan.id,
            status: 'TRIAL',
            trialEndsAt: trialEnd,
            currentPeriodEnd: trialEnd,
          },
        });
      }
    } else {
      await tx.client.create({ data: { userId: created.id, city: input.city, state: input.state?.toUpperCase() } });
    }

    await tx.consentRecord.createMany({
      data: [
        { userId: created.id, kind: 'termos_de_uso', version: TERMS_VERSION, ip: ctx.ip },
        { userId: created.id, kind: 'politica_privacidade', version: TERMS_VERSION, ip: ctx.ip },
      ],
    });

    return created;
  });

  if (!env.isProd) {
    logger.info(
      { verifyUrl: `${env.FRONTEND_URL}/verificar-email?token=${emailVerifyToken}` },
      'Link de verificação de e-mail (ambiente de desenvolvimento)',
    );
  }

  const accessToken = await buildAccessToken(user);
  const refreshToken = await issueRefreshToken(user.id, ctx);
  const full = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    include: { barber: { select: { id: true, slug: true } }, client: { select: { id: true } } },
  });

  return { user: publicUser(full), accessToken, refreshToken, emailVerifyToken: env.isProd ? undefined : emailVerifyToken };
};

export const login = async (email: string, password: string, ctx: SessionContext) => {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { barber: { select: { id: true, slug: true } }, client: { select: { id: true } } },
  });

  // Mensagem genérica: não revela se o e-mail existe (anti-enumeração).
  const genericError = Unauthorized('E-mail ou senha inválidos.');
  if (!user || user.deletedAt) throw genericError;

  const ok = await verifyPassword(user.passwordHash, password);
  if (!ok) throw genericError;

  if (user.status === 'BLOQUEADO') throw Forbidden(user.blockedReason ?? 'Conta bloqueada. Fale com o suporte.');

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  const accessToken = await buildAccessToken(user);
  const refreshToken = await issueRefreshToken(user.id, ctx);

  return { user: publicUser(user), accessToken, refreshToken };
};

export const refresh = async (token: string, ctx: SessionContext) => {
  let payload: { sub: string; jti: string };
  try {
    payload = verifyRefreshToken(token);
  } catch {
    throw Unauthorized('Refresh token inválido ou expirado.');
  }

  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
    throw Unauthorized('Sessão encerrada. Faça login novamente.');
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    include: { barber: { select: { id: true, slug: true } }, client: { select: { id: true } } },
  });
  if (!user || user.deletedAt) throw Unauthorized();
  if (user.status === 'BLOQUEADO') throw Forbidden('Conta bloqueada.');

  // Rotação de refresh token: o antigo é revogado a cada uso.
  await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });

  const accessToken = await buildAccessToken(user);
  const refreshToken = await issueRefreshToken(user.id, ctx);

  return { user: publicUser(user), accessToken, refreshToken };
};

export const logout = async (token?: string, userId?: string) => {
  if (token) {
    await prisma.refreshToken.updateMany({
      where: { tokenHash: sha256(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return;
  }
  if (userId) {
    await prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
  }
};

export const forgotPassword = async (email: string) => {
  const user = await prisma.user.findUnique({ where: { email } });
  // Sempre responde sucesso para não vazar quais e-mails existem.
  if (!user || user.deletedAt) return { sent: true as const };

  const resetToken = randomToken(24);
  await prisma.user.update({
    where: { id: user.id },
    data: { resetToken, resetTokenExpires: dayjs().add(1, 'hour').toDate() },
  });

  const resetUrl = `${env.FRONTEND_URL}/redefinir-senha?token=${resetToken}`;
  if (!env.isProd) logger.info({ resetUrl }, 'Link de redefinição de senha (ambiente de desenvolvimento)');

  return { sent: true as const, resetToken: env.isProd ? undefined : resetToken };
};

export const resetPassword = async (token: string, password: string) => {
  const user = await prisma.user.findUnique({ where: { resetToken: token } });
  if (!user || !user.resetTokenExpires || user.resetTokenExpires < new Date()) {
    throw BadRequest('Link de redefinição inválido ou expirado. Solicite um novo.');
  }

  const passwordHash = await hashPassword(password);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, resetToken: null, resetTokenExpires: null },
    }),
    // Invalida todas as sessões após troca de senha
    prisma.refreshToken.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);

  return { ok: true as const };
};

export const changePassword = async (userId: string, currentPassword: string, newPassword: string) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const ok = await verifyPassword(user.passwordHash, currentPassword);
  if (!ok) throw BadRequest('A senha atual está incorreta.');

  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
    prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);

  return { ok: true as const };
};

export const verifyEmail = async (token: string) => {
  const user = await prisma.user.findUnique({ where: { emailVerifyToken: token } });
  if (!user) throw NotFound('Token de verificação inválido.');
  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerified: true, emailVerifyToken: null },
  });
  return { ok: true as const };
};

export const me = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { barber: { select: { id: true, slug: true } }, client: { select: { id: true } } },
  });
  if (!user) throw NotFound('Usuário não encontrado.');
  return publicUser(user);
};

export type UserWithProfiles = Prisma.UserGetPayload<{
  include: { barber: { select: { id: true; slug: true } }; client: { select: { id: true } } };
}>;
