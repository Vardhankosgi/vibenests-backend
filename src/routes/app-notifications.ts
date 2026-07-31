import express from 'express';
import { authenticate } from '../middleware/auth';
import { listMyNotifications, markNotificationRead, markAllNotificationsRead } from '../services/app-notifications.service';

const router = express.Router();

router.get('/my', authenticate, async (req: any, res) => {
  try {
    const data = await listMyNotifications(req.user);
    res.json(data);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.patch('/mark-all-read', authenticate, async (req: any, res) => {
  try {
    const result = await markAllNotificationsRead(req.user);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.patch('/:id/read', authenticate, async (req: any, res) => {
  try {
    const result = await markNotificationRead(Number(req.params.id), req.user);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

export default router;
