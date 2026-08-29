import type { NextFunction, Request, RequestHandler, Response } from 'express';

/** Envolve handlers assíncronos para que erros cheguem ao error-handler do Express. */
export const asyncHandler =
  <T extends RequestHandler>(fn: T): RequestHandler =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

export interface PageMeta {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

export const paginated = <T>(data: T[], total: number, page: number, perPage: number) => ({
  data,
  meta: {
    page,
    perPage,
    total,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
  } satisfies PageMeta,
});

export const parsePagination = (query: Record<string, unknown>) => {
  const page = Math.max(1, Number(query.page ?? 1) || 1);
  const perPage = Math.min(100, Math.max(1, Number(query.perPage ?? 20) || 20));
  return { page, perPage, skip: (page - 1) * perPage, take: perPage };
};
