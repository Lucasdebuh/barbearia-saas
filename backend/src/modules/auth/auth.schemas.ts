import { z } from 'zod';

export const passwordSchema = z
  .string()
  .min(8, 'A senha deve ter no mínimo 8 caracteres')
  .max(72, 'A senha deve ter no máximo 72 caracteres')
  .regex(/[a-z]/, 'A senha deve conter ao menos uma letra minúscula')
  .regex(/[A-Z]/, 'A senha deve conter ao menos uma letra maiúscula')
  .regex(/[0-9]/, 'A senha deve conter ao menos um número');

export const emailSchema = z.string().trim().toLowerCase().email('E-mail inválido');

export const registerSchema = z.object({
  name: z.string().trim().min(3, 'Informe seu nome completo').max(120),
  email: emailSchema,
  phone: z
    .string()
    .trim()
    .regex(/^[0-9()+\-\s]{10,20}$/, 'Telefone inválido')
    .optional(),
  password: passwordSchema,
  role: z.enum(['BARBER', 'CLIENT']).default('CLIENT'),
  shopName: z.string().trim().min(3).max(120).optional(),
  city: z.string().trim().max(80).optional(),
  state: z.string().trim().length(2).optional(),
  acceptedTerms: z.literal(true, {
    errorMap: () => ({ message: 'É necessário aceitar os Termos de Uso e a Política de Privacidade' }),
  }),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Informe a senha'),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(10).optional(),
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z.object({
  token: z.string().min(10),
  password: passwordSchema,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});

export const verifyEmailSchema = z.object({ token: z.string().min(10) });

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
