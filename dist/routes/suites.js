"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const suites_service_1 = require("../services/suites.service");
const router = express_1.default.Router();
router.get('/', async (req, res) => {
    try {
        const suites = await (0, suites_service_1.findSuites)();
        res.json(suites);
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
router.get('/:id', async (req, res) => {
    try {
        const suite = await (0, suites_service_1.findSuiteById)(Number(req.params.id));
        if (!suite)
            return res.status(404).json({ message: 'Suite not found' });
        res.json(suite);
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
router.post('/', auth_1.authenticate, (0, auth_1.requireRole)('admin'), async (req, res) => {
    try {
        const suite = await (0, suites_service_1.createSuite)(req.body);
        res.status(201).json(suite);
    }
    catch (err) {
        res.status(400).json({ message: err.message });
    }
});
router.patch('/:id', auth_1.authenticate, (0, auth_1.requireRole)('admin'), async (req, res) => {
    try {
        const suite = await (0, suites_service_1.updateSuite)(Number(req.params.id), req.body);
        res.json(suite);
    }
    catch (err) {
        res.status(400).json({ message: err.message });
    }
});
router.delete('/:id', auth_1.authenticate, (0, auth_1.requireRole)('admin'), async (req, res) => {
    try {
        await (0, suites_service_1.deleteSuite)(Number(req.params.id));
        res.json({ message: 'Suite removed' });
    }
    catch (err) {
        res.status(400).json({ message: err.message });
    }
});
router.get('/:id/availability', auth_1.authenticate, (0, auth_1.requireRole)('admin'), async (req, res) => {
    try {
        const availability = await (0, suites_service_1.getAvailabilityForSuite)(Number(req.params.id));
        res.json(availability);
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
router.post('/:id/availability', auth_1.authenticate, (0, auth_1.requireRole)('admin'), async (req, res) => {
    try {
        const { date, timeSlot, note } = req.body;
        const availability = await (0, suites_service_1.addAvailabilitySlot)(Number(req.params.id), date, timeSlot, note);
        res.status(201).json(availability);
    }
    catch (err) {
        res.status(400).json({ message: err.message });
    }
});
router.delete('/:id/availability/:availabilityId', auth_1.authenticate, (0, auth_1.requireRole)('admin'), async (req, res) => {
    try {
        await (0, suites_service_1.removeAvailabilitySlot)(Number(req.params.availabilityId));
        res.json({ message: 'Availability slot removed' });
    }
    catch (err) {
        res.status(400).json({ message: err.message });
    }
});
exports.default = router;
