"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_service_1 = require("../services/auth.service");
const password_service_1 = require("../services/password.service");
const otp_service_1 = require("../services/otp.service");
const validate_1 = require("../middleware/validate");
const schemas_1 = require("../validation/schemas");
const router = express_1.default.Router();
router.post('/register', (0, validate_1.validateBody)(schemas_1.registerSchema), async (req, res) => {
    try {
        const user = await (0, auth_service_1.registerUser)(req.body);
        res.status(201).json({
            id: user.id,
            email: user.email,
            role: user.role,
            fullName: user.fullName,
            dateOfBirth: user.dateOfBirth ?? null,
            marriageDate: user.marriageDate ?? null,
        });
    }
    catch (err) {
        res.status(400).json({ message: err.message });
    }
});
router.post('/login', (0, validate_1.validateBody)(schemas_1.loginSchema), async (req, res) => {
    try {
        const { email, password } = req.body;
        const data = await (0, auth_service_1.loginUser)(email, password);
        res.json({
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
            user: { id: data.user.id, email: data.user.email, role: data.user.role, fullName: data.user.fullName, dateOfBirth: data.user.dateOfBirth ?? null },
        });
    }
    catch (err) {
        res.status(400).json({ message: err.message });
    }
});
router.post('/otp/send', async (req, res) => {
    try {
        const { phone } = req.body;
        if (!phone)
            return res.status(400).json({ message: 'phone is required' });
        const result = await (0, otp_service_1.sendOtp)(phone);
        res.json(result);
    }
    catch (err) {
        res.status(400).json({ message: err.message });
    }
});
router.post('/otp/verify', async (req, res) => {
    try {
        const { phone, otp } = req.body;
        if (!phone || !otp)
            return res.status(400).json({ message: 'phone and otp are required' });
        const data = await (0, otp_service_1.verifyOtp)(phone, otp);
        res.json(data);
    }
    catch (err) {
        res.status(400).json({ message: err.message });
    }
});
router.post('/refresh', async (req, res) => {
    try {
        const { refreshToken } = req.body;
        const data = await (0, auth_service_1.refreshAccessToken)(refreshToken);
        res.json(data);
    }
    catch (err) {
        res.status(400).json({ message: err.message });
    }
});
router.post('/logout', async (req, res) => {
    try {
        const { refreshToken } = req.body;
        await (0, auth_service_1.logout)(refreshToken);
        res.json({ message: 'Logged out' });
    }
    catch (err) {
        res.status(400).json({ message: err.message });
    }
});
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        const token = await (0, password_service_1.createResetTokenForUser)(email);
        console.log('Password reset token for', email, token);
        res.json({ message: 'Password reset requested. Check your email for the reset link.' });
    }
    catch (err) {
        if (err?.message === 'smtp_not_configured') {
            return res.status(503).json({ message: 'Email service is not configured. Please contact support.' });
        }
        res.status(400).json({ message: err.message });
    }
});
router.post('/reset-password', async (req, res) => {
    try {
        const { token, password } = req.body;
        await (0, auth_service_1.resetPasswordWithToken)(token, password);
        res.json({ message: 'Password reset successful' });
    }
    catch (err) {
        res.status(400).json({ message: err.message });
    }
});
exports.default = router;
