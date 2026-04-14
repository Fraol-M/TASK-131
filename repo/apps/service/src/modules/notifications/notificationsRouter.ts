import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { notificationService } from './notificationService.js';
import { getDb } from '../../persistence/mongoClient.js';
import type { NotificationPreference } from '@nexusorder/shared-types';

export const notificationsRouter = Router();

notificationsRouter.use(authMiddleware);

notificationsRouter.get('/', requirePermission('notifications:read'), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const unreadOnly = req.query['unread'] === 'true';
    res.json({ data: await notificationService.listForUser(req.session!.userId, unreadOnly) });
  } catch (err) { next(err); }
});

notificationsRouter.post('/:id/read', requirePermission('notifications:read'), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await notificationService.markRead(req.params['id']!, req.session!.userId);
    res.json({ data: { message: 'Marked as read' } });
  } catch (err) { next(err); }
});

notificationsRouter.put('/preferences', requirePermission('notifications:read'), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { milestone, onScreen } = req.body as { milestone: string; onScreen: boolean };
    await getDb().collection<NotificationPreference>('notification_preferences').updateOne(
      { userId: req.session!.userId, milestone } as { userId: string; milestone: string },
      { $set: { onScreen, updatedAt: new Date() }, $setOnInsert: { _id: crypto.randomUUID(), userId: req.session!.userId } },
      { upsert: true },
    );
    res.json({ data: { message: 'Preference saved' } });
  } catch (err) { next(err); }
});
