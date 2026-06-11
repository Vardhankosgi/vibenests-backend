"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const data_source_1 = require("../data-source");
const User_1 = require("../entities/User");
const Booking_1 = require("../entities/Booking");
const auth_service_1 = require("../services/auth.service");
const notifications_service_1 = require("../services/notifications.service");
const router = express_1.default.Router();
const repo = () => data_source_1.AppDataSource.getRepository(User_1.User);
router.get('/', auth_1.authenticate, (0, auth_1.requireRole)('admin'), async (req, res) => {
    try {
        const users = await repo()
            .createQueryBuilder('u')
            .where('u.role = :role', { role: 'customer' })
            .loadRelationCountAndMap('u.bookingCount', 'u.bookings')
            .orderBy('u.createdAt', 'DESC')
            .getMany();
        res.json(users.map((u) => ({
            id: u.id, fullName: u.fullName, email: u.email,
            phone: u.phone, role: u.role, isActive: u.isActive,
            isVerified: u.isVerified, createdAt: u.createdAt,
            bookingCount: u.bookingCount ?? 0,
        })));
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
router.get('/:id', auth_1.authenticate, (0, auth_1.requireRole)('admin'), async (req, res) => {
    try {
        const user = await repo().findOneBy({ id: Number(req.params.id) });
        if (!user)
            return res.status(404).json({ message: 'User not found' });
        const bookings = await data_source_1.AppDataSource.getRepository(Booking_1.Booking).find({
            where: { userId: user.id },
            relations: ['suite'],
            order: { createdAt: 'DESC' },
        });
        res.json({
            id: user.id, fullName: user.fullName, email: user.email,
            phone: user.phone, role: user.role, isActive: user.isActive,
            isVerified: user.isVerified, createdAt: user.createdAt,
            bookings: bookings.map(b => ({
                id: b.id, suite: b.suite?.name ?? `Suite ${b.suiteId}`,
                eventType: b.eventType, date: b.date, timeSlot: b.timeSlot,
                totalAmount: b.totalAmount, status: b.status, createdAt: b.createdAt,
            })),
        });
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
router.post('/', auth_1.authenticate, (0, auth_1.requireRole)('admin'), async (req, res) => {
    try {
        const { fullName, email, phone } = req.body;
        if (!fullName || !email)
            return res.status(400).json({ message: 'fullName and email are required' });
        const exists = await repo().findOneBy({ email });
        if (exists)
            return res.status(400).json({ message: 'User with this email already exists' });
        const user = repo().create({ fullName, email, phone, role: 'customer', isActive: false, isVerified: false });
        const saved = await repo().save(user);
        const token = (0, auth_service_1.generatePasswordResetToken)(saved.id);
        await (0, notifications_service_1.sendPasswordSetupEmail)({ to: email, guestName: fullName, resetToken: token });
        res.status(201).json({ id: saved.id, fullName: saved.fullName, email: saved.email, phone: saved.phone, role: saved.role, isActive: saved.isActive, isVerified: saved.isVerified, createdAt: saved.createdAt, bookingCount: 0 });
    }
    catch (err) {
        res.status(400).json({ message: err.message });
    }
});
router.post('/:id/resend-setup', auth_1.authenticate, (0, auth_1.requireRole)('admin'), async (req, res) => {
    try {
        const user = await repo().findOneBy({ id: Number(req.params.id) });
        if (!user)
            return res.status(404).json({ message: 'User not found' });
        const token = (0, auth_service_1.generatePasswordResetToken)(user.id);
        await (0, notifications_service_1.sendPasswordSetupEmail)({ to: user.email, guestName: user.fullName, resetToken: token });
        res.json({ message: 'Setup email resent' });
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
router.patch('/:id/status', auth_1.authenticate, (0, auth_1.requireRole)('admin'), async (req, res) => {
    try {
        const user = await repo().findOneBy({ id: Number(req.params.id) });
        if (!user)
            return res.status(404).json({ message: 'User not found' });
        user.isActive = !user.isActive;
        await repo().save(user);
        res.json({ id: user.id, isActive: user.isActive });
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
router.get('/me', auth_1.authenticate, async (req, res) => {
    try {
        const user = await repo().findOneBy({ id: req.user.id });
        if (!user)
            return res.status(404).json({ message: 'User not found' });
        res.json({ id: user.id, fullName: user.fullName, email: user.email, role: user.role });
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
exports.default = router;
