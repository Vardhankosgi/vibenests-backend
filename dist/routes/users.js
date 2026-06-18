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
const data_source_1 = require("../data-source");
const User_1 = require("../entities/User");
const Booking_1 = require("../entities/Booking");
const UserMembership_1 = require("../entities/UserMembership");
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
        const activeMemberships = await data_source_1.AppDataSource.getRepository(UserMembership_1.UserMembership).find({
            where: { status: 'active' }
        });
        const now = new Date();
        const activeMap = new Map();
        for (const um of activeMemberships) {
            if (um.expiryDate > now) {
                activeMap.set(um.userId, um.planName);
            }
        }
        res.json(users.map((u) => ({
            id: u.id, fullName: u.fullName, email: u.email,
            phone: u.phone, role: u.role, isActive: u.isActive,
            isVerified: u.isVerified, createdAt: u.createdAt,
            bookingCount: u.bookingCount ?? 0,
            membership: activeMap.get(u.id) || null,
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
        const activeMembership = await data_source_1.AppDataSource.getRepository(UserMembership_1.UserMembership).findOne({
            where: { userId: user.id, status: 'active' }
        });
        const now = new Date();
        const isMember = activeMembership && activeMembership.expiryDate > now;
        res.json({
            id: user.id,
            fullName: user.fullName,
            email: user.email,
            phone: user.phone,
            role: user.role,
            isActive: user.isActive,
            isVerified: user.isVerified,
            createdAt: user.createdAt,
            marriageDate: user.marriageDate ?? null,
            membership: isMember ? activeMembership.planName : null,
            bookings: bookings.map(b => ({
                id: b.id,
                orderId: b.orderId,
                suite: b.suite?.name ?? `Suite ${b.suiteId}`,
                eventType: b.eventType,
                date: b.date,
                timeSlot: b.timeSlot,
                totalAmount: b.totalAmount,
                status: b.status,
                createdAt: b.createdAt,
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
        const token = await (0, auth_service_1.generatePasswordResetToken)(saved.id);
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
        const token = await (0, auth_service_1.generatePasswordResetToken)(user.id);
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
// Admin: update user details
router.patch('/:id', auth_1.authenticate, (0, auth_1.requireRole)('admin'), async (req, res) => {
    try {
        const user = await repo().findOneBy({ id: Number(req.params.id) });
        if (!user)
            return res.status(404).json({ message: 'User not found' });
        const { fullName, phone, dateOfBirth, marriageDate, isActive } = req.body;
        if (fullName !== undefined)
            user.fullName = String(fullName);
        if (phone !== undefined)
            user.phone = phone ? String(phone).replace(/\D/g, '') : undefined;
        if (dateOfBirth !== undefined)
            user.dateOfBirth = dateOfBirth ? String(dateOfBirth) : undefined;
        if (marriageDate !== undefined)
            user.marriageDate = marriageDate ? String(marriageDate) : undefined;
        if (isActive !== undefined)
            user.isActive = Boolean(isActive);
        await repo().save(user);
        res.json({
            id: user.id,
            fullName: user.fullName,
            email: user.email,
            phone: user.phone,
            role: user.role,
            isActive: user.isActive,
            isVerified: user.isVerified,
            dateOfBirth: user.dateOfBirth ?? null,
            marriageDate: user.marriageDate ?? null,
        });
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
// Admin: delete user
router.delete('/:id', auth_1.authenticate, (0, auth_1.requireRole)('admin'), async (req, res) => {
    try {
        const userId = Number(req.params.id);
        const user = await repo().findOneBy({ id: userId });
        if (!user)
            return res.status(404).json({ message: 'User not found' });
        // Delete dependent refresh tokens first to avoid FK constraint violations.
        // This keeps runtime behavior correct without requiring DB migrations.
        await data_source_1.AppDataSource.transaction(async (manager) => {
            const { RefreshToken } = await Promise.resolve().then(() => __importStar(require('../entities/RefreshToken')));
            await manager.getRepository(RefreshToken).delete({ user: { id: userId } });
            await manager.getRepository(User_1.User).remove(user);
        });
        res.json({ message: 'User deleted' });
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
        res.json({
            id: user.id,
            fullName: user.fullName,
            email: user.email,
            phone: user.phone ?? '',
            role: user.role,
            dateOfBirth: user.dateOfBirth ?? null,
            marriageDate: user.marriageDate ?? null,
        });
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
router.patch('/me', auth_1.authenticate, async (req, res) => {
    try {
        const user = await repo().findOneBy({ id: req.user.id });
        if (!user)
            return res.status(404).json({ message: 'User not found' });
        const { fullName, phone, dateOfBirth, marriageDate } = req.body;
        if (fullName)
            user.fullName = fullName;
        if (phone !== undefined)
            user.phone = phone;
        if (dateOfBirth !== undefined)
            user.dateOfBirth = dateOfBirth;
        if (marriageDate !== undefined)
            user.marriageDate = marriageDate;
        await repo().save(user);
        res.json({
            id: user.id,
            fullName: user.fullName,
            email: user.email,
            phone: user.phone ?? '',
            role: user.role,
            dateOfBirth: user.dateOfBirth ?? null,
            marriageDate: user.marriageDate ?? null,
        });
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
exports.default = router;
