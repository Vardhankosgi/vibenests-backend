"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_service_1 = require("../services/auth.service");
// import { createResetTokenForUser, verifyResetToken } from '../services/password.service';
const password_service_1 = require("../services/password.service");
const auth_1 = require("../middleware/auth");
const otp_service_1 = require("../services/otp.service");
const validate_1 = require("../middleware/validate");
const schemas_1 = require("../validation/schemas");
const rateLimit_1 = require("../middleware/rateLimit");
const crypto_1 = __importDefault(require("crypto"));
const data_source_1 = require("../data-source");
const User_1 = require("../entities/User");
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
// Rate limiters:
// Forgot password: 3 requests per 15 minutes per IP
const forgotPasswordLimit = (0, rateLimit_1.rateLimiter)(15 * 60 * 1000, 3, 'Too many password reset requests from this IP. Please try again after 15 minutes.');
// Reset password: 5 attempts per 15 minutes per IP
const resetPasswordLimit = (0, rateLimit_1.rateLimiter)(15 * 60 * 1000, 5, 'Too many password reset attempts. Please try again after 15 minutes.');
router.post('/forgot-password', forgotPasswordLimit, async (req, res) => {
    try {
        const { email } = req.body;
        if (!email || !email.trim()) {
            return res.status(400).json({ message: 'Email is required' });
        }
        try {
            await (0, password_service_1.createResetTokenForUser)(email);
        }
        catch (err) {
            if (err?.message === 'smtp_not_configured') {
                throw err;
            }
            if (err?.message !== 'User not found') {
                console.warn('Error during forgot-password token creation:', err.message);
            }
        }
        res.json({ message: 'If that email address is registered, a password reset link has been sent to it.' });
    }
    catch (err) {
        if (err?.message === 'smtp_not_configured') {
            return res.status(503).json({ message: 'Email service is not configured. Please contact support.' });
        }
        return res.status(400).json({ message: err.message || 'Failed to request password reset' });
    }
});
router.get('/verify-reset-token/:token', async (req, res) => {
    try {
        const { token } = req.params;
        if (!token)
            return res.status(400).json({ valid: false, message: 'Token is required' });
        const hashedToken = crypto_1.default.createHash('sha256').update(token).digest('hex');
        const repo = data_source_1.AppDataSource.getRepository(User_1.User);
        const user = await repo.findOneBy({ resetPasswordToken: hashedToken });
        if (!user) {
            return res.status(400).json({ valid: false, message: 'This password reset link is invalid or has already been used.' });
        }
        const now = new Date();
        if (!user.resetPasswordExpiresAt || user.resetPasswordExpiresAt < now) {
            return res.status(400).json({ valid: false, message: 'This password reset link has expired.' });
        }
        res.json({ valid: true, email: user.email });
    }
    catch (err) {
        res.status(400).json({ valid: false, message: err.message });
    }
});
router.post('/reset-password', resetPasswordLimit, async (req, res) => {
    try {
        const { token, password } = req.body;
        if (!token)
            return res.status(400).json({ message: 'token is required' });
        if (!password)
            return res.status(400).json({ message: 'password is required' });
        // Validate early so we return consistent error when token is invalid.
        (0, password_service_1.verifyResetToken)(token);
        // verifyResetToken(token);
        await (0, auth_service_1.resetPasswordWithToken)(token, password);
        return res.json({ message: 'Password reset successful' });
    }
    catch (err) {
        return res.status(400).json({ message: err.message || 'Invalid or expired token' });
    }
});
router.post('/change-password', auth_1.authenticate, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ message: 'Current password and new password are required' });
        }
        await (0, password_service_1.changePasswordForUser)(req.user.id, currentPassword, newPassword);
        res.json({ message: 'Password updated successfully' });
    }
    catch (err) {
        res.status(400).json({ message: err.message });
    }
});
exports.default = router;
