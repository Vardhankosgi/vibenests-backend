"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generatePasswordResetToken = exports.resetPasswordWithToken = exports.logout = exports.refreshAccessToken = exports.loginUser = exports.registerUser = void 0;
const data_source_1 = require("../data-source");
const User_1 = require("../entities/User");
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const dotenv_1 = __importDefault(require("dotenv"));
const crypto_1 = __importDefault(require("crypto"));
const token_service_1 = require("./token.service");
const referrals_service_1 = require("./referrals.service");
dotenv_1.default.config();
const userRepo = () => data_source_1.AppDataSource.getRepository(User_1.User);
const registerUser = async (data) => {
    const repo = userRepo();
    const normalizedEmail = data.email.trim().toLowerCase();
    const normalizedPhone = data.phone ? data.phone.replace(/\D/g, '') : undefined;
    const existsByEmail = await repo.findOneBy({ email: normalizedEmail });
    if (existsByEmail)
        throw new Error('Email already registered');
    if (normalizedPhone) {
        const existsByPhone = await repo.findOneBy({ phone: normalizedPhone });
        if (existsByPhone)
            throw new Error('Phone already registered');
    }
    // Pre-validate referral code if entered
    if (data.referralCode) {
        const validation = await (0, referrals_service_1.validateReferralCode)(data.referralCode);
        if (!validation.valid) {
            throw new Error(validation.message || 'Invalid referral code');
        }
    }
    const hash = await bcrypt_1.default.hash(data.password, 10);
    const myReferralCode = await (0, referrals_service_1.generateUniqueReferralCode)();
    const user = repo.create({
        fullName: data.fullName,
        email: normalizedEmail,
        password: hash,
        phone: normalizedPhone,
        dateOfBirth: data.dateOfBirth,
        marriageDate: data.marriageDate,
        referralCode: myReferralCode,
    });
    // Quick fix: allow email/password registration to log in without extra verification step.
    user.isVerified = true;
    user.isActive = true;
    try {
        const savedUser = await repo.save(user);
        // Save code to referral_codes table
        const refCodeRepo = data_source_1.AppDataSource.getRepository('ReferralCode');
        const refCode = refCodeRepo.create({ code: myReferralCode, userId: savedUser.id, isActive: true });
        await refCodeRepo.save(refCode);
        // If referred, create the relationship
        if (data.referralCode) {
            try {
                await (0, referrals_service_1.createReferralRelationship)(data.referralCode, savedUser);
            }
            catch (err) {
                console.warn('Failed to link referral relationship:', err?.message);
            }
        }
        return savedUser;
    }
    catch (err) {
        // Postgres unique violation
        if (err?.code === '23505') {
            throw new Error('Email or phone already registered');
        }
        throw err;
    }
};
exports.registerUser = registerUser;
const generateAccessToken = (user) => {
    const payload = { userId: user.id, role: user.role, email: user.email };
    const secret = process.env.JWT_SECRET || 'secret';
    const expiresIn = (process.env.JWT_EXPIRES_IN || '1h');
    const options = { expiresIn };
    return jsonwebtoken_1.default.sign(payload, secret, options);
};
const loginUser = async (email, password) => {
    const repo = userRepo();
    const user = await repo.findOneBy({ email });
    if (!user)
        throw new Error('Invalid credentials');
    if (!user.password)
        throw new Error('This account uses OTP login. Please use mobile OTP.');
    const ok = await bcrypt_1.default.compare(password, user.password);
    if (!ok)
        throw new Error('Invalid credentials');
    if (!user.isVerified)
        throw new Error('Your account is not verified. Please verify your account.');
    const accessToken = generateAccessToken(user);
    const refreshEntity = await (0, token_service_1.createRefreshToken)(user.id);
    return { accessToken, refreshToken: refreshEntity.token, user };
};
exports.loginUser = loginUser;
const refreshAccessToken = async (refreshToken) => {
    const { payload, db } = await (0, token_service_1.verifyRefreshToken)(refreshToken);
    // rotate: revoke old and create new
    await (0, token_service_1.revokeRefreshToken)(refreshToken);
    const repo = userRepo();
    const user = await repo.findOneBy({ id: payload.userId });
    if (!user)
        throw new Error('User not found');
    const accessToken = generateAccessToken(user);
    const newRefresh = await (0, token_service_1.createRefreshToken)(user.id);
    return { accessToken, refreshToken: newRefresh.token };
};
exports.refreshAccessToken = refreshAccessToken;
const logout = async (refreshToken) => {
    await (0, token_service_1.revokeRefreshToken)(refreshToken);
};
exports.logout = logout;
const resetPasswordWithToken = async (token, newPassword) => {
    if (!token)
        throw new Error('Token is required');
    if (!newPassword || newPassword.length < 8) {
        throw new Error('Password must be at least 8 characters long');
    }
    if (!/[A-Z]/.test(newPassword)) {
        throw new Error('Password must contain at least one uppercase letter');
    }
    if (!/[0-9]/.test(newPassword)) {
        throw new Error('Password must contain at least one number');
    }
    const hashedToken = crypto_1.default.createHash('sha256').update(token).digest('hex');
    const repo = userRepo();
    const user = await repo.findOneBy({ resetPasswordToken: hashedToken });
    if (!user) {
        throw new Error('Invalid or expired reset token');
    }
    const now = new Date();
    if (!user.resetPasswordExpiresAt || user.resetPasswordExpiresAt < now) {
        throw new Error('Reset token has expired');
    }
    user.password = await bcrypt_1.default.hash(newPassword, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpiresAt = undefined;
    user.isVerified = true;
    user.isActive = true;
    return repo.save(user);
};
exports.resetPasswordWithToken = resetPasswordWithToken;
const generatePasswordResetToken = async (userId) => {
    const repo = userRepo();
    const user = await repo.findOneBy({ id: userId });
    if (!user)
        throw new Error('User not found');
    const rawToken = crypto_1.default.randomBytes(32).toString('hex');
    const hashedToken = crypto_1.default.createHash('sha256').update(rawToken).digest('hex');
    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    await repo.save(user);
    return rawToken;
};
exports.generatePasswordResetToken = generatePasswordResetToken;
