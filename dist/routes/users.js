"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const data_source_1 = require("../data-source");
const User_1 = require("../entities/User");
const router = express_1.default.Router();
const repo = () => data_source_1.AppDataSource.getRepository(User_1.User);
router.get('/', auth_1.authenticate, (0, auth_1.requireRole)('admin'), async (req, res) => {
    try {
        const users = await repo().find();
        res.json(users.map(u => ({ id: u.id, fullName: u.fullName, email: u.email, role: u.role, createdAt: u.createdAt })));
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
router.get('/me', auth_1.authenticate, async (req, res) => {
    try {
        const user = await repo().findOneBy({ id: req.user.id });
        if (!user)
            return res.status(404).json({ message: 'User not found' });
        res.json({ id: user.id, fullName: user.fullName, email: user.email, role: user.role });
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
exports.default = router;
