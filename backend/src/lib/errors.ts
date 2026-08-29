export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code = 'APP_ERROR',
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const BadRequest = (msg = 'Requisição inválida', details?: unknown) =>
  new AppError(400, msg, 'BAD_REQUEST', details);
export const Unauthorized = (msg = 'Não autenticado') => new AppError(401, msg, 'UNAUTHORIZED');
export const Forbidden = (msg = 'Acesso negado') => new AppError(403, msg, 'FORBIDDEN');
export const NotFound = (msg = 'Recurso não encontrado') => new AppError(404, msg, 'NOT_FOUND');
export const Conflict = (msg = 'Conflito de dados') => new AppError(409, msg, 'CONFLICT');
export const UnprocessableEntity = (msg = 'Dados inválidos', details?: unknown) =>
  new AppError(422, msg, 'UNPROCESSABLE_ENTITY', details);
export const TooManyRequests = (msg = 'Muitas requisições') => new AppError(429, msg, 'TOO_MANY_REQUESTS');
export const PaymentRequired = (msg = 'Assinatura inativa') => new AppError(402, msg, 'PAYMENT_REQUIRED');
