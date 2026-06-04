import { AppDataSource } from '../data-source';
import { Booking } from '../entities/Booking';
import { User } from '../entities/User';

const repo = () => AppDataSource.getRepository(Booking);

export const createBooking = async (payload: {
  userId: number;
  suiteId: number;
  eventType: string;
  addOns?: string[];
  date: string;
  timeSlot: string;
}) => {
  const bookingRepo = repo();
  const exists = await bookingRepo.findOneBy({ suiteId: payload.suiteId, date: payload.date, timeSlot: payload.timeSlot, status: 'confirmed' });
  if (exists) throw new Error('Slot already booked');

  const booking = bookingRepo.create({
    user: { id: payload.userId } as User,
    suiteId: payload.suiteId,
    eventType: payload.eventType,
    addOns: payload.addOns || [],
    date: payload.date,
    timeSlot: payload.timeSlot,
    status: 'pending',
    paymentStatus: 'pending',
  } as any);
  return bookingRepo.save(booking);
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
