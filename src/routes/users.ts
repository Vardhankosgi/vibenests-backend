import express from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { AppDataSource } from '../data-source';
import { User } from '../entities/User';
import { Booking } from '../entities/Booking';
import { UserMembership } from '../entities/UserMembership';
import { generatePasswordResetToken } from '../services/auth.service';
import { sendPasswordSetupEmail } from '../services/notifications.service';

const router = express.Router();
const repo = () => AppDataSource.getRepository(User);

router.get('/', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const users = await repo()
      .createQueryBuilder('u')
      .where('u.role = :role', { role: 'customer' })
      .loadRelationCountAndMap('u.bookingCount', 'u.bookings')
      .orderBy('u.createdAt', 'DESC')
      .getMany();

    const activeMemberships = await AppDataSource.getRepository(UserMembership).find({
      where: { status: 'active' }
    });
    
    const now = new Date();
    const activeMap = new Map<number, 'Silver' | 'Gold'>();
    for (const um of activeMemberships) {
      if (um.expiryDate > now) {
        activeMap.set(um.userId, um.planName);
      }
    }

    res.json(users.map((u: any) => ({
      id: u.id, fullName: u.fullName, email: u.email,
      phone: u.phone, role: u.role, isActive: u.isActive,
      isVerified: u.isVerified, createdAt: u.createdAt,
      bookingCount: u.bookingCount ?? 0,
      membership: activeMap.get(u.id) || null,
    })));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const user = await repo().findOneBy({ id: Number(req.params.id) });
    if (!user) return res.status(404).json({ message: 'User not found' });
    const bookings = await AppDataSource.getRepository(Booking).find({
      where: { userId: user.id },
      relations: ['suite'],
      order: { createdAt: 'DESC' },
    });

    const activeMembership = await AppDataSource.getRepository(UserMembership).findOne({
      where: { userId: user.id, status: 'active' }
    });
    const now = new Date();
    const isMember = activeMembership && activeMembership.expiryDate > now;

    res.json({
      id: user.id, fullName: user.fullName, email: user.email,
      phone: user.phone, role: user.role, isActive: user.isActive,
      isVerified: user.isVerified, createdAt: user.createdAt,
      membership: isMember ? activeMembership.planName : null,
      bookings: bookings.map(b => ({
        id: b.id, orderId: (b as any).orderId, suite: (b as any).suite?.name ?? `Suite ${b.suiteId}`,
        eventType: b.eventType, date: b.date, timeSlot: b.timeSlot,
        totalAmount: b.totalAmount, status: b.status, createdAt: b.createdAt,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { fullName, email, phone } = req.body;
    if (!fullName || !email) return res.status(400).json({ message: 'fullName and email are required' });
    const exists = await repo().findOneBy({ email });
    if (exists) return res.status(400).json({ message: 'User with this email already exists' });
    const user = repo().create({ fullName, email, phone, role: 'customer', isActive: false, isVerified: false });
    const saved = await repo().save(user);
    const token = generatePasswordResetToken(saved.id);
    await sendPasswordSetupEmail({ to: email, guestName: fullName, resetToken: token });
    res.status(201).json({ id: saved.id, fullName: saved.fullName, email: saved.email, phone: saved.phone, role: saved.role, isActive: saved.isActive, isVerified: saved.isVerified, createdAt: saved.createdAt, bookingCount: 0 });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/:id/resend-setup', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const user = await repo().findOneBy({ id: Number(req.params.id) });
    if (!user) return res.status(404).json({ message: 'User not found' });
    const token = generatePasswordResetToken(user.id);
    await sendPasswordSetupEmail({ to: user.email, guestName: user.fullName, resetToken: token });
    res.json({ message: 'Setup email resent' });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.patch('/:id/status', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const user = await repo().findOneBy({ id: Number(req.params.id) });
    if (!user) return res.status(404).json({ message: 'User not found' });
    user.isActive = !user.isActive;
    await repo().save(user);
    res.json({ id: user.id, isActive: user.isActive });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/me', authenticate, async (req: any, res) => {
  try {
    const user = await repo().findOneBy({ id: req.user.id });
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ id: user.id, fullName: user.fullName, email: user.email, phone: user.phone ?? '', role: user.role, dateOfBirth: user.dateOfBirth ?? null });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.patch('/me', authenticate, async (req: any, res) => {
  try {
    const user = await repo().findOneBy({ id: req.user.id });
    if (!user) return res.status(404).json({ message: 'User not found' });
    const { fullName, phone, dateOfBirth } = req.body;
    if (fullName) user.fullName = fullName;
    if (phone !== undefined) user.phone = phone;
    if (dateOfBirth !== undefined) user.dateOfBirth = dateOfBirth;
    await repo().save(user);
    res.json({ id: user.id, fullName: user.fullName, email: user.email, phone: user.phone ?? '', role: user.role, dateOfBirth: user.dateOfBirth ?? null });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
