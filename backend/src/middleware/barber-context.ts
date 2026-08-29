import type { RequestHandler } from 'express';
import { prisma } from '../lib/prisma';
import { Forbidden, NotFound, PaymentRequired } from '../lib/errors';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      barberId?: string;
      clientId?: string;
    }
  }
}

/** Resolve o barbeiro logado e injeta req.barberId. */
export const loadBarber: RequestHandler = async (req, _res, next) => {
  try {
    if (!req.user) throw Forbidden();
    const barber = await prisma.barber.findUnique({
      where: { userId: req.user.sub },
      select: { id: true },
    });
    if (!barber) throw NotFound('Perfil de barbeiro não encontrado.');
    req.barberId = barber.id;
    next();
  } catch (err) {
    next(err);
  }
};

/** Resolve o cliente logado e injeta req.clientId. */
export const loadClient: RequestHandler = async (req, _res, next) => {
  try {
    if (!req.user) throw Forbidden();
    const client = await prisma.client.findUnique({
      where: { userId: req.user.sub },
      select: { id: true },
    });
    if (!client) throw NotFound('Perfil de cliente não encontrado.');
    req.clientId = client.id;
    next();
  } catch (err) {
    next(err);
  }
};

const ACTIVE_STATUSES: readonly string[] = ['TRIAL', 'ATIVA'];

/**
 * Exige assinatura ativa (ou dentro do período de tolerância) para recursos pagos.
 */
export const requireActiveSubscription: RequestHandler = async (req, _res, next) => {
  try {
    if (!req.barberId) throw Forbidden();
    const subscription = await prisma.subscription.findFirst({
      where: { barberId: req.barberId },
      orderBy: { createdAt: 'desc' },
      include: { plan: true },
    });

    if (!subscription) throw PaymentRequired('Nenhuma assinatura encontrada. Escolha um plano para continuar.');

    const now = new Date();
    const withinGrace = subscription.graceUntil ? subscription.graceUntil > now : false;
    const active = ACTIVE_STATUSES.includes(subscription.status) && subscription.currentPeriodEnd > now;

    if (!active && !withinGrace) {
      throw PaymentRequired('Sua assinatura está inativa. Regularize o pagamento para reativar a conta.');
    }
    next();
  } catch (err) {
    next(err);
  }
};

type PlanFeature = 'onlinePayments' | 'reports' | 'advancedStats' | 'customProfile' | 'featuredListing';

/** Exige que o plano contratado libere determinado recurso. */
export const requirePlanFeature =
  (feature: PlanFeature): RequestHandler =>
  async (req, _res, next) => {
    try {
      if (!req.barberId) throw Forbidden();
      const subscription = await prisma.subscription.findFirst({
        where: { barberId: req.barberId, status: { in: ['TRIAL', 'ATIVA'] } },
        orderBy: { createdAt: 'desc' },
        include: { plan: true },
      });
      if (!subscription?.plan[feature]) {
        throw PaymentRequired('Este recurso não está disponível no seu plano atual. Faça upgrade para liberar.');
      }
      next();
    } catch (err) {
      next(err);
    }
  };
