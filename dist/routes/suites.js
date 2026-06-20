"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const data_source_1 = require("../data-source");
const Booking_1 = require("../entities/Booking");
const SuiteAvailability_1 = require("../entities/SuiteAvailability");
const typeorm_1 = require("typeorm");
const suites_service_1 = require("../services/suites.service");
const router = express_1.default.Router();
router.get('/', async (req, res) => {
    try {
        const suites = await (0, suites_service_1.findSuites)();
        res.json(suites);
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
router.get('/:id', async (req, res) => {
    try {
        const suite = await (0, suites_service_1.findSuiteById)(Number(req.params.id));
        if (!suite)
            return res.status(404).json({ message: 'Suite not found' });
        res.json(suite);
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
router.post('/', auth_1.authenticate, (0, auth_1.requireRole)('admin'), async (req, res) => {
    try {
        const suite = await (0, suites_service_1.createSuite)(req.body);
        res.status(201).json(suite);
    }
    catch (err) {
        res.status(400).json({ message: err.message });
    }
});
router.patch('/:id', auth_1.authenticate, (0, auth_1.requireRole)('admin'), async (req, res) => {
    try {
        const suite = await (0, suites_service_1.updateSuite)(Number(req.params.id), req.body);
        res.json(suite);
    }
    catch (err) {
        res.status(400).json({ message: err.message });
    }
});
router.delete('/:id', auth_1.authenticate, (0, auth_1.requireRole)('admin'), async (req, res) => {
    try {
        await (0, suites_service_1.deleteSuite)(Number(req.params.id));
        res.json({ message: 'Suite removed' });
    }
    catch (err) {
        res.status(400).json({ message: err.message });
    }
});
router.get('/:id/availability', auth_1.authenticate, (0, auth_1.requireRole)('admin'), async (req, res) => {
    try {
        const availability = await (0, suites_service_1.getAvailabilityForSuite)(Number(req.params.id));
        res.json(availability);
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
router.post('/:id/availability', auth_1.authenticate, (0, auth_1.requireRole)('admin'), async (req, res) => {
    try {
        const { date, timeSlot, note } = req.body;
        const availability = await (0, suites_service_1.addAvailabilitySlot)(Number(req.params.id), date, timeSlot, note);
        res.status(201).json(availability);
    }
    catch (err) {
        res.status(400).json({ message: err.message });
    }
});
router.delete('/:id/availability/:availabilityId', auth_1.authenticate, (0, auth_1.requireRole)('admin'), async (req, res) => {
    try {
        await (0, suites_service_1.removeAvailabilitySlot)(Number(req.params.availabilityId));
        res.json({ message: 'Availability slot removed' });
    }
    catch (err) {
        res.status(400).json({ message: err.message });
    }
});
router.get('/:id/blocked-slots', async (req, res) => {
    try {
        const suiteId = Number(req.params.id);
        const date = req.query.date;
        if (!date) {
            return res.status(400).json({ message: 'Date parameter is required' });
        }
        let bookings = await data_source_1.AppDataSource.getRepository(Booking_1.Booking).find({
            where: {
                suiteId,
                date,
                status: (0, typeorm_1.In)(['confirmed', 'pending', 'completed']),
            },
        });
        // Filter out pending bookings older than 15 minutes
        const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);
        bookings = bookings.filter((b) => {
            if (b.status === 'pending') {
                return new Date(b.createdAt) >= fifteenMinsAgo;
            }
            return true;
        });
        const availabilityRepo = data_source_1.AppDataSource.getRepository(SuiteAvailability_1.SuiteAvailability);
        const blocks = await availabilityRepo.find({
            where: {
                suiteId,
                date,
                status: 'blocked',
            },
        });
        const blockedSlots = new Set();
        bookings.forEach((b) => {
            if (b.timeSlot)
                blockedSlots.add(b.timeSlot);
        });
        blocks.forEach((b) => {
            if (b.timeSlot)
                blockedSlots.add(b.timeSlot);
        });
        res.json(Array.from(blockedSlots));
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
router.get('/:id/availability-details', auth_1.authenticate, (0, auth_1.requireRole)('admin'), async (req, res) => {
    try {
        const suiteId = Number(req.params.id);
        const date = req.query.date;
        if (!date) {
            return res.status(400).json({ message: 'Date parameter is required' });
        }
        const bookingRepo = data_source_1.AppDataSource.getRepository(Booking_1.Booking);
        let bookings = await bookingRepo.find({
            where: {
                suiteId,
                date,
                status: (0, typeorm_1.In)(['confirmed', 'pending', 'completed']),
            },
            relations: ['user'],
        });
        // Filter out pending bookings older than 15 minutes
        const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);
        bookings = bookings.filter((b) => {
            if (b.status === 'pending') {
                return new Date(b.createdAt) >= fifteenMinsAgo;
            }
            return true;
        });
        const availabilityRepo = data_source_1.AppDataSource.getRepository(SuiteAvailability_1.SuiteAvailability);
        const blocks = await availabilityRepo.find({
            where: {
                suiteId,
                date,
                status: 'blocked',
            },
        });
        res.json({
            bookings,
            blocks,
        });
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
exports.default = router;
