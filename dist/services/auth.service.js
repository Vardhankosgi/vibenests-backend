"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedAdminCredentials = exports.generatePasswordResetToken = exports.resetPasswordWithToken = exports.logout = exports.refreshAccessToken = exports.loginUser = exports.registerUser = void 0;
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
    const rawPhoneDigits = data.phone ? data.phone.replace(/\D/g, '') : undefined;
    const last10 = rawPhoneDigits ? (rawPhoneDigits.length > 10 ? rawPhoneDigits.slice(-10) : rawPhoneDigits) : undefined;
    let targetUser = await repo.findOneBy({ email: normalizedEmail });
    if (last10) {
        const existsByPhone = await repo.findOne({
            where: [
                { phone: last10 },
                { phone: `91${last10}` },
                { phone: `+91${last10}` },
            ],
        });
        if (existsByPhone) {
            if (existsByPhone.fullName === 'New Guest' || existsByPhone.fullName === 'Guest') {
                targetUser = existsByPhone;
            }
            else if (!targetUser || targetUser.id !== existsByPhone.id) {
                throw new Error('An account with this phone number already exists. Please sign in.');
            }
        }
    }
    if (targetUser && targetUser.fullName !== 'New Guest' && targetUser.fullName !== 'Guest' && targetUser.email === normalizedEmail) {
        throw new Error('An account with this email address already exists. Please sign in.');
    }
    // Pre-validate referral code if entered
    if (data.referralCode) {
        const validation = await (0, referrals_service_1.validateReferralCode)(data.referralCode);
        if (!validation.valid) {
            throw new Error(validation.message || 'Invalid referral code');
        }
    }
    const hash = data.password ? await bcrypt_1.default.hash(data.password, 10) : undefined;
    const myReferralCode = targetUser?.referralCode || (await (0, referrals_service_1.generateUniqueReferralCode)());
    if (!targetUser) {
        targetUser = repo.create({
            referralCode: myReferralCode,
        });
    }
    targetUser.fullName = data.fullName;
    targetUser.email = normalizedEmail;
    if (hash)
        targetUser.password = hash;
    if (rawPhoneDigits)
        targetUser.phone = rawPhoneDigits;
    targetUser.dateOfBirth = data.dateOfBirth;
    if (data.marriageDate)
        targetUser.marriageDate = data.marriageDate;
    if (!targetUser.referralCode)
        targetUser.referralCode = myReferralCode;
    targetUser.isVerified = true;
    targetUser.isActive = true;
    try {
        const savedUser = await repo.save(targetUser);
        // Save code to referral_codes table
        const refCodeRepo = data_source_1.AppDataSource.getRepository('ReferralCode');
        const existingRef = await refCodeRepo.findOneBy({ userId: savedUser.id });
        if (!existingRef) {
            const refCode = refCodeRepo.create({ code: myReferralCode, userId: savedUser.id, isActive: true });
            await refCodeRepo.save(refCode);
        }
        // If referred, create the relationship
        if (data.referralCode) {
            try {
                await (0, referrals_service_1.createReferralRelationship)(data.referralCode, savedUser);
            }
            catch (err) {
                console.warn('Failed to link referral relationship:', err?.message);
            }
        }
        const accessToken = generateAccessToken(savedUser);
        const refreshEntity = await (0, token_service_1.createRefreshToken)(savedUser.id);
        return {
            accessToken,
            refreshToken: refreshEntity.token,
            user: {
                id: savedUser.id,
                email: savedUser.email,
                role: savedUser.role,
                fullName: savedUser.fullName,
                dateOfBirth: savedUser.dateOfBirth ?? null,
                marriageDate: savedUser.marriageDate ?? null,
            },
        };
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
const seedAdminCredentials = async () => {
    try {
        const repo = userRepo();
        const adminAccounts = [
            { email: 'admin@vibenests.com', fullName: 'Super Admin', phone: '9876543210', password: 'Admin@VibeNests2026' },
            { email: 'vibenestsmeetingpoint@gmail.com', fullName: 'VibeNests Admin', phone: '9876543211', password: 'Admin@VibeNests2026' },
        ];
        for (const item of adminAccounts) {
            let existing = await repo.findOne({ where: [{ email: item.email }, { phone: item.phone }] });
            const hash = await bcrypt_1.default.hash(item.password, 10);
            if (!existing) {
                existing = repo.create({
                    email: item.email,
                    fullName: item.fullName,
                    phone: item.phone,
                    password: hash,
                    role: 'admin',
                    isActive: true,
                    isVerified: true,
                    dateOfBirth: '1990-01-01',
                });
            }
            else {
                existing.role = 'admin';
                existing.isActive = true;
                existing.isVerified = true;
                existing.password = hash;
            }
            await repo.save(existing);
        }
        console.log('[ADMIN SEED] Successfully seeded Admin accounts in database.');
    }
    catch (err) {
        console.warn('[ADMIN SEED ERROR] Failed seeding admin accounts:', err?.message);
    }
};
exports.seedAdminCredentials = seedAdminCredentials;
