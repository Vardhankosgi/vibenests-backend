import { AppDataSource } from '../data-source';
import { AppNotification } from '../entities/AppNotification';

const repo = () => AppDataSource.getRepository(AppNotification);

export const createAppNotification = async (payload: {
  userId?: number | null;
  targetRole?: string;
  title: string;
  message: string;
  type?: string;
  referenceId?: string | number | null;
}) => {
  try {
    const notification = repo().create({
      userId: payload.userId ?? null,
      targetRole: payload.targetRole || 'customer',
      title: payload.title,
      message: payload.message,
      type: payload.type || 'system',
      referenceId: payload.referenceId ? String(payload.referenceId) : null,
      isRead: false,
    });
    return await repo().save(notification);
  } catch (err) {
    console.warn('Failed to create app notification:', err);
    return null;
  }
};

export const listMyNotifications = async (user: { id: number; role: string }) => {
  const isAdmin = ['admin', 'superadmin', 'owner'].includes(user.role?.toLowerCase());
  
  if (isAdmin) {
    return repo().find({
      where: [
        { targetRole: 'admin' },
        { targetRole: 'all' },
        { userId: user.id }
      ],
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  return repo().find({
    where: [
      { userId: user.id },
      { targetRole: 'customer' }
    ],
    order: { createdAt: 'DESC' },
    take: 50,
  });
};

export const markNotificationRead = async (id: number, user: { id: number; role: string }) => {
  const notification = await repo().findOneBy({ id });
  if (!notification) throw new Error('Notification not found');
  notification.isRead = true;
  return repo().save(notification);
};

export const markAllNotificationsRead = async (user: { id: number; role: string }) => {
  const isAdmin = ['admin', 'superadmin', 'owner'].includes(user.role?.toLowerCase());
  const list = await listMyNotifications(user);
  const unreadIds = list.filter(n => !n.isRead).map(n => n.id);
  if (unreadIds.length > 0) {
    await repo().update(unreadIds, { isRead: true });
  }
  return { success: true, count: unreadIds.length };
};
