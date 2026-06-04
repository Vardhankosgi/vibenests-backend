"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_service_1 = require("../services/auth.service");
const password_service_1 = require("../services/password.service");
const router = express_1.default.Router();
router.post('/register', async (req, res) => {
    try {
        const user = await (0, auth_service_1.registerUser)(req.body);
        res.status(201).json(user);
    }
    catch (err) {
        res.status(400).json({ message: err.message });
    }
});
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const data = await (0, auth_service_1.loginUser)(email, password);
        res.json({ accessToken: data.accessToken, refreshToken: data.refreshToken, user: { id: data.user.id, email: data.user.email, role: data.user.role } });
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
        // In production, send token via email/SMS. For now return token (or log)
        console.log('Password reset token for', email, token);
        res.json({ message: 'Password reset requested. Check logs for token (dev).' });
    }
    catch (err) {
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
