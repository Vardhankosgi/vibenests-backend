import express from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { bookingCreateSchema, adminBookingSchema } from '../validation/schemas';
import { AppDataSource } from '../data-source';
import { In } from 'typeorm';
import { AddOn } from '../entities/AddOn';
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

    const booking =
      user.role === 'admin'
        ? await findBookingById(Number(req.params.id))
        : await findBookingByIdForUser(Number(req.params.id), user.id);

    if (!booking) return res.status(404).json({ message: 'Booking not found' });

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

      // Attach without removing existing properties.
      (booking as any).addOnsDetails = details;
      // Keep legacy fields used elsewhere (addOnsNames might exist on some booking payloads)
      if (!(booking as any).addOnsNames) {
        (booking as any).addOnsNames = details.flatMap((d: any) => Array.from({ length: d.quantity }, () => d.name));
      }
    } else {
      (booking as any).addOnsDetails = [];
      (booking as any).addOnsNames = [];
    }

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

router.post('/:id/meeting-link', async (req: any, res) => {
  try {
    const link = await getMeetingLink(Number(req.params.id), req.user.id, req.user.role);
    res.json({ meeting_link: link });
  } catch (err: any) {
    const status = err.message === 'Forbidden' ? 403 : err.message === 'Booking not found' ? 404 : 400;
    res.status(status).json({ message: err.message });
  }
});

export default router;
