"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findAllBookings = exports.cancelBooking = exports.updateBookingPaymentStatus = exports.updateBookingStatus = exports.findBookingById = exports.findBookingByIdForUser = exports.findBookingsForUser = exports.createBooking = void 0;
const data_source_1 = require("../data-source");
const Booking_1 = require("../entities/Booking");
const repo = () => data_source_1.AppDataSource.getRepository(Booking_1.Booking);
const createBooking = async (payload) => {
    const bookingRepo = repo();
    const exists = await bookingRepo.findOneBy({ suiteId: payload.suiteId, date: payload.date, timeSlot: payload.timeSlot, status: 'confirmed' });
    if (exists)
        throw new Error('Slot already booked');
    const booking = bookingRepo.create({
        user: { id: payload.userId },
        suiteId: payload.suiteId,
        eventType: payload.eventType,
        addOns: payload.addOns || [],
        date: payload.date,
        timeSlot: payload.timeSlot,
        status: 'pending',
        paymentStatus: 'pending',
    });
    return bookingRepo.save(booking);
};
exports.createBooking = createBooking;
const findBookingsForUser = async (userId) => {
    const bookingRepo = repo();
    return bookingRepo.find({ where: { user: { id: userId } }, order: { createdAt: 'DESC' } });
};
exports.findBookingsForUser = findBookingsForUser;
const findBookingByIdForUser = async (id, userId) => {
    return repo().findOne({ where: { id, user: { id: userId } } });
};
exports.findBookingByIdForUser = findBookingByIdForUser;
const findBookingById = async (id) => repo().findOneBy({ id });
exports.findBookingById = findBookingById;
const updateBookingStatus = async (id, status) => {
    const booking = await repo().findOneBy({ id });
    if (!booking)
        throw new Error('Booking not found');
    booking.status = status;
    return repo().save(booking);
};
exports.updateBookingStatus = updateBookingStatus;
const updateBookingPaymentStatus = async (id, paymentStatus) => {
    const booking = await repo().findOneBy({ id });
    if (!booking)
        throw new Error('Booking not found');
    booking.paymentStatus = paymentStatus;
    return repo().save(booking);
};
exports.updateBookingPaymentStatus = updateBookingPaymentStatus;
const cancelBooking = async (id, userId) => {
    const booking = await repo().findOne({ where: { id, user: { id: userId } } });
    if (!booking)
        throw new Error('Booking not found');
    if (booking.status === 'cancelled')
        throw new Error('Booking already cancelled');
    booking.status = 'cancelled';
    return repo().save(booking);
};
exports.cancelBooking = cancelBooking;
const findAllBookings = async () => repo().find({ order: { createdAt: 'DESC' } });
exports.findAllBookings = findAllBookings;
