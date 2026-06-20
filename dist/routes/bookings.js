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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const validate_1 = require("../middleware/validate");
const schemas_1 = require("../validation/schemas");
const data_source_1 = require("../data-source");
const typeorm_1 = require("typeorm");
const AddOn_1 = require("../entities/AddOn");
const Suite_1 = require("../entities/Suite");
const Booking_1 = require("../entities/Booking");
const Payment_1 = require("../entities/Payment");
const RefundCalculation_1 = require("../entities/RefundCalculation");
const bookings_service_1 = require("../services/bookings.service");
const router = express_1.default.Router();
router.use(auth_1.authenticate);
router.get('/', async (req, res) => {
    const user = req.user;
    try {
        const bookings = user.role === 'admin' ? await (0, bookings_service_1.findAllBookings)() : await (0, bookings_service_1.findBookingsForUser)(user.id);
        // Attach suite images to each booking by looking up related Suite.images
        const suiteIds = Array.from(new Set(bookings.map((b) => b.suiteId).filter(Boolean)));
        const suiteMap = new Map();
        if (suiteIds.length) {
            const suiteRepo = data_source_1.AppDataSource.getRepository(Suite_1.Suite);
            const suites = await suiteRepo.findBy({ id: (0, typeorm_1.In)(suiteIds) });
            for (const s of suites)
                suiteMap.set(s.id, s);
        }
        // Attach latest refund request for each booking
        const bookingIds = bookings.map((b) => b.id);
        const refundRepo = data_source_1.AppDataSource.getRepository(RefundCalculation_1.RefundCalculation);
        const refunds = bookingIds.length ? await refundRepo.find({ where: { bookingId: (0, typeorm_1.In)(bookingIds) } }) : [];
        const refundMap = new Map();
        for (const r of refunds) {
            if (!refundMap.has(r.bookingId) || r.createdAt > refundMap.get(r.bookingId).createdAt) {
                refundMap.set(r.bookingId, r);
            }
        }
        const enhanced = bookings.map((b) => {
            const suite = suiteMap.get(b.suiteId);
            const images = suite?.images ?? [];
            return {
                ...b,
                suiteImages: Array.isArray(images) ? images : [],
                image: Array.isArray(images) && images.length ? images[0] : undefined,
                refundRequest: refundMap.get(b.id) ?? null,
            };
        });
        res.json(enhanced);
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
router.get('/:id', async (req, res) => {
    try {
        const user = req.user;
        const booking = user.role === 'admin'
            ? await (0, bookings_service_1.findBookingById)(Number(req.params.id))
            : await (0, bookings_service_1.findBookingByIdForUser)(Number(req.params.id), user.id);
        if (!booking)
            return res.status(404).json({ message: 'Booking not found' });
        // Attach suite images to this booking
        const suite = await data_source_1.AppDataSource.getRepository(Suite_1.Suite).findOne({ where: { id: booking.suiteId } });
        const images = suite?.images ?? [];
        booking.suiteImages = Array.isArray(images) ? images : [];
        booking.image = Array.isArray(images) && images.length ? images[0] : booking.image;
        // Build add-ons details: name + price + quantity (quantity derived from duplicate IDs in booking.addOns)
        const addOns = Array.isArray(booking.addOns) ? booking.addOns : [];
        const addOnCounts = addOns.reduce((acc, rawId) => {
            const key = String(rawId);
            if (!key)
                return acc;
            acc[key] = (acc[key] ?? 0) + 1;
            return acc;
        }, {});
        const addonIds = Object.keys(addOnCounts).map((x) => Number(x)).filter(Boolean);
        if (addonIds.length) {
            const addonRepo = data_source_1.AppDataSource.getRepository(AddOn_1.AddOn);
            const addons = await addonRepo.findBy({ id: (0, typeorm_1.In)(addonIds) });
            const details = addons.map((a) => ({
                id: a.id,
                name: a.name,
                price: Number(a.price ?? 0),
                quantity: addOnCounts[String(a.id)] ?? 0,
            }));
            // Attach without removing existing properties.
            booking.addOnsDetails = details;
            // Keep legacy fields used elsewhere (addOnsNames might exist on some booking payloads)
            if (!booking.addOnsNames) {
                booking.addOnsNames = details.flatMap((d) => Array.from({ length: d.quantity }, () => d.name));
            }
        }
        else {
            booking.addOnsDetails = [];
            booking.addOnsNames = [];
        }
        // Attach latest refund request for this booking
        const refundRepo = data_source_1.AppDataSource.getRepository(RefundCalculation_1.RefundCalculation);
        const refundRequest = await refundRepo.findOne({
            where: { bookingId: booking.id },
            order: { createdAt: 'DESC' }
        });
        booking.refundRequest = refundRequest ?? null;
        res.json(booking);
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
router.post('/', (0, validate_1.validateBody)(schemas_1.bookingCreateSchema), async (req, res) => {
    try {
        const payload = req.body;
        const bookings = await (0, bookings_service_1.createBooking)({
            userId: req.user.id,
            suiteId: payload.suiteId,
            suiteName: payload.suiteName,
            eventType: payload.eventType || 'General Event',
            addOns: payload.addOns,
            date: payload.date,
            timeSlots: payload.timeSlots,
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
        // Send back the first booking or the array depending on frontend expectations.
        // We will send the first one as an object but inject `bookings` array for safety.
        res.status(201).json({ ...bookings[0], allBookings: bookings });
    }
    catch (err) {
        res.status(400).json({ message: err.message });
    }
});
router.post('/admin', (0, auth_1.requireRole)('admin'), (0, validate_1.validateBody)(schemas_1.adminBookingSchema), async (req, res) => {
    try {
        const p = req.body;
        const bookings = await (0, bookings_service_1.adminCreateBooking)({
            suiteId: p.suiteId,
            eventType: p.eventType,
            addOns: (p.addOns || []).map(String),
            date: p.date,
            timeSlots: p.timeSlots,
            guestFirstName: p.guestFirstName,
            guestLastName: p.guestLastName,
            guestEmail: p.guestEmail,
            guestPhone: p.guestPhone,
            totalAmount: p.totalAmount,
        });
        res.status(201).json({ ...bookings[0], allBookings: bookings });
    }
    catch (err) {
        res.status(400).json({ message: err.message });
    }
});
router.patch('/:id/status', auth_1.authenticate, (0, auth_1.requireRole)('admin'), async (req, res) => {
    try {
        const { status } = req.body;
        const booking = await (0, bookings_service_1.updateBookingStatus)(Number(req.params.id), status);
        res.json(booking);
    }
    catch (err) {
        res.status(400).json({ message: err.message });
    }
});
router.patch('/:id/cancel', async (req, res) => {
    try {
        const { reason } = req.body || {};
        if (typeof reason !== 'string' || !reason.trim()) {
            return res.status(400).json({ message: 'Cancellation reason is required.' });
        }
        const booking = await (0, bookings_service_1.cancelBooking)(Number(req.params.id), req.user.id, reason, req.user.role);
        res.json(booking);
    }
    catch (err) {
        res.status(400).json({ message: err.message });
    }
});
router.patch('/:id/reschedule', async (req, res) => {
    try {
        const bookingId = Number(req.params.id);
        const { date, timeSlot } = req.body || {};
        if (!date || typeof date !== 'string')
            return res.status(400).json({ message: 'date is required' });
        if (!timeSlot || typeof timeSlot !== 'string')
            return res.status(400).json({ message: 'timeSlot is required' });
        const booking = await (0, bookings_service_1.rescheduleBooking)(bookingId, req.user.id, { date, timeSlot }, req.user.role);
        res.json(booking);
    }
    catch (err) {
        res.status(400).json({ message: err.message });
    }
});
router.post('/:id/pay-cash', async (req, res) => {
    try {
        const bookingId = Number(req.params.id);
        const bookingRepo = data_source_1.AppDataSource.getRepository(Booking_1.Booking);
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
        await bookingRepo.save(booking);
        // Create a Payment record of method 'cash' and status 'success'
        const balanceAmount = Number(booking.totalAmount) - Number(booking.advanceAmount);
        const paymentRepo = data_source_1.AppDataSource.getRepository(Payment_1.Payment);
        const cashPayment = paymentRepo.create({
            bookingId,
            amount: balanceAmount,
            method: 'cash',
            provider: 'cash',
            status: 'success',
        });
        const savedPayment = await paymentRepo.save(cashPayment);
        // Send email confirmation
        try {
            const { sendPaymentSuccessNotifications } = await Promise.resolve().then(() => __importStar(require('../services/payments.service')));
            await sendPaymentSuccessNotifications(savedPayment);
        }
        catch (err) {
            console.warn('Failed to send cash payment confirmation email:', err);
        }
        res.json({ success: true, booking });
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
router.post('/:id/meeting-link', async (req, res) => {
    try {
        const link = await (0, bookings_service_1.getMeetingLink)(Number(req.params.id), req.user.id, req.user.role);
        res.json({ meeting_link: link });
    }
    catch (err) {
        const status = err.message === 'Forbidden' ? 403 : err.message === 'Booking not found' ? 404 : 400;
        res.status(status).json({ message: err.message });
    }
});
exports.default = router;
