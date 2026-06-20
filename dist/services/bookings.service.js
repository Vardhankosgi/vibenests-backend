"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMeetingLink = exports.findAllBookings = exports.cancelBooking = exports.updateBookingPaymentStatus = exports.updateBookingStatus = exports.rescheduleBooking = exports.findBookingById = exports.findBookingByIdForUser = exports.findBookingsForUser = exports.adminCreateBooking = exports.createBooking = void 0;
exports.handleBookingConfirmationSideEffects = handleBookingConfirmationSideEffects;
const data_source_1 = require("../data-source");
const Booking_1 = require("../entities/Booking");
const User_1 = require("../entities/User");
const Suite_1 = require("../entities/Suite");
const AddOn_1 = require("../entities/AddOn");
const UserMembership_1 = require("../entities/UserMembership");
const SuiteAvailability_1 = require("../entities/SuiteAvailability");
const typeorm_1 = require("typeorm");
const crypto_1 = require("crypto");
const auth_service_1 = require("./auth.service");
const notifications_service_1 = require("./notifications.service");
const whatsapp_notifications_service_1 = require("./whatsapp-notifications.service");
const Coupon_1 = require("../entities/Coupon");
const coupons_service_1 = require("./coupons.service");
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
    const suiteRepo = data_source_1.AppDataSource.getRepository(Suite_1.Suite);
    const suite = await suiteRepo.findOneBy({ id: payload.suiteId });
    const suiteName = suite?.name ?? payload.suiteName ?? `Suite ${payload.suiteId}`;
    if (payload.suiteId !== 0) {
        const availabilityRepo = data_source_1.AppDataSource.getRepository(SuiteAvailability_1.SuiteAvailability);
        for (const ts of payload.timeSlots) {
            const exists = await bookingRepo.findOne({
                where: {
                    suiteId: payload.suiteId,
                    date: payload.date,
                    timeSlot: ts,
                    status: (0, typeorm_1.In)(['confirmed', 'pending', 'completed']),
                },
            });
            if (exists)
                throw new Error(`Slot ${ts} already booked`);
            const blocked = await availabilityRepo.findOne({
                where: {
                    suiteId: payload.suiteId,
                    date: payload.date,
                    timeSlot: ts,
                    status: 'blocked',
                },
            });
            if (blocked)
                throw new Error(`Slot ${ts} is blocked by administration`);
        }
    }
    const isPackageCredit = payload.paymentMode === 'package_credit';
    let activeMembership = null;
    if (isPackageCredit) {
        const userMembershipRepo = data_source_1.AppDataSource.getRepository(UserMembership_1.UserMembership);
        activeMembership = await userMembershipRepo.findOneBy({ userId: payload.userId, status: 'active' });
        if (!activeMembership) {
            throw new Error('You do not have an active package membership.');
        }
        if (activeMembership.bookingsUsed + payload.timeSlots.length > activeMembership.maxFreeBookings) {
            throw new Error(`You have only ${activeMembership.maxFreeBookings - activeMembership.bookingsUsed} free bookings left in your package.`);
        }
        const eligibleSuites = activeMembership.eligibleSuites || [];
        if (!eligibleSuites.includes(String(payload.suiteId))) {
            throw new Error('This suite is not eligible for free bookings under your active package.');
        }
    }
    if (payload.couponCode) {
        try {
            await (0, coupons_service_1.validateCoupon)(payload.couponCode, payload.totalAmount ?? 0, payload.userId);
        }
        catch (err) {
            throw new Error(`Coupon validation failed: ${err.message}`);
        }
    }
    const orderId = await generateUniqueOrderId(bookingRepo);
    const numSlots = payload.timeSlots.length;
    const createdBookings = [];
    const perSlotBasePrice = (payload.basePrice ?? 0) / numSlots;
    const perSlotAddonsTotal = (payload.addonsTotal ?? 0) / numSlots;
    const perSlotSavings = (payload.savings ?? 0) / numSlots;
    const perSlotServiceFee = (payload.serviceFee ?? 0) / numSlots;
    const perSlotTaxes = (payload.taxes ?? 0) / numSlots;
    const perSlotTotalAmount = (payload.totalAmount ?? 0) / numSlots;
    const perSlotAdvanceAmount = (payload.advanceAmount ?? 0) / numSlots;
    for (const ts of payload.timeSlots) {
        let endTimeSlot = '';
        if (suite) {
            endTimeSlot = computeEndTimeSlot(suite, ts);
        }
        const booking = bookingRepo.create({
            orderId,
            user: { id: payload.userId },
            suiteId: payload.suiteId,
            suiteName,
            eventType: payload.eventType,
            addOns: payload.addOns || [],
            date: payload.date,
            timeSlot: ts,
            endTimeSlot,
            persons: payload.persons ?? 1,
            basePrice: perSlotBasePrice,
            addonsTotal: perSlotAddonsTotal,
            savings: perSlotSavings,
            serviceFee: perSlotServiceFee,
            taxes: perSlotTaxes,
            totalAmount: isPackageCredit ? 0 : perSlotTotalAmount,
            paymentMode: payload.paymentMode ?? 'pay_now',
            advanceAmount: isPackageCredit ? 0 : perSlotAdvanceAmount,
            status: isPackageCredit ? 'confirmed' : 'pending',
            paymentStatus: isPackageCredit ? 'success' : 'pending',
            fullPaymentReceived: isPackageCredit ? true : false,
            couponCode: payload.couponCode || null,
        });
        const savedBooking = await bookingRepo.save(booking);
        createdBookings.push(savedBooking);
        if (isPackageCredit && activeMembership) {
            const userMembershipRepo = data_source_1.AppDataSource.getRepository(UserMembership_1.UserMembership);
            activeMembership.bookingsUsed += 1;
            await userMembershipRepo.save(activeMembership);
            await handleBookingConfirmationSideEffects(savedBooking.id);
        }
    }
    const finalBookings = await bookingRepo.find({ where: { orderId }, relations: ['user'] });
    const representativeBooking = finalBookings[0] || createdBookings[0];
    const guestEmail = representativeBooking?.user?.email;
    const guestName = representativeBooking?.user?.fullName || 'Guest';
    if (isPackageCredit) {
        try {
            if (guestEmail) {
                (0, notifications_service_1.sendBookingConfirmationEmail)({
                    to: guestEmail,
                    guestName,
                    bookingId: representativeBooking.id,
                    suiteName,
                    date: payload.date,
                    startTime: payload.timeSlots.join(', '),
                    endTime: '',
                    occasion: payload.eventType,
                    addOns: [],
                    totalAmount: 0,
                }).catch((e) => console.warn('Package credit booking email failed:', e?.message));
            }
        }
        catch (err) {
            console.warn('Failed to send package credit booking confirmation email:', err);
        }
    }
    else {
        try {
            if (guestEmail) {
                (0, notifications_service_1.sendBookingReceivedEmail)({
                    to: guestEmail,
                    guestName,
                    bookingId: representativeBooking.id,
                    suiteName,
                    date: payload.date,
                    startTime: payload.timeSlots.join(', '),
                    endTime: '',
                    occasion: payload.eventType,
                    addOns: payload.addOns || [],
                    totalAmount: payload.totalAmount ?? 0,
                }).catch((e) => console.warn('Booking received email failed:', e?.message));
            }
        }
        catch (err) {
            console.warn('Failed to send booking received email:', err);
        }
    }
    // Return the first booking or the whole array. We return an array, but express routes might expect one.
    return finalBookings;
};
exports.createBooking = createBooking;
const adminCreateBooking = async (payload) => {
    const bookingRepo = repo();
    const userRepo = data_source_1.AppDataSource.getRepository(User_1.User);
    const suiteRepo = data_source_1.AppDataSource.getRepository(Suite_1.Suite);
    const addonRepo = data_source_1.AppDataSource.getRepository(AddOn_1.AddOn);
    const availabilityRepo = data_source_1.AppDataSource.getRepository(SuiteAvailability_1.SuiteAvailability);
    for (const ts of payload.timeSlots) {
        const exists = await bookingRepo.findOne({
            where: {
                suiteId: payload.suiteId,
                date: payload.date,
                timeSlot: ts,
                status: (0, typeorm_1.In)(['confirmed', 'pending', 'completed']),
            },
        });
        if (exists)
            throw new Error(`Slot ${ts} already booked for this date and time`);
        const blocked = await availabilityRepo.findOne({
            where: {
                suiteId: payload.suiteId,
                date: payload.date,
                timeSlot: ts,
                status: 'blocked',
            },
        });
        if (blocked)
            throw new Error(`Slot ${ts} is blocked by administration`);
    }
    const fullName = `${payload.guestFirstName} ${payload.guestLastName}`.trim();
    let guestUser = await userRepo.findOneBy({ email: payload.guestEmail });
    const isNewUser = !guestUser;
    if (!guestUser) {
        guestUser = userRepo.create({
            fullName,
            email: payload.guestEmail,
            phone: payload.guestPhone,
            role: 'customer',
            isVerified: true,
            isActive: true,
        });
        guestUser = await userRepo.save(guestUser);
    }
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
        persons: payload.persons ?? 1,
        guestFirstName: payload.guestFirstName,
        guestLastName: payload.guestLastName,
        guestEmail: payload.guestEmail,
        guestPhone: payload.guestPhone,
        totalAmount: payload.totalAmount,
        status: 'confirmed',
        bookedBy: 'admin',
        paymentStatus: 'success',
        fullPaymentReceived: true,
    });
    const savedBooking = await bookingRepo.save(booking);
    // ── Resolve suite name & addon names for email ────────────────────────────
    const numSlots = payload.timeSlots.length;
    const perSlotTotalAmount = payload.totalAmount / numSlots;
    const createdBookings = [];
    const suite = await suiteRepo.findOneBy({ id: payload.suiteId });
    const suiteName = suite?.name ?? `Suite ${payload.suiteId}`;
    for (const ts of payload.timeSlots) {
        let endTimeSlot = '';
        if (suite) {
            endTimeSlot = computeEndTimeSlot(suite, ts);
        }
        const booking = bookingRepo.create({
            orderId,
            user: { id: guestUser.id },
            userId: guestUser.id,
            suiteId: payload.suiteId,
            eventType: payload.eventType,
            addOns: payload.addOns || [],
            date: payload.date,
            timeSlot: ts,
            endTimeSlot,
            guestFirstName: payload.guestFirstName,
            guestLastName: payload.guestLastName,
            guestEmail: payload.guestEmail,
            guestPhone: payload.guestPhone,
            totalAmount: perSlotTotalAmount,
            status: 'confirmed',
            paymentStatus: 'success',
            fullPaymentReceived: true,
        });
        const savedBooking = await bookingRepo.save(booking);
        createdBookings.push(savedBooking);
    }
    let addonNames = [];
    if (payload.addOns && payload.addOns.length) {
        const ids = payload.addOns.map(Number).filter(Boolean);
        if (ids.length) {
            const addons = await addonRepo.findBy({ id: (0, typeorm_1.In)(ids) });
            addonNames = addons.map((a) => a.name);
        }
    }
    const representativeBooking = createdBookings[0];
    (0, notifications_service_1.sendBookingConfirmationEmail)({
        to: payload.guestEmail,
        guestName: fullName,
        bookingId: representativeBooking.id,
        suiteName,
        date: payload.date,
        startTime: payload.timeSlots.join(', '),
        endTime: '',
        occasion: payload.eventType,
        addOns: addonNames,
        totalAmount: payload.totalAmount,
    }).catch((e) => console.warn('Booking email failed:', e?.message));
    if (isNewUser) {
        const resetToken = await (0, auth_service_1.generatePasswordResetToken)(guestUser.id);
        (0, notifications_service_1.sendPasswordSetupEmail)({
            to: payload.guestEmail,
            guestName: fullName,
            resetToken,
        }).catch((e) => console.warn('Password setup email failed:', e?.message));
        (0, whatsapp_notifications_service_1.sendAccountCreatedWhatsApp)({ phone: payload.guestPhone, fullName }).catch(() => { });
    }
    const finalBookings = await bookingRepo.find({ where: { orderId }, relations: ['user'] });
    (0, whatsapp_notifications_service_1.sendBookingConfirmedWhatsApp)({
        id: representativeBooking.id,
        guestPhone: payload.guestPhone,
        guestFirstName: payload.guestFirstName,
        guestLastName: payload.guestLastName,
    }).catch(() => undefined);
    return finalBookings;
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
const computeEndTimeSlot = (suite, startTimeSlot) => {
    // startTimeSlot format is like `09:30 AM` or `12:15 PM`
    // Mirrors the frontend logic in BookingsPage.tsx
    const [time, period] = startTimeSlot.split(' ');
    const [h, m] = time.split(':').map(Number);
    const duration = suite.slotDurationMins ?? 150;
    const startTotalMin = (period === 'PM' && h !== 12 ? h + 12 : period === 'AM' && h === 12 ? 0 : h) * 60 + m;
    const totalMin = startTotalMin + duration;
    const endH = Math.floor(totalMin / 60) % 24;
    const endM = totalMin % 60;
    const endPeriod = endH >= 12 ? 'PM' : 'AM';
    const displayH = endH > 12 ? endH - 12 : endH === 0 ? 12 : endH;
    return `${String(displayH).padStart(2, '0')}:${String(endM).padStart(2, '0')} ${endPeriod}`;
};
const rescheduleBooking = async (bookingId, userId, payload, requestingRole) => {
    const bookingRepo = repo();
    const suiteRepo = data_source_1.AppDataSource.getRepository(Suite_1.Suite);
    const availabilityRepo = data_source_1.AppDataSource.getRepository(SuiteAvailability_1.SuiteAvailability);
    const booking = await bookingRepo.findOne({ where: { id: bookingId }, relations: ['user'] });
    if (!booking)
        throw new Error('Booking not found');
    if (requestingRole !== 'admin' && booking.userId !== userId)
        throw new Error('Forbidden');
    // Only allow reschedule when booking is confirmed and payment is successful.
    // (User specifically said: completed the payment => booking confirmed)
    if (booking.status !== 'confirmed')
        throw new Error('Only confirmed bookings can be rescheduled');
    if (booking.paymentStatus !== 'success')
        throw new Error('Payment must be successful to reschedule');
    if (!booking.fullPaymentReceived && booking.paymentMode !== 'package_credit') {
        // For package credit we already set fullPaymentReceived=true at booking creation.
        // For pay_now/pay_at_venue flows, require full payment.
        throw new Error('Full payment must be received to reschedule');
    }
    if ((booking.rescheduleCount || 0) >= 1 && requestingRole !== 'admin') {
        throw new Error('You can only reschedule a booking once.');
    }
    if (requestingRole !== 'admin') {
        const parts = booking.timeSlot.trim().split(/\s+/);
        const tParts = parts[0].split(':');
        let hh = Number(tParts[0]);
        const mm = Number(tParts[1]) || 0;
        const period = parts[1]?.toUpperCase();
        if (period === 'PM' && hh !== 12)
            hh += 12;
        if (period === 'AM' && hh === 12)
            hh = 0;
        const dateParts = booking.date.split('-');
        const year = Number(dateParts[0]);
        const month = Number(dateParts[1]);
        const day = Number(dateParts[2]);
        const eventDate = new Date(year, month - 1, day, hh, mm, 0);
        const now = new Date();
        const hoursBeforeEvent = (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60);
        if (hoursBeforeEvent < 24) {
            throw new Error('Rescheduling is only allowed up to 24 hours before the scheduled event time.');
        }
    }
    const suite = await suiteRepo.findOneBy({ id: booking.suiteId });
    if (!suite)
        throw new Error('Suite not found');
    // Prevent double booking for the new slot.
    const conflict = await bookingRepo.findOne({
        where: {
            suiteId: booking.suiteId,
            date: payload.date,
            timeSlot: payload.timeSlot,
            status: (0, typeorm_1.In)(['confirmed', 'pending', 'completed']),
        },
    });
    if (conflict && conflict.id !== booking.id)
        throw new Error('Slot already booked');
    const blocked = await availabilityRepo.findOne({
        where: {
            suiteId: booking.suiteId,
            date: payload.date,
            timeSlot: payload.timeSlot,
            status: 'blocked',
        },
    });
    if (blocked)
        throw new Error('Slot is blocked by administration');
    const endTimeSlot = computeEndTimeSlot(suite, payload.timeSlot);
    booking.date = payload.date;
    booking.timeSlot = payload.timeSlot;
    booking.endTimeSlot = endTimeSlot;
    booking.rescheduleCount = (booking.rescheduleCount || 0) + 1;
    // Keep payment + status unchanged (confirmed).
    const saved = await bookingRepo.save(booking);
    // Best-effort notifications for reschedule
    try {
        const refreshed = await bookingRepo.findOne({ where: { id: saved.id }, relations: ['user'] });
        if (refreshed) {
            // Send email + whatsapp; existing booking email/whatsapp services are booking-related,
            // so we reuse whatsapp-notifications and send a custom reschedule email.
            const guestEmail = refreshed.guestEmail || refreshed.user?.email;
            const guestPhone = refreshed.guestPhone || refreshed.user?.phone;
            const guestName = refreshed.user?.fullName || refreshed.guestFirstName
                ? `${refreshed.guestFirstName ?? ''} ${refreshed.guestLastName ?? ''}`.trim()
                : 'Guest';
            const orderRef = refreshed.orderId ? `#${refreshed.orderId}` : `#VN${refreshed.id}`;
            const suiteName = refreshed.suiteName || `Suite ${refreshed.suiteId}`;
            // Email
            if (guestEmail) {
                const subject = `Reschedule Successful – ${orderRef} | VibeNests`;
                const startTime = payload.timeSlot;
                const endTime = computeEndTimeSlot(suite, payload.timeSlot);
                const html = `
          <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;color:#111;border:1px solid #eee;border-radius:10px;overflow:hidden">
            <div style="padding:16px 20px;border-bottom:1px solid #f0f0f0;display:flex;align-items:center;gap:12px">
              <img alt="VibeNests" src="https://vibenests.com/logo.png" style="height:32px;width:auto" />
              <div>
                <div style="font-size:16px;font-weight:700;line-height:1">Reschedule Confirmed</div>
                <div style="font-size:13px;color:#666;line-height:1;margin-top:2px">VibeNests</div>
              </div>
            </div>
            <div style="padding:18px 20px">
              <p style="margin:0 0 14px">Hi <strong>${guestName}</strong>, your booking has been rescheduled successfully.</p>
              <div style="background:#fafafa;border:1px solid #f1f1f1;border-radius:8px;padding:14px;">
                <div style="margin:0 0 8px"><strong>Booking ID:</strong> ${orderRef}</div>
                <div style="margin:0 0 8px"><strong>Suite:</strong> ${suiteName}</div>
                <div style="margin:0 0 8px"><strong>Date:</strong> ${payload.date}</div>
                <div style="margin:0 0 8px"><strong>Time:</strong> ${startTime} – ${endTime}</div>
              </div>
              <p style="margin:16px 0 0;color:#666;font-size:13px">If you did not request this change, please contact support immediately.</p>
            </div>
            <div style="padding:14px 20px;border-top:1px solid #f0f0f0;color:#999;font-size:12px;text-align:center">
              © ${new Date().getFullYear()} VibeNests. All rights reserved.
            </div>
          </div>`;
                // notifications.service.ts exports sendEmail; we import lazily to avoid circular deps
                const { sendEmail } = await Promise.resolve().then(() => __importStar(require('./notifications.service')));
                await sendEmail(guestEmail, subject, `Your booking ${orderRef} has been rescheduled.`, html);
            }
            // WhatsApp
            if (guestPhone) {
                // Use WhatsApp helper from whatsapp-notifications.service to normalize & log
                const { sendBookingConfirmedWhatsApp } = await Promise.resolve().then(() => __importStar(require('./whatsapp-notifications.service')));
                await sendBookingConfirmedWhatsApp({
                    id: refreshed.id,
                    guestPhone,
                    guestFirstName: refreshed.guestFirstName,
                    guestLastName: refreshed.guestLastName,
                    // cast to any to avoid strict User type requirements
                    user: refreshed.user ? { phone: refreshed.user.phone, fullName: refreshed.user.fullName } : undefined,
                });
                // Also send a custom reschedule text (best-effort)
                const { sendWhatsApp } = await Promise.resolve().then(() => __importStar(require('./notifications.service')));
                await sendWhatsApp(guestPhone, `Hi ${guestName}! Your booking has been rescheduled successfully. Booking: ${orderRef}. New time: ${payload.date}, ${payload.timeSlot}. Suite: ${suiteName}.`);
            }
        }
    }
    catch {
        // best-effort only
    }
    return saved;
};
exports.rescheduleBooking = rescheduleBooking;
const updateBookingStatus = async (id, status) => {
    const booking = await repo().findOne({ where: { id }, relations: ['user'] });
    if (!booking)
        throw new Error('Booking not found');
    const oldStatus = booking.status;
    booking.status = status;
    const saved = await repo().save(booking);
    if (status === 'confirmed' && oldStatus !== 'confirmed') {
        await handleBookingConfirmationSideEffects(booking.id);
        try {
            const suiteRepo = data_source_1.AppDataSource.getRepository(Suite_1.Suite);
            const suite = await suiteRepo.findOneBy({ id: booking.suiteId });
            const suiteName = suite?.name ?? `Suite ${booking.suiteId}`;
            const guestEmail = booking.guestEmail || booking.user?.email;
            const guestName = booking.user?.fullName || `${booking.guestFirstName ?? ''} ${booking.guestLastName ?? ''}`.trim() || 'Guest';
            if (guestEmail) {
                (0, notifications_service_1.sendBookingConfirmationEmail)({
                    to: guestEmail,
                    guestName,
                    bookingId: booking.id,
                    suiteName,
                    date: booking.date,
                    startTime: booking.timeSlot,
                    endTime: booking.endTimeSlot ?? '',
                    occasion: booking.eventType,
                    addOns: [],
                    totalAmount: Number(booking.totalAmount),
                }).catch((e) => console.warn('Booking confirmation email failed:', e?.message));
            }
        }
        catch (err) {
            console.warn('Booking confirmation email trigger failed:', err);
        }
    }
    return saved;
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
const cancelBooking = async (id, userId, reason, requestingRole) => {
    let whereClause = { id, user: { id: userId } };
    if (requestingRole === 'admin') {
        whereClause = { id };
    }
    const booking = await repo().findOne({ where: whereClause });
    if (!booking)
        throw new Error('Booking not found');
    if (booking.status === 'cancelled')
        throw new Error('Booking already cancelled');
    booking.status = 'cancelled';
    booking.cancellationReason = reason?.trim() ? reason.trim() : undefined;
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
// Side effects triggered when a booking is confirmed/paid (like referral qualifying actions & coupon usage tracking)
async function handleBookingConfirmationSideEffects(bookingId) {
    try {
        const bookingRepo = repo();
        const booking = await bookingRepo.findOne({ where: { id: bookingId }, relations: ['user'] });
        if (!booking)
            return;
        // 1. Process Referral Qualifying Action
        if (booking.userId) {
            try {
                const { processReferralQualifyingAction } = require('./referrals.service');
                await processReferralQualifyingAction(booking.userId, 'booking_confirmed', booking.id);
            }
            catch (err) {
                console.warn('Referral side effect failed:', err?.message);
            }
        }
        // 2. Increment Coupon Usage
        if (booking.couponCode) {
            try {
                const coupon = await data_source_1.AppDataSource.getRepository(Coupon_1.Coupon).findOneBy({ code: booking.couponCode });
                if (coupon) {
                    await data_source_1.AppDataSource.getRepository(Coupon_1.Coupon).increment({ id: coupon.id }, 'usedCount', 1);
                    console.log(`Successfully incremented usedCount for coupon ${coupon.code}`);
                }
            }
            catch (err) {
                console.warn('Coupon usage tracking failed:', err?.message);
            }
        }
    }
    catch (err) {
        console.warn('handleBookingConfirmationSideEffects failed:', err?.message);
    }
}
