import { Router } from 'express';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/auth';
import { authLimiter } from '../../middleware/rate-limit';
import * as controller from './auth.controller';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  refreshSchema,
  registerSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from './auth.schemas';

export const authRouter = Router();

authRouter.post('/register', authLimiter, validate({ body: registerSchema }), controller.register);
authRouter.post('/login', authLimiter, validate({ body: loginSchema }), controller.login);
authRouter.post('/refresh', validate({ body: refreshSchema }), controller.refresh);
authRouter.post('/logout', controller.logout);
authRouter.post('/forgot-password', authLimiter, validate({ body: forgotPasswordSchema }), controller.forgotPassword);
authRouter.post('/reset-password', authLimiter, validate({ body: resetPasswordSchema }), controller.resetPassword);
authRouter.post('/verify-email', validate({ body: verifyEmailSchema }), controller.verifyEmail);
authRouter.post('/change-password', authenticate, validate({ body: changePasswordSchema }), controller.changePassword);
authRouter.get('/me', authenticate, controller.me);
