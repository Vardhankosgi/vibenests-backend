import express from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { bookingCreateSchema, adminBookingSchema } from '../validation/schemas';
import {
  createBooking,
  adminCreateBooking,
  findBookingsForUser,
  findAllBookings,
  findBookingByIdForUser,
  findBookingById,
  updateBookingStatus,
  cancelBooking,
} from '../services/bookings.service';

const router = express.Router();

router.use(authenticate);

router.get('/', async (req: any, res) => {
  const user = req.user;
  try {
    if (user.role === 'admin') {
      const all = await findAllBookings();
      return res.json(all);
    }
    const list = await findBookingsForUser(user.id);
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id', async (req: any, res) => {
  try {
    const user = req.user;
    if (user.role === 'admin') {
      const booking = await findBookingById(Number(req.params.id));
      if (!booking) return res.status(404).json({ message: 'Booking not found' });
      return res.json(booking);
    }
    const booking = await findBookingByIdForUser(Number(req.params.id), user.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    res.json(booking);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', validateBody(bookingCreateSchema), async (req: any, res) => {
  try {
    const payload = req.body;
    const booking = await createBooking({
      userId: req.user.id,
      suiteId: payload.suiteId,
      suiteName: payload.suiteName,
      eventType: payload.eventType || 'General Event',
      addOns: payload.addOns,
      date: payload.date,
      timeSlot: payload.timeSlot,
      endTimeSlot: payload.endTimeSlot,
      persons: payload.persons,
      basePrice: payload.basePrice,
      addonsTotal: payload.addonsTotal,
      savings: payload.savings,
      serviceFee: payload.serviceFee,
      taxes: payload.taxes,
      totalAmount: payload.totalAmount,
      paymentMode: payload.paymentMode,
      advanceAmount: payload.advanceAmount,
    });
    res.status(201).json(booking);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/admin', requireRole('admin'), validateBody(adminBookingSchema), async (req: any, res) => {
  try {
    const p = req.body;
    const booking = await adminCreateBooking({
      suiteId: p.suiteId,
      eventType: p.eventType,
      addOns: (p.addOns || []).map(String),
      date: p.date,
      timeSlot: p.timeSlot,
      endTimeSlot: p.endTimeSlot,
      guestFirstName: p.guestFirstName,
      guestLastName: p.guestLastName,
      guestEmail: p.guestEmail,
      guestPhone: p.guestPhone,
      totalAmount: p.totalAmount,
    });
    res.status(201).json(booking);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.patch('/:id/status', authenticate, requireRole('admin'), async (req: any, res) => {
  try {
    const { status } = req.body;
    const booking = await updateBookingStatus(Number(req.params.id), status);
    res.json(booking);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.patch('/:id/cancel', async (req: any, res) => {
  try {
    const booking = await cancelBooking(Number(req.params.id), req.user.id);
    res.json(booking);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

export default router;
