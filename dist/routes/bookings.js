"use strict";
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
        const enhanced = bookings.map((b) => {
            const suite = suiteMap.get(b.suiteId);
            const images = suite?.images ?? [];
            return {
                ...b,
                suiteImages: Array.isArray(images) ? images : [],
                image: Array.isArray(images) && images.length ? images[0] : undefined,
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
        res.json(booking);
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
router.post('/', (0, validate_1.validateBody)(schemas_1.bookingCreateSchema), async (req, res) => {
    try {
        const payload = req.body;
        const booking = await (0, bookings_service_1.createBooking)({
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
    }
    catch (err) {
        res.status(400).json({ message: err.message });
    }
});
router.post('/admin', (0, auth_1.requireRole)('admin'), (0, validate_1.validateBody)(schemas_1.adminBookingSchema), async (req, res) => {
    try {
        const p = req.body;
        const booking = await (0, bookings_service_1.adminCreateBooking)({
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
        const booking = await (0, bookings_service_1.cancelBooking)(Number(req.params.id), req.user.id);
        res.json(booking);
    }
    catch (err) {
        res.status(400).json({ message: err.message });
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
