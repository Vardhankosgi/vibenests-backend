import express from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { bookingCreateSchema, adminBookingSchema } from '../validation/schemas';
import { AppDataSource } from '../data-source';
import { In } from 'typeorm';
import { AddOn } from '../entities/AddOn';
import { Suite } from '../entities/Suite';
import { Booking } from '../entities/Booking';
import { Payment } from '../entities/Payment';
import { RefundCalculation } from '../entities/RefundCalculation';

import {
  createBooking,
  adminCreateBooking,
  findBookingsForUser,
  findAllBookings,
  findBookingByIdForUser,
  findBookingById,
  updateBookingStatus,
  cancelBooking,
  getMeetingLink,
  rescheduleBooking,
} from '../services/bookings.service';
import { adminCreateRazorpayLink } from '../services/razorpay-admin-link.service';


const router = express.Router();

router.use(authenticate);

router.get('/', async (req: any, res) => {
  const user = req.user;
  try {
    const bookings = user.role === 'admin' ? await findAllBookings() : await findBookingsForUser(user.id);

    // Attach suite images to each booking by looking up related Suite.images
    const suiteIds = Array.from(new Set((bookings as any[]).map((b) => b.suiteId).filter(Boolean)));
    const suiteMap = new Map<number, Suite>();
    if (suiteIds.length) {
      const suiteRepo = AppDataSource.getRepository(Suite);
      const suites = await suiteRepo.findBy({ id: In(suiteIds) });
      for (const s of suites) suiteMap.set(s.id, s);
    }

    // Attach latest refund request for each booking
    const bookingIds = (bookings as any[]).map((b) => b.id);
    const refundRepo = AppDataSource.getRepository(RefundCalculation);
    const refunds = bookingIds.length ? await refundRepo.find({ where: { bookingId: In(bookingIds) } }) : [];
    const refundMap = new Map<number, RefundCalculation>();
    for (const r of refunds) {
      if (!refundMap.has(r.bookingId) || r.createdAt > refundMap.get(r.bookingId)!.createdAt) {
        refundMap.set(r.bookingId, r);
      }
    }

    const enhanced = (bookings as any[]).map((b) => {
      const suite = suiteMap.get(b.suiteId);
      const images = (suite as any)?.images ?? [];
      return {
        ...b,
        suiteImages: Array.isArray(images) ? images : [],
        image: Array.isArray(images) && images.length ? images[0] : undefined,
        refundRequest: refundMap.get(b.id) ?? null,
      };
    });

    res.json(enhanced);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id', async (req: any, res) => {
  try {
    const user = req.user;

    const booking =
      user.role === 'admin'
        ? await findBookingById(Number(req.params.id))
        : await findBookingByIdForUser(Number(req.params.id), user.id);

    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    // Attach suite images to this booking
    const suite = await AppDataSource.getRepository(Suite).findOne({ where: { id: (booking as any).suiteId } });
    const images = (suite as any)?.images ?? [];
    (booking as any).suiteImages = Array.isArray(images) ? images : [];
    (booking as any).image = Array.isArray(images) && images.length ? images[0] : (booking as any).image;

    // Build add-ons details: name + price + quantity (quantity derived from duplicate IDs in booking.addOns)
    const addOns = Array.isArray((booking as any).addOns) ? (booking as any).addOns : [];

    const addOnCounts = addOns.reduce((acc: Record<string, number>, rawId: string) => {
      const key = String(rawId);
      if (!key) return acc;
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const addonIds = Object.keys(addOnCounts).map((x) => Number(x)).filter(Boolean);
    if (addonIds.length) {
      const addonRepo = AppDataSource.getRepository(AddOn);
      const addons = await addonRepo.findBy({ id: In(addonIds) });

      const details = addons.map((a: AddOn) => ({
        id: a.id,
        name: a.name,
        price: Number((a as any).price ?? 0),
        quantity: addOnCounts[String(a.id)] ?? 0,
      }));

      (booking as any).addOnsDetails = details;
      if (!(booking as any).addOnsNames) {
        (booking as any).addOnsNames = details.flatMap((d: any) => Array.from({ length: d.quantity }, () => d.name));
      }
    } else {
      (booking as any).addOnsDetails = [];
      (booking as any).addOnsNames = [];
    }

    // Attach latest refund request for this booking
    const refundRepo = AppDataSource.getRepository(RefundCalculation);
    const refundRequest = await refundRepo.findOne({
      where: { bookingId: booking.id },
      order: { createdAt: 'DESC' },
    });
    (booking as any).refundRequest = refundRequest ?? null;

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
      persons: p.persons,
      totalAmount: p.totalAmount,
    });
    res.status(201).json(booking);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});


router.post('/admin/create-razorpay-link', requireRole('admin'), async (req: any, res) => {
  try {
    const {
      suiteId,
      eventType,
      addOns,
      date,
      timeSlot,
      endTimeSlot,
      guestFirstName,
      guestLastName,
      guestEmail,
      guestPhone,
      totalAmount,
    } = req.body || {};

    if (!suiteId || !date || !timeSlot || !guestFirstName || !guestLastName || !guestEmail || !guestPhone || !totalAmount) {
      return res.status(400).json({ message: 'Missing required booking fields' });
    }

    const { booking, paymentLink } = await adminCreateRazorpayLink({
      suiteId: Number(suiteId),
      eventType: String(eventType ?? ''),
      addOns: (addOns || []).map(String),
      date: String(date),
      timeSlot: String(timeSlot),
      endTimeSlot: endTimeSlot ? String(endTimeSlot) : undefined,
      guestFirstName: String(guestFirstName),
      guestLastName: String(guestLastName),
      guestEmail: String(guestEmail),
      guestPhone: String(guestPhone),
      totalAmount: Number(totalAmount),
      persons: req.body.persons,
    });



    res.status(201).json({ booking, paymentLink });
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
    const { reason } = req.body || {};
    if (typeof reason !== 'string' || !reason.trim()) {
      return res.status(400).json({ message: 'Cancellation reason is required.' });
    }

    const booking = await cancelBooking(Number(req.params.id), req.user.id, reason, req.user.role);
    res.json(booking);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.patch('/:id/reschedule', async (req: any, res) => {
  try {
    const bookingId = Number(req.params.id);
    const { date, timeSlot } = req.body || {};

    if (!date || typeof date !== 'string') return res.status(400).json({ message: 'date is required' });
    if (!timeSlot || typeof timeSlot !== 'string') return res.status(400).json({ message: 'timeSlot is required' });

    const booking = await rescheduleBooking(bookingId, req.user.id, { date, timeSlot }, req.user.role);
    res.json(booking);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/:id/pay-cash', async (req: any, res) => {
  try {
    const bookingId = Number(req.params.id);
    const bookingRepo = AppDataSource.getRepository(Booking);
    const booking = await bookingRepo.findOne({ where: { id: bookingId } });
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    if (req.user.role !== 'admin' && booking.userId !== req.user.id) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    if (booking.paymentMode !== 'pay_at_venue') {
      return res.status(400).json({ message: 'Only pay_at_venue bookings support cash balance payment.' });
    }

    booking.fullPaymentReceived = true;
    booking.status = 'confirmed';
    booking.paymentStatus = 'success';
    booking.bookedBy = 'admin';

    await bookingRepo.save(booking);

    const balanceAmount = Number(booking.totalAmount) - Number(booking.advanceAmount);
    const paymentRepo = AppDataSource.getRepository(Payment);
    const cashPayment = paymentRepo.create({
      bookingId,
      amount: balanceAmount,
      method: 'cash',
      provider: 'cash',
      status: 'success',
    });
    const savedPayment = await paymentRepo.save(cashPayment);

    try {
      const { sendPaymentSuccessNotifications } = await import('../services/payments.service');
      await sendPaymentSuccessNotifications(savedPayment);
    } catch (err) {
      console.warn('Failed to send cash payment confirmation email:', err);
    }

    res.json({ success: true, booking });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/:id/meeting-link', async (req: any, res) => {
  try {
    const link = await getMeetingLink(Number(req.params.id), req.user.id, req.user.role);
    res.json({ meeting_link: link });
  } catch (err: any) {
    const status =
      err.message === 'Forbidden' ? 403 : err.message === 'Booking not found' ? 404 : 400;
    res.status(status).json({ message: err.message });
  }
});

export default router;

