import { AppDataSource } from '../data-source';
import { Booking } from '../entities/Booking';
import { User } from '../entities/User';
import { Suite } from '../entities/Suite';
import { AddOn } from '../entities/AddOn';
import { In } from 'typeorm';
import { generatePasswordResetToken } from './auth.service';
import { sendBookingConfirmationEmail, sendPasswordSetupEmail } from './notifications.service';
import { sendAccountCreatedWhatsApp, sendBookingConfirmedWhatsApp } from './whatsapp-notifications.service';


const repo = () => AppDataSource.getRepository(Booking);


export const createBooking = async (payload: {
  userId: number;
  suiteId: number;
  suiteName?: string;
  eventType: string;
  addOns?: string[];
  date: string;
  timeSlot: string;
  endTimeSlot?: string;
  persons?: number;
  basePrice?: number;
  addonsTotal?: number;
  savings?: number;
  serviceFee?: number;
  taxes?: number;
  totalAmount?: number;
  paymentMode?: 'pay_now' | 'pay_at_venue';
  advanceAmount?: number;
}) => {
  const bookingRepo = repo();
  const exists = await bookingRepo.findOneBy({ suiteId: payload.suiteId, date: payload.date, timeSlot: payload.timeSlot, status: 'confirmed' });
  if (exists) throw new Error('Slot already booked');

  const booking = bookingRepo.create({
    user: { id: payload.userId } as User,
    suiteId: payload.suiteId,
    suiteName: payload.suiteName,
    eventType: payload.eventType,
    addOns: payload.addOns || [],
    date: payload.date,
    timeSlot: payload.timeSlot,
    endTimeSlot: payload.endTimeSlot,
    persons: payload.persons ?? 1,
    basePrice: payload.basePrice ?? 0,
    addonsTotal: payload.addonsTotal ?? 0,
    savings: payload.savings ?? 0,
    serviceFee: payload.serviceFee ?? 0,
    taxes: payload.taxes ?? 0,
    totalAmount: payload.totalAmount ?? 0,
    paymentMode: payload.paymentMode ?? 'pay_now',
    advanceAmount: payload.advanceAmount ?? 0,
    status: 'pending',
    paymentStatus: 'pending',
  } as any);
  const saved = await bookingRepo.save(booking);
  return saved;

};

export const adminCreateBooking = async (payload: {
  suiteId: number;
  eventType: string;
  addOns?: string[];
  date: string;
  timeSlot: string;
  endTimeSlot?: string;
  guestFirstName: string;
  guestLastName: string;
  guestEmail: string;
  guestPhone: string;
  totalAmount: number;
}) => {
  const bookingRepo = repo();
  const userRepo = AppDataSource.getRepository(User);
  const suiteRepo = AppDataSource.getRepository(Suite);
  const addonRepo = AppDataSource.getRepository(AddOn);

  const exists = await bookingRepo.findOneBy({ suiteId: payload.suiteId, date: payload.date, timeSlot: payload.timeSlot, status: 'confirmed' });
  if (exists) throw new Error('Slot already booked for this date and time');

  // ── Upsert guest user ──────────────────────────────────────────────────────
  const fullName = `${payload.guestFirstName} ${payload.guestLastName}`.trim();
  let guestUser = await userRepo.findOneBy({ email: payload.guestEmail });
  const isNewUser = !guestUser;
  if (!guestUser) {
    guestUser = userRepo.create({
      fullName,
      email: payload.guestEmail,
      phone: payload.guestPhone,
      role: 'customer',
      isVerified: false,
      isActive: false,
    });
    guestUser = await userRepo.save(guestUser);
  }

  // ── Create booking ─────────────────────────────────────────────────────────
  const booking = bookingRepo.create({
    user: { id: guestUser.id } as User,
    userId: guestUser.id,
    suiteId: payload.suiteId,
    eventType: payload.eventType,
    addOns: payload.addOns || [],
    date: payload.date,
    timeSlot: payload.timeSlot,
    endTimeSlot: payload.endTimeSlot,
    guestFirstName: payload.guestFirstName,
    guestLastName: payload.guestLastName,
    guestEmail: payload.guestEmail,
    guestPhone: payload.guestPhone,
    totalAmount: payload.totalAmount,
    status: 'confirmed',
    paymentStatus: 'success',
  } as any);
  const savedBooking = await bookingRepo.save(booking as any);



  // ── Resolve suite name & addon names for email ────────────────────────────
  const suite = await suiteRepo.findOneBy({ id: payload.suiteId });
  const suiteName = suite?.name ?? `Suite ${payload.suiteId}`;

  let addonNames: string[] = [];
  if (payload.addOns && payload.addOns.length) {
    const ids = payload.addOns.map(Number).filter(Boolean);
    if (ids.length) {
      const addons = await addonRepo.findBy({ id: In(ids) });
      addonNames = addons.map((a) => a.name);
    }
  }

  // ── Send emails (non-blocking) ────────────────────────────────────────────
  sendBookingConfirmationEmail({
    to: payload.guestEmail,

    guestName: fullName,
    bookingId: savedBooking.id,
    suiteName,
    date: payload.date,
    startTime: payload.timeSlot,
    endTime: payload.endTimeSlot ?? '',
    occasion: payload.eventType,
    addOns: addonNames,
    totalAmount: payload.totalAmount,
  }).catch((e) => console.warn('Booking email failed:', e?.message));

  if (isNewUser) {
    const resetToken = generatePasswordResetToken(guestUser.id);
    sendPasswordSetupEmail({
      to: payload.guestEmail,
      guestName: fullName,
      resetToken,
    }).catch((e) => console.warn('Password setup email failed:', e?.message));

    // WhatsApp: account created (best-effort)
    sendAccountCreatedWhatsApp({ phone: payload.guestPhone, fullName } as any).catch(() => {});

  }

  // WhatsApp: booking confirmed (best-effort)
  sendBookingConfirmedWhatsApp({
    id: savedBooking.id,
    guestPhone: payload.guestPhone,
    guestFirstName: payload.guestFirstName,
    guestLastName: payload.guestLastName,
  }).catch(() => {});

  return savedBooking;
};


export const findBookingsForUser = async (userId: number) => {
  const bookingRepo = repo();
  return bookingRepo.find({ where: { user: { id: userId } } as any, order: { createdAt: 'DESC' } });
};

export const findBookingByIdForUser = async (id: number, userId: number) => {
  return repo().findOne({ where: { id, user: { id: userId } } as any });
};

export const findBookingById = async (id: number) => repo().findOneBy({ id });

export const updateBookingStatus = async (id: number, status: Booking['status']) => {
  const booking = await repo().findOneBy({ id });
  if (!booking) throw new Error('Booking not found');
  booking.status = status;
  return repo().save(booking);
};

export const updateBookingPaymentStatus = async (id: number, paymentStatus: Booking['paymentStatus']) => {
  const booking = await repo().findOneBy({ id });
  if (!booking) throw new Error('Booking not found');
  booking.paymentStatus = paymentStatus;
  return repo().save(booking);
};


export const cancelBooking = async (id: number, userId: number) => {
  const booking = await repo().findOne({ where: { id, user: { id: userId } } as any });
  if (!booking) throw new Error('Booking not found');
  if (booking.status === 'cancelled') throw new Error('Booking already cancelled');
  booking.status = 'cancelled';
  return repo().save(booking);
};

export const findAllBookings = async () => repo().find({ order: { createdAt: 'DESC' } });
