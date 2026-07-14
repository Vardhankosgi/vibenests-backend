import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { AppDataSource } from '../data-source';
import { Review } from '../entities/Review';
import { User } from '../entities/User';

const router = Router();
const repo = () => AppDataSource.getRepository(Review);

// GET /reviews (Admin only)
router.get('/', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const reviews = await repo().find({
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });

    const suiteRepo = AppDataSource.getRepository('Suite');
    const suites = await suiteRepo.find({ select: ['id', 'name'] });
    const suiteMap = Object.fromEntries(suites.map((s: any) => [s.id, s.name]));
    
    res.json(reviews.map(r => ({
      id: r.id,
      overall: r.overall,
      ambience: r.ambience,
      cleanliness: r.cleanliness,
      service: r.service,
      decoration: r.decoration,
      value: r.value,
      comment: r.comment,
      createdAt: r.createdAt,
      suiteId: r.suiteId,
      suiteName: r.suiteId ? suiteMap[r.suiteId] : undefined,
      user: {
        id: r.user?.id,
        fullName: r.user?.fullName,
        email: r.user?.email,
      }
    })));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// POST /reviews (Authenticated customer/user)
router.post('/', authenticate, async (req: any, res) => {
  try {
    const { overall, ambience, cleanliness, service, decoration, value, comment, bookingId } = req.body;
    
    if (!overall || overall < 1 || overall > 5) {
      return res.status(400).json({ message: 'Overall rating is required and must be between 1 and 5.' });
    }
    
    const user = await AppDataSource.getRepository(User).findOneBy({ id: req.user.id });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    let suiteId: number | undefined = undefined;
    if (bookingId) {
      const booking = await AppDataSource.getRepository('Booking').findOne({
        where: { id: Number(bookingId), userId: user.id }
      });
      if (!booking) {
        return res.status(404).json({ message: 'Booking not found or does not belong to you.' });
      }
      if (booking.status !== 'completed') {
        return res.status(400).json({ message: 'You can only review completed bookings.' });
      }
      const existing = await repo().findOneBy({ bookingId: Number(bookingId) });
      if (existing) {
        return res.status(400).json({ message: 'You have already reviewed this booking.' });
      }
      suiteId = booking.suiteId;
    }
    
    const review = repo().create({
      user,
      userId: user.id,
      overall: Number(overall),
      ambience: ambience ? Number(ambience) : 0,
      cleanliness: cleanliness ? Number(cleanliness) : 0,
      service: service ? Number(service) : 0,
      decoration: decoration ? Number(decoration) : 0,
      value: value ? Number(value) : 0,
      comment: comment || '',
      bookingId: bookingId ? Number(bookingId) : undefined,
      suiteId,
    });
    
    const saved = await repo().save(review);
    res.status(201).json(saved);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE /reviews/:id (Admin only)
router.delete('/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const reviewId = Number(req.params.id);
    const review = await repo().findOneBy({ id: reviewId });
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }
    await repo().remove(review);
    res.json({ message: 'Review deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
