"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createResetTokenForUser = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const dotenv_1 = __importDefault(require("dotenv"));
const data_source_1 = require("../data-source");
const User_1 = require("../entities/User");
dotenv_1.default.config();
const createResetTokenForUser = async (email) => {
    const repo = data_source_1.AppDataSource.getRepository(User_1.User);
    const user = await repo.findOneBy({ email });
    if (!user)
        throw new Error('User not found');
    const token = jsonwebtoken_1.default.sign({ userId: user.id }, process.env.JWT_SECRET || 'secret', { expiresIn: '1h' });
    return token;
};
exports.createResetTokenForUser = createResetTokenForUser;
