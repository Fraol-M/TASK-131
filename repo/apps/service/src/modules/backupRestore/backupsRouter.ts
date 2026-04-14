import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { backupService } from './backupService.js';

export const backupsRouter = Router();

backupsRouter.use(authMiddleware);

backupsRouter.get('/', requirePermission('backups:backup'), async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try { res.json({ data: await backupService.listBackups() }); } catch (err) { next(err); }
});

backupsRouter.post('/', requirePermission('backups:backup'), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const backup = await backupService.createBackup({
      triggeredBy: 'manual',
      triggeredByUserId: req.session!.userId,
      destinationPath: (req.body as { destinationPath?: string }).destinationPath,
    });
    res.status(201).json({ data: backup });
  } catch (err) { next(err); }
});

backupsRouter.get('/:id', requirePermission('backups:backup'), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const backup = await backupService.getBackup(req.params['id']!);
    if (!backup) { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Backup not found' } }); return; }
    res.json({ data: backup });
  } catch (err) { next(err); }
});
