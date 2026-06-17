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
const token_service_1 = require("./token.service");
dotenv_1.default.config();
const userRepo = () => data_source_1.AppDataSource.getRepository(User_1.User);
const registerUser = async (data) => {
    const repo = userRepo();
    const exists = await repo.findOneBy({ email: data.email });
    if (exists)
        throw new Error('User already exists');
    const hash = await bcrypt_1.default.hash(data.password, 10);
    const user = repo.create({
        fullName: data.fullName,
        email: data.email,
        password: hash,
        phone: data.phone,
        dateOfBirth: data.dateOfBirth,
        marriageDate: data.marriageDate,
    });
    return repo.save(user);
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
    try {
        const resetSecret = process.env.JWT_PASSWORD_RESET_SECRET || process.env.JWT_SECRET || 'secret';
        const payload = jsonwebtoken_1.default.verify(token, resetSecret);
        const repo = userRepo();
        const user = await repo.findOneBy({ id: payload.userId });
        if (!user)
            throw new Error('User not found');
        user.password = await bcrypt_1.default.hash(newPassword, 10);
        user.isVerified = true;
        user.isActive = true;
        return repo.save(user);
    }
    catch (err) {
        throw new Error('Invalid or expired token');
    }
};
exports.resetPasswordWithToken = resetPasswordWithToken;
const generatePasswordResetToken = (userId) => {
    const resetSecret = process.env.JWT_PASSWORD_RESET_SECRET || process.env.JWT_SECRET || 'secret';
    const expiresIn = (process.env.JWT_PASSWORD_RESET_EXPIRES_IN || '24h');
    return jsonwebtoken_1.default.sign({ userId }, resetSecret, { expiresIn });
};
exports.generatePasswordResetToken = generatePasswordResetToken;
