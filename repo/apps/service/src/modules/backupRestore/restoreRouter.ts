import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { restoreService } from './restoreService.js';

export const restoreRouter = Router();

restoreRouter.use(authMiddleware);

restoreRouter.post('/', requirePermission('restore:restore'), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { backupId } = req.body as { backupId: string };
    const event = await restoreService.restore({ backupId, restoredBy: req.session!.userId });
    res.json({ data: event });
  } catch (err) { next(err); }
});
