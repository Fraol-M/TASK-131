import { Router } from 'express';
import path from 'path';
import type { Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { settingsService } from './settingsService.js';

export const settingsRouter = Router();

settingsRouter.use(authMiddleware);

// GET /api/settings — read current admin settings
settingsRouter.get(
  '/',
  requirePermission('backups:backup'),
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const [settings, backupDestination] = await Promise.all([
        settingsService.getAllSettings(),
        settingsService.getBackupDestination(),
      ]);
      res.json({ data: { settings, backupDestination } });
    } catch (err) { next(err); }
  },
);

// GET /api/settings/backup-destination — read the current backup destination
settingsRouter.get(
  '/backup-destination',
  requirePermission('backups:backup'),
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const destinationPath = await settingsService.getBackupDestination();
      res.json({ data: { destinationPath } });
    } catch (err) { next(err); }
  },
);

// PUT /api/settings/backup-destination — persist the folder where backups are written
settingsRouter.put(
  '/backup-destination',
  requirePermission('backups:backup'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { destinationPath } = req.body as { destinationPath?: string };
      if (!destinationPath || typeof destinationPath !== 'string' || !destinationPath.trim()) {
        res.status(400).json({ error: { code: 'REQUIRED', message: 'destinationPath is required' } });
        return;
      }
      const absPath = path.resolve(destinationPath.trim());
      await settingsService.setBackupDestination(absPath, req.session!.userId);
      res.json({ data: { destinationPath: absPath } });
    } catch (err) { next(err); }
  },
);
