"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRole = exports.authenticate = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader)
        return res.status(401).json({ message: 'Missing authorization header' });
    const token = authHeader.split(' ')[1];
    if (!token)
        return res.status(401).json({ message: 'Invalid authorization header' });
    try {
        const payload = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || 'secret');
        req.user = { id: payload.userId, role: payload.role, email: payload.email };
        next();
    }
    catch (err) {
        return res.status(401).json({ message: 'Invalid token' });
    }
};
exports.authenticate = authenticate;
const requireRole = (role) => {
    return (req, res, next) => {
        if (!req.user)
            return res.status(401).json({ message: 'Unauthenticated' });
        if (req.user.role !== role)
            return res.status(403).json({ message: 'Forbidden' });
        next();
    };
};
exports.requireRole = requireRole;
