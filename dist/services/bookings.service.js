"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMeetingLink = exports.findAllBookings = exports.cancelBooking = exports.updateBookingPaymentStatus = exports.updateBookingStatus = exports.findBookingById = exports.findBookingByIdForUser = exports.findBookingsForUser = exports.adminCreateBooking = exports.createBooking = void 0;
const data_source_1 = require("../data-source");
const Booking_1 = require("../entities/Booking");
const User_1 = require("../entities/User");
const Suite_1 = require("../entities/Suite");
const AddOn_1 = require("../entities/AddOn");
const typeorm_1 = require("typeorm");
const crypto_1 = require("crypto");
const auth_service_1 = require("./auth.service");
const notifications_service_1 = require("./notifications.service");
const whatsapp_notifications_service_1 = require("./whatsapp-notifications.service");
const repo = () => data_source_1.AppDataSource.getRepository(Booking_1.Booking);
const generateUniqueOrderId = async (bookingRepo) => {
    while (true) {
        const code = String((0, crypto_1.randomInt)(10000000, 100000000));
        const exists = await bookingRepo.findOneBy({ orderId: code });
        if (!exists)
            return code;
    }
};
const createBooking = async (payload) => {
    const bookingRepo = repo();
    const exists = await bookingRepo.findOneBy({ suiteId: payload.suiteId, date: payload.date, timeSlot: payload.timeSlot, status: 'confirmed' });
    if (exists)
        throw new Error('Slot already booked');
    const orderId = await generateUniqueOrderId(bookingRepo);
    const booking = bookingRepo.create({
        orderId,
        user: { id: payload.userId },
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
    });
    const savedBooking = await bookingRepo.save(booking);
    const finalBooking = await bookingRepo.findOne({ where: { id: savedBooking.id }, relations: ['user'] });
    return finalBooking || savedBooking;
};
exports.createBooking = createBooking;
const adminCreateBooking = async (payload) => {
    const bookingRepo = repo();
    const userRepo = data_source_1.AppDataSource.getRepository(User_1.User);
    const suiteRepo = data_source_1.AppDataSource.getRepository(Suite_1.Suite);
    const addonRepo = data_source_1.AppDataSource.getRepository(AddOn_1.AddOn);
    const exists = await bookingRepo.findOneBy({ suiteId: payload.suiteId, date: payload.date, timeSlot: payload.timeSlot, status: 'confirmed' });
    if (exists)
        throw new Error('Slot already booked for this date and time');
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
        user: { id: guestUser.id },
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
    });
    const savedBooking = await bookingRepo.save(booking);
    // ── Resolve suite name & addon names for email ────────────────────────────
    const suite = await suiteRepo.findOneBy({ id: payload.suiteId });
    const suiteName = suite?.name ?? `Suite ${payload.suiteId}`;
    let addonNames = [];
    if (payload.addOns && payload.addOns.length) {
        const ids = payload.addOns.map(Number).filter(Boolean);
        if (ids.length) {
            const addons = await addonRepo.findBy({ id: (0, typeorm_1.In)(ids) });
            addonNames = addons.map((a) => a.name);
        }
    }
    // ── Send emails (non-blocking) ────────────────────────────────────────────
    (0, notifications_service_1.sendBookingConfirmationEmail)({
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
        const resetToken = (0, auth_service_1.generatePasswordResetToken)(guestUser.id);
        (0, notifications_service_1.sendPasswordSetupEmail)({
            to: payload.guestEmail,
            guestName: fullName,
            resetToken,
        }).catch((e) => console.warn('Password setup email failed:', e?.message));
        // WhatsApp: account created (best-effort)
        (0, whatsapp_notifications_service_1.sendAccountCreatedWhatsApp)({ phone: payload.guestPhone, fullName }).catch(() => { });
    }
    const finalBooking = await bookingRepo.findOne({ where: { id: savedBooking.id }, relations: ['user'] });
    // return finalBooking || savedBooking;
    // WhatsApp: booking confirmed (best-effort)
    (0, whatsapp_notifications_service_1.sendBookingConfirmedWhatsApp)({
        id: savedBooking.id,
        guestPhone: payload.guestPhone,
        guestFirstName: payload.guestFirstName,
        guestLastName: payload.guestLastName,
    }).catch(() => { });
    // return savedBooking;
    return finalBooking || savedBooking;
};
exports.adminCreateBooking = adminCreateBooking;
const findBookingsForUser = async (userId) => {
    const bookingRepo = repo();
    return bookingRepo.find({ where: { user: { id: userId } }, relations: ['user'], order: { createdAt: 'DESC' } });
};
exports.findBookingsForUser = findBookingsForUser;
const findBookingByIdForUser = async (id, userId) => {
    return repo().findOne({ where: { id, user: { id: userId } }, relations: ['user'] });
};
exports.findBookingByIdForUser = findBookingByIdForUser;
const findBookingById = async (id) => repo().findOne({ where: { id }, relations: ['user'] });
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
const findAllBookings = async () => repo().find({ relations: ['user'], order: { createdAt: 'DESC' } });
exports.findAllBookings = findAllBookings;
const getMeetingLink = async (bookingId, requestingUserId, requestingRole) => {
    const bookingRepo = repo();
    const booking = await bookingRepo.findOneBy({ id: bookingId });
    if (!booking)
        throw new Error('Booking not found');
    if (requestingRole !== 'admin' && booking.userId !== requestingUserId)
        throw new Error('Forbidden');
    if (booking.status !== 'confirmed')
        throw new Error('Meeting link is only available for confirmed bookings');
    if (booking.address?.meeting_link)
        return booking.address.meeting_link;
    const meetingLink = `https://meet.jit.si/VibeNests-${(0, crypto_1.randomUUID)()}`;
    booking.address = { ...(booking.address ?? {}), meeting_link: meetingLink, meeting_provider: 'jitsi' };
    await bookingRepo.save(booking);
    return meetingLink;
};
exports.getMeetingLink = getMeetingLink;
