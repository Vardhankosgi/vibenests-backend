"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyResetToken = exports.createResetTokenForUser = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const dotenv_1 = __importDefault(require("dotenv"));
const data_source_1 = require("../data-source");
const User_1 = require("../entities/User");
const notifications_service_1 = require("./notifications.service");
dotenv_1.default.config();
const RESET_SECRET = () => process.env.JWT_PASSWORD_RESET_SECRET || process.env.JWT_SECRET || 'reset_secret';
const RESET_EXPIRES = () => process.env.JWT_PASSWORD_RESET_EXPIRES_IN || '1h';
const createResetTokenForUser = async (email) => {
    const repo = data_source_1.AppDataSource.getRepository(User_1.User);
    const user = await repo.findOneBy({ email });
    if (!user)
        throw new Error('User not found');
    const token = jsonwebtoken_1.default.sign({ userId: user.id }, RESET_SECRET(), { expiresIn: RESET_EXPIRES() });
    const resetLink = `${process.env.FRONTEND_ORIGIN || 'http://localhost:5174'}/reset-password?token=${token}`;
    const result = await (0, notifications_service_1.sendEmail)(email, 'VibeNests — Password Reset', `Click the link to reset your password: ${resetLink}\n\nThis link expires in 1 hour.`);
    if (!result?.ok) {
        throw new Error(`Failed to send reset email: ${result?.error || 'unknown error'}`);
    }
    return token;
};
exports.createResetTokenForUser = createResetTokenForUser;
const verifyResetToken = (token) => {
    try {
        const payload = jsonwebtoken_1.default.verify(token, RESET_SECRET());
        return payload.userId;
    }
    catch {
        throw new Error('Invalid or expired reset token');
    }
};
exports.verifyResetToken = verifyResetToken;
