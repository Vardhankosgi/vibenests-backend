"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const bookings_service_1 = require("../services/bookings.service");
const router = express_1.default.Router();
router.use(auth_1.authenticate);
router.get('/', async (req, res) => {
    const user = req.user;
    try {
        if (user.role === 'admin') {
            const all = await (0, bookings_service_1.findAllBookings)();
            return res.json(all);
        }
        const list = await (0, bookings_service_1.findBookingsForUser)(user.id);
        res.json(list);
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
router.get('/:id', async (req, res) => {
    try {
        const user = req.user;
        if (user.role === 'admin') {
            const booking = await (0, bookings_service_1.findBookingById)(Number(req.params.id));
            if (!booking)
                return res.status(404).json({ message: 'Booking not found' });
            return res.json(booking);
        }
        const booking = await (0, bookings_service_1.findBookingByIdForUser)(Number(req.params.id), user.id);
        if (!booking)
            return res.status(404).json({ message: 'Booking not found' });
        res.json(booking);
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
router.post('/', async (req, res) => {
    try {
        const payload = req.body;
        const booking = await (0, bookings_service_1.createBooking)({
            userId: req.user.id,
            suiteId: payload.suiteId,
            eventType: payload.eventType || 'General Event',
            addOns: payload.addOns,
            date: payload.date,
            timeSlot: payload.timeSlot,
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
exports.default = router;
