import { Router } from 'express';
import multer from 'multer';
import type { Request, Response, NextFunction } from 'express';
import { internalAuthMiddleware } from '../middleware/internalAuth.js';
import { softAuthMiddleware } from '../middleware/auth.js';
import { updateImportService } from './updateImportService.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 500 * 1024 * 1024 } });

export const updatesRouter = Router();

// All update routes require the internal API key as a baseline transport guard.
updatesRouter.use(internalAuthMiddleware);
updatesRouter.use(softAuthMiddleware);

// For interactive operations (import / apply / rollback) the caller must also
// present a valid department_admin session cookie.  The internal key alone is
// not sufficient — it is held by the Electron main process but can be reached
// by any renderer via IPC, so a human-actor session is required as a second
// factor.  Machine-triggered operations (auto-rollback) are exempt because
// they execute during startup before any user session exists.
function requireAdminSession(req: Request, res: Response, next: NextFunction): void {
  if (!req.session || req.session.role !== 'department_admin') {
    res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Admin session required for update operations' } });
    return;
  }
  next();
}

updatesRouter.post(
  '/import',
  requireAdminSession,
  upload.single('package'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.file) { res.status(400).json({ error: { code: 'FILE_REQUIRED', message: 'Package file required' } }); return; }
      const { version } = req.body as { version: string };
      const pkg = await updateImportService.importPackage({
        filename: req.file.originalname,
        version,
        fileBuffer: req.file.buffer,
        importedBy: req.session?.userId ?? (req.headers['x-actor-id'] as string | undefined) ?? 'internal:system',
      });
      res.status(201).json({ data: pkg });
    } catch (err) { next(err); }
  },
);

updatesRouter.post(
  '/:packageId/apply',
  requireAdminSession,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { packageId } = req.params as { packageId: string };
      const result = await updateImportService.applyPackage({
        packageId,
        appliedBy: req.session?.userId ?? (req.headers['x-actor-id'] as string | undefined) ?? 'internal:system',
      });
      res.json({ data: result });
    } catch (err) { next(err); }
  },
);

updatesRouter.post(
  '/rollback',
  requireAdminSession,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { updatePackageId, reason } = req.body as { updatePackageId: string; reason: string };
      const event = await updateImportService.rollback({
        updatePackageId,
        trigger: 'manual',
        triggeredBy: req.session?.userId ?? (req.headers['x-actor-id'] as string | undefined) ?? 'internal:system',
        reason,
      });
      res.json({ data: event });
    } catch (err) { next(err); }
  },
);

// Called by the desktop when startup health check fails — automatically finds the last applied
// package, swaps build symlinks, and marks it rolled_back in the DB.
updatesRouter.post(
  '/auto-rollback',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { reason } = req.body as { reason?: string };
      const actorId = req.session?.userId
        ?? (req.headers['x-actor-id'] as string | undefined)
        ?? 'internal:system';
      const event = await updateImportService.autoRollback(reason ?? 'startup_health_check_failure', actorId);
      res.json({ data: event ?? { message: 'No applied package found — nothing to roll back' } });
    } catch (err) { next(err); }
  },
);
