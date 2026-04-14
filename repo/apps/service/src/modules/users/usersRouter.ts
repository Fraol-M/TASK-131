import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { createUserSchema, updateBlacklistSchema, fingerprintConsentSchema, fingerprintSubmitSchema } from '@nexusorder/shared-validation';
import { usersService } from './usersService.js';
import { deviceFingerprintService } from './deviceFingerprintService.js';

export const usersRouter = Router();

// All user routes require auth
usersRouter.use(authMiddleware);

// GET /api/users — admin only
usersRouter.get(
  '/',
  requirePermission('users:manage_users'),
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const users = await usersService.listUsers();
      res.json({ data: users });
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/users — create user (admin only)
usersRouter.post(
  '/',
  requirePermission('users:manage_users'),
  validate(createUserSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await usersService.createUser(req.body as Parameters<typeof usersService.createUser>[0]);
      res.status(201).json({ data: user });
    } catch (err) {
      next(err);
    }
  },
);

// Static routes must be declared before dynamic /:id routes to prevent shadowing.

// POST /api/users/consent/fingerprint
usersRouter.post(
  '/consent/fingerprint',
  validate(fingerprintConsentSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { consentGiven } = req.body as { consentGiven: boolean };
      const record = await deviceFingerprintService.recordConsent(req.session!.userId, consentGiven);
      const emitAudit = res.locals['emitAudit'] as Function;
      await emitAudit('fingerprint.consent_updated', { targetType: 'user', targetId: req.session!.userId, meta: { consentGiven } });
      res.json({ data: record });
    } catch (err) { next(err); }
  },
);

// POST /api/users/fingerprint
usersRouter.post(
  '/fingerprint',
  validate(fingerprintSubmitSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { fingerprintHash } = req.body as { fingerprintHash: string };
      const result = await deviceFingerprintService.registerFingerprint(req.session!.userId, fingerprintHash);
      if (!result) {
        res.status(403).json({ error: { code: 'CONSENT_REQUIRED', message: 'Device fingerprint consent not granted' } });
        return;
      }
      res.json({ data: result });
    } catch (err) { next(err); }
  },
);

// POST /api/users/:id/blacklist
usersRouter.post(
  '/:id/blacklist',
  requirePermission('blacklists:create'),
  validate(updateBlacklistSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { reason } = req.body as { reason: string };
      await usersService.addToBlacklist(req.params['id']!, reason, req.session!.userId);
      const emitAudit = res.locals['emitAudit'] as Function;
      await emitAudit('blacklist.added', { targetType: 'user', targetId: req.params['id'] });
      res.json({ data: { message: 'User blacklisted' } });
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /api/users/:id/blacklist
usersRouter.delete(
  '/:id/blacklist',
  requirePermission('blacklists:delete'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await usersService.removeFromBlacklist(req.params['id']!, req.session!.userId);
      const emitAudit = res.locals['emitAudit'] as Function;
      await emitAudit('blacklist.removed', { targetType: 'user', targetId: req.params['id'] });
      res.json({ data: { message: 'User removed from blacklist' } });
    } catch (err) {
      next(err);
    }
  },
);

