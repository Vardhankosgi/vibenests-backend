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
// Suite Performance Radar Metrics report
router.get('/suite-performance', async (req, res) => {
    try {
        const { start, end } = req.query;
        // Fetch all suites
        const suites = await data_source_1.AppDataSource.getRepository('Suite').find();
        // 1. Bookings Count query
        const bookingsCountQuery = data_source_1.AppDataSource.getRepository('Booking')
            .createQueryBuilder('b')
            .select('b.suiteId', 'suiteId')
            .addSelect('COUNT(b.id)', 'count')
            .where('b.status != :cancelled', { cancelled: 'cancelled' });
        if (start)
            bookingsCountQuery.andWhere('b.createdAt >= :start', { start });
        if (end)
            bookingsCountQuery.andWhere('b.createdAt <= :end', { end });
        const bookingsCountRows = await bookingsCountQuery.groupBy('b.suiteId').getRawMany();
        // 2. Revenue query
        const revenueQuery = data_source_1.AppDataSource.getRepository('Payment')
            .createQueryBuilder('p')
            .innerJoin('p.booking', 'b')
            .select('b.suiteId', 'suiteId')
            .addSelect('SUM(p.amount)::numeric::float8', 'total')
            .where("p.status = 'success'");
        if (start)
            revenueQuery.andWhere('p.createdAt >= :start', { start });
        if (end)
            revenueQuery.andWhere('p.createdAt <= :end', { end });
        const revenueRows = await revenueQuery.groupBy('b.suiteId').getRawMany();
        // 3. Rating query (Attributing reviews to suites based on users' bookings or direct suiteId)
        const ratingQuery = data_source_1.AppDataSource.getRepository('Review')
            .createQueryBuilder('r')
            .leftJoin('Booking', 'b', 'b.id = r.bookingId OR (r.bookingId IS NULL AND b.userId = r.userId)')
            .select('COALESCE(r.suiteId, b.suiteId)', 'suiteId')
            .addSelect('AVG(r.overall)::numeric::float8', 'avgRating')
            .groupBy('COALESCE(r.suiteId, b.suiteId)');
        const ratingRows = await ratingQuery.getRawMany();
        // Global average rating as a fallback
        const globalAvgRow = await data_source_1.AppDataSource.getRepository('Review')
            .createQueryBuilder('r')
            .select('AVG(r.overall)::numeric::float8', 'avgRating')
            .getRawOne();
        const globalAvg = globalAvgRow?.avgRating || 4.5;
        // 4. Repeat bookings query
        const bookingTableName = data_source_1.AppDataSource.getRepository('Booking').metadata.tableName;
        const repeatQuery = data_source_1.AppDataSource.getRepository('Booking')
            .createQueryBuilder('b')
            .select('b.suiteId', 'suiteId')
            .addSelect('COUNT(b.id)', 'count')
            .where('b.status != :cancelled', { cancelled: 'cancelled' })
            .andWhere(`EXISTS (
          SELECT 1 FROM "${bookingTableName}" prev
          WHERE prev."suiteId" = b."suiteId"
            AND prev.id != b.id
            AND prev.status != :cancelled
            AND (
              (b."userId" IS NOT NULL AND prev."userId" = b."userId") OR
              (b."guestPhone" IS NOT NULL AND prev."guestPhone" = b."guestPhone") OR
              (b."guestEmail" IS NOT NULL AND prev."guestEmail" = b."guestEmail")
            )
            AND prev."createdAt" < b."createdAt"
        )`);
        if (start)
            repeatQuery.andWhere('b.createdAt >= :start', { start });
        if (end)
            repeatQuery.andWhere('b.createdAt <= :end', { end });
        const repeatRows = await repeatQuery.groupBy('b.suiteId').getRawMany();
        // Map rows to lookup maps
        const bookingsMap = Object.fromEntries(bookingsCountRows.map(r => [r.suiteId, Number(r.count)]));
        const revenueMap = Object.fromEntries(revenueRows.map(r => [r.suiteId, Number(r.total)]));
        const ratingMap = Object.fromEntries(ratingRows.map(r => [r.suiteId, Number(r.avgRating)]));
        const repeatMap = Object.fromEntries(repeatRows.map(r => [r.suiteId, Number(r.count)]));
        // Calculate days count
        const startDate = start ? new Date(start) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const endDate = end ? new Date(end) : new Date();
        const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
        const daysCount = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
        function getSlotsPerDay(suite) {
            const startSlot = suite.slotStartTime || '09:00';
            const endSlot = suite.slotEndTime || '21:00';
            const duration = Number(suite.slotDurationMins || 150);
            const gap = Number(suite.gapBetweenSlotsMins || 30);
            const [startH, startM] = startSlot.split(':').map(Number);
            const [endH, endM] = endSlot.split(':').map(Number);
            const totalMinutes = (endH * 60 + endM) - (startH * 60 + startM);
            if (totalMinutes <= 0)
                return 1;
            const slots = Math.floor((totalMinutes + gap) / (duration + gap));
            return Math.max(1, slots);
        }
        const performanceData = suites.map((suite) => {
            const suiteId = suite.id;
            const bookingsCount = bookingsMap[suiteId] || 0;
            const totalPossibleSlots = getSlotsPerDay(suite) * daysCount;
            const occupancy = totalPossibleSlots > 0 ? Math.min(100, Math.round((bookingsCount / totalPossibleSlots) * 100)) : 0;
            return {
                suiteId,
                suiteName: suite.name,
                bookings: bookingsCount,
                revenue: revenueMap[suiteId] || 0,
                rating: Number((ratingMap[suiteId] || globalAvg).toFixed(2)),
                occupancy,
                repeat: repeatMap[suiteId] || 0
            };
        });
        res.json(performanceData);
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
exports.default = router;
