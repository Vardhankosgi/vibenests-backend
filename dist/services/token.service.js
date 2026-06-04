"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.revokeRefreshToken = exports.verifyRefreshToken = exports.createRefreshToken = void 0;
const data_source_1 = require("../data-source");
const RefreshToken_1 = require("../entities/RefreshToken");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const repo = () => data_source_1.AppDataSource.getRepository(RefreshToken_1.RefreshToken);
const createRefreshToken = async (userId) => {
    const expiresIn = (process.env.REFRESH_EXPIRES_IN || '7d');
    const secret = process.env.REFRESH_SECRET || process.env.JWT_SECRET || 'refresh_secret';
    const options = { expiresIn };
    const token = jsonwebtoken_1.default.sign({ userId }, secret, options);
    const decoded = jsonwebtoken_1.default.decode(token);
    const exp = decoded?.exp ? new Date(decoded.exp * 1000) : undefined;
    const entity = repo().create({ token, user: { id: userId }, expiresAt: exp });
    return repo().save(entity);
};
exports.createRefreshToken = createRefreshToken;
const verifyRefreshToken = async (token) => {
    const secret = process.env.REFRESH_SECRET || process.env.JWT_SECRET || 'refresh_secret';
    try {
        const payload = jsonwebtoken_1.default.verify(token, secret);
        const db = await repo().findOne({ where: { token }, relations: ['user'] });
        if (!db || db.revoked)
            throw new Error('Invalid refresh token');
        return { payload, db };
    }
    catch (err) {
        throw new Error('Invalid refresh token');
    }
};
exports.verifyRefreshToken = verifyRefreshToken;
const revokeRefreshToken = async (token) => {
    const db = await repo().findOne({ where: { token } });
    if (!db)
        return;
    db.revoked = true;
    return repo().save(db);
};
exports.revokeRefreshToken = revokeRefreshToken;
