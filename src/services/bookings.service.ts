import { AppDataSource } from '../data-source';
import { Booking } from '../entities/Booking';
import { User } from '../entities/User';
import { Suite } from '../entities/Suite';
import { AddOn } from '../entities/AddOn';
import { UserMembership } from '../entities/UserMembership';
import { In } from 'typeorm';
import { randomUUID, randomBytes, randomInt } from 'crypto';
import { generatePasswordResetToken } from './auth.service';
import { sendBookingConfirmationEmail, sendPasswordSetupEmail } from './notifications.service';
import { sendAccountCreatedWhatsApp, sendBookingConfirmedWhatsApp } from './whatsapp-notifications.service';


const repo = () => AppDataSource.getRepository(Booking);

const generateUniqueOrderId = async (bookingRepo: any): Promise<string> => {
  while (true) {
    const code = String(randomInt(10000000, 100000000));
    const exists = await bookingRepo.findOneBy({ orderId: code });
    if (!exists) return code;
  }
};

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
  paymentMode?: 'pay_now' | 'pay_at_venue' | 'package_credit';
  advanceAmount?: number;
}) => {
  const bookingRepo = repo();
  if (payload.suiteId !== 0) {
    const exists = await bookingRepo.findOneBy({ suiteId: payload.suiteId, date: payload.date, timeSlot: payload.timeSlot, status: 'confirmed' });
    if (exists) throw new Error('Slot already booked');
  }

  const isPackageCredit = payload.paymentMode === 'package_credit';
  let activeMembership: UserMembership | null = null;

  if (isPackageCredit) {
    const userMembershipRepo = AppDataSource.getRepository(UserMembership);
    activeMembership = await userMembershipRepo.findOneBy({ userId: payload.userId, status: 'active' });
    if (!activeMembership) {
      throw new Error('You do not have an active package membership.');
    }
    if (activeMembership.bookingsUsed >= activeMembership.maxFreeBookings) {
      throw new Error('You have used all free bookings allowed in your package.');
    }
    const eligibleSuites = activeMembership.eligibleSuites || [];
    if (!eligibleSuites.includes(String(payload.suiteId))) {
      throw new Error('This suite is not eligible for free bookings under your active package.');
    }
  }

  const orderId = await generateUniqueOrderId(bookingRepo);
  const booking = bookingRepo.create({
    orderId,
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
    totalAmount: isPackageCredit ? 0 : (payload.totalAmount ?? 0),
    paymentMode: payload.paymentMode ?? 'pay_now',
    advanceAmount: isPackageCredit ? 0 : (payload.advanceAmount ?? 0),
    status: isPackageCredit ? 'confirmed' : 'pending',
    paymentStatus: isPackageCredit ? 'success' : 'pending',
  } as any);

  const savedBooking = await bookingRepo.save(booking) as any;

  if (isPackageCredit && activeMembership) {
    const userMembershipRepo = AppDataSource.getRepository(UserMembership);
    activeMembership.bookingsUsed += 1;
    await userMembershipRepo.save(activeMembership);
  }

  const finalBooking = await bookingRepo.findOne({ where: { id: savedBooking.id }, relations: ['user'] });
  return finalBooking || savedBooking;
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
  const orderId = await generateUniqueOrderId(bookingRepo);
  const booking = bookingRepo.create({
    orderId,
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
  const savedBooking = await bookingRepo.save(booking) as unknown as Booking;

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
    sendAccountCreatedWhatsApp({ phone: payload.guestPhone, fullName } as any).catch(() => { });

  }

  const finalBooking = await bookingRepo.findOne({ where: { id: savedBooking.id }, relations: ['user'] });
  // return finalBooking || savedBooking;
  // WhatsApp: booking confirmed (best-effort)
  sendBookingConfirmedWhatsApp({
    id: savedBooking.id,
    guestPhone: payload.guestPhone,
    guestFirstName: payload.guestFirstName,
    guestLastName: payload.guestLastName,
  }).catch(() => { });

  // return savedBooking;
  return finalBooking || savedBooking;
};


export const findBookingsForUser = async (userId: number) => {
  const bookingRepo = repo();
  return bookingRepo.find({ where: { user: { id: userId } } as any, relations: ['user'], order: { createdAt: 'DESC' } });
};

export const findBookingByIdForUser = async (id: number, userId: number) => {
  return repo().findOne({ where: { id, user: { id: userId } } as any, relations: ['user'] });
};

export const findBookingById = async (id: number) => repo().findOne({ where: { id }, relations: ['user'] });

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

export const findAllBookings = async () => repo().find({ relations: ['user'], order: { createdAt: 'DESC' } });

export const getMeetingLink = async (bookingId: number, requestingUserId: number, requestingRole: string): Promise<string> => {
  const bookingRepo = repo();
  const booking = await bookingRepo.findOneBy({ id: bookingId });
  if (!booking) throw new Error('Booking not found');
  if (requestingRole !== 'admin' && booking.userId !== requestingUserId) throw new Error('Forbidden');
  if (booking.status !== 'confirmed') throw new Error('Meeting link is only available for confirmed bookings');

  if ((booking as any).address?.meeting_link) return (booking as any).address.meeting_link;

  const meetingLink = `https://meet.jit.si/VibeNests-${randomUUID()}`;
  (booking as any).address = { ...((booking as any).address ?? {}), meeting_link: meetingLink, meeting_provider: 'jitsi' };
  await bookingRepo.save(booking);
  return meetingLink;
};
