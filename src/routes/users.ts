import express from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { AppDataSource } from '../data-source';
import { User } from '../entities/User';

const router = express.Router();
const repo = () => AppDataSource.getRepository(User);

router.get('/', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const users = await repo().find();
    res.json(users.map(u => ({ id: u.id, fullName: u.fullName, email: u.email, role: u.role, createdAt: u.createdAt })));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/me', authenticate, async (req: any, res) => {
  try {
    const user = await repo().findOneBy({ id: req.user.id });
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ id: user.id, fullName: user.fullName, email: user.email, role: user.role });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
