import { Router } from 'express';
import { authService } from './authService.js';
import { authMiddleware } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { loginSchema, passwordChangeSchema } from '@nexusorder/shared-validation';
import { getDb } from '../../persistence/mongoClient.js';
import type { User } from '@nexusorder/shared-types';
import type { Request, Response, NextFunction } from 'express';

export const authRouter = Router();

// POST /api/auth/login
authRouter.post(
  '/login',
  validate(loginSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { username, password } = req.body as { username: string; password: string };
      const result = await authService.login(username, password);

      // Set session cookie (httpOnly, sameSite strict)
      res.cookie('nexusorder_session', result.token, {
        httpOnly: true,
        sameSite: 'strict',
        expires: result.expiresAt,
        secure: process.env['NODE_ENV'] === 'production',
      });

      res.json({
        data: {
          user: {
            id: result.userId,
            username: result.username,
            role: result.role,
            scope: result.scope,
            displayName: result.username,
          },
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/auth/logout
authRouter.post(
  '/logout',
  authMiddleware,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await authService.logout(req.session!.sessionId, req.session!.userId);
      res.clearCookie('nexusorder_session');
      res.json({ data: { message: 'Logged out' } });
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/auth/session
authRouter.get(
  '/session',
  authMiddleware,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await getDb().collection<User>('users').findOne(
        { _id: req.session!.userId } as { _id: string },
        { projection: { username: 1, role: 1, scope: 1 } },
      );
      res.json({
        data: {
          user: {
            id: req.session!.userId,
            username: user?.username ?? req.session!.userId,
            role: req.session!.role,
            scope: req.session!.scope,
            displayName: user?.username ?? req.session!.userId,
          },
        },
      });
    } catch (err) { next(err); }
  },
);

// POST /api/auth/change-password
authRouter.post(
  '/change-password',
  authMiddleware,
  validate(passwordChangeSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { currentPassword, newPassword } = req.body as {
        currentPassword: string;
        newPassword: string;
      };
      await authService.changePassword(req.session!.userId, currentPassword, newPassword);
      res.clearCookie('nexusorder_session');
      res.json({ data: { message: 'Password changed. Please log in again.' } });
    } catch (err) {
      next(err);
    }
  },
);
