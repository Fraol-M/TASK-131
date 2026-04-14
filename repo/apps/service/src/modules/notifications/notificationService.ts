import { randomUUID } from 'crypto';
import { getDb } from '../../persistence/mongoClient.js';
import type { Notification, NotificationMilestone, NotificationPreference } from '@nexusorder/shared-types';

export const notificationService = {
  async create(params: {
    userId: string;
    milestone: NotificationMilestone;
    title: string;
    body: string;
    relatedEntityType?: Notification['relatedEntityType'];
    relatedEntityId?: string;
  }): Promise<Notification | null> {
    // Check user preferences before creating
    const pref = await getDb()
      .collection<NotificationPreference>('notification_preferences')
      .findOne({ userId: params.userId, milestone: params.milestone });

    // Default to on-screen=true if no preference set
    if (pref && !pref.onScreen) return null; // user opted out

    const notification: Notification & { _id: string } = {
      _id: randomUUID(),
      userId: params.userId,
      milestone: params.milestone,
      title: params.title,
      body: params.body,
      relatedEntityType: params.relatedEntityType,
      relatedEntityId: params.relatedEntityId,
      isRead: false,
      createdAt: new Date(),
    };

    await getDb().collection<Notification>('notifications').insertOne(notification);
    return notification;
  },

  async listForUser(userId: string, unreadOnly = false): Promise<Notification[]> {
    const filter: Record<string, unknown> = { userId };
    if (unreadOnly) filter['isRead'] = false;
    return getDb().collection<Notification>('notifications').find(filter).sort({ createdAt: -1 }).toArray();
  },

  async markRead(notificationId: string, userId: string): Promise<void> {
    await getDb().collection<Notification>('notifications').updateOne(
      { _id: notificationId, userId } as { _id: string; userId: string },
      { $set: { isRead: true, readAt: new Date() } },
    );
  },
};
