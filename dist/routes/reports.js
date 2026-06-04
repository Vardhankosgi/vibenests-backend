"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const data_source_1 = require("../data-source");
const router = express_1.default.Router();
router.use(auth_1.authenticate, (0, auth_1.requireRole)('admin'));
// Booking report: counts by status within date range
router.get('/bookings', async (req, res) => {
    try {
        const { start, end } = req.query;
        const qb = data_source_1.AppDataSource.getRepository('Booking').createQueryBuilder('b');
        if (start)
            qb.andWhere('b.createdAt >= :start', { start });
        if (end)
            qb.andWhere('b.createdAt <= :end', { end });
        const rows = await qb.select('b.status, COUNT(b.id) as count').groupBy('b.status').getRawMany();
        res.json(rows);
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
// Revenue report: sum payments between dates grouped by day
router.get('/revenue', async (req, res) => {
    try {
        const { start, end } = req.query;
        const qb = data_source_1.AppDataSource.getRepository('Payment').createQueryBuilder('p');
        qb.where("p.status = 'success'");
        if (start)
            qb.andWhere('p.createdAt >= :start', { start });
        if (end)
            qb.andWhere('p.createdAt <= :end', { end });
        const rows = await qb
            .select("TO_CHAR(p.createdAt, 'YYYY-MM-DD') as day")
            .addSelect('SUM(p.amount)::numeric::float8 as total')
            .groupBy('day')
            .orderBy('day', 'ASC')
            .getRawMany();
        res.json(rows);
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
// Customer report: new registrations within range
router.get('/customers', async (req, res) => {
    try {
        const { start, end } = req.query;
        const qb = data_source_1.AppDataSource.getRepository('User').createQueryBuilder('u');
        if (start)
            qb.andWhere('u.createdAt >= :start', { start });
        if (end)
            qb.andWhere('u.createdAt <= :end', { end });
        const rows = await qb.select('COUNT(u.id) as new_registrations').getRawOne();
        res.json(rows);
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
exports.default = router;
