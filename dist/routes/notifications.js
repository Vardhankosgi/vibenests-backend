"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const notifications_service_1 = require("../services/notifications.service");
const router = express_1.default.Router();
router.post('/send/email', auth_1.authenticate, (0, auth_1.requireRole)('admin'), async (req, res) => {
    try {
        const { to, subject, body } = req.body;
        await (0, notifications_service_1.sendEmail)(to, subject, body);
        res.json({ message: 'Email queued (stub)' });
    }
    catch (err) {
        res.status(400).json({ message: err.message });
    }
});
router.post('/send/sms', auth_1.authenticate, (0, auth_1.requireRole)('admin'), async (req, res) => {
    try {
        const { phone, message } = req.body;
        await (0, notifications_service_1.sendSms)(phone, message);
        res.json({ message: 'SMS queued (stub)' });
    }
    catch (err) {
        res.status(400).json({ message: err.message });
    }
});
router.post('/send/whatsapp', auth_1.authenticate, (0, auth_1.requireRole)('admin'), async (req, res) => {
    try {
        const { phone, message } = req.body;
        await (0, notifications_service_1.sendWhatsApp)(phone, message);
        res.json({ message: 'WhatsApp queued (stub)' });
    }
    catch (err) {
        res.status(400).json({ message: err.message });
    }
});
exports.default = router;
