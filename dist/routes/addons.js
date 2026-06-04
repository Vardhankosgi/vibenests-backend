"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const addons_service_1 = require("../services/addons.service");
const router = express_1.default.Router();
router.get('/', async (req, res) => {
    try {
        const addons = await (0, addons_service_1.findAddOns)();
        res.json(addons);
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
router.get('/all', auth_1.authenticate, (0, auth_1.requireRole)('admin'), async (req, res) => {
    try {
        const addons = await (0, addons_service_1.findAllAddOns)();
        res.json(addons);
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
router.get('/:id', async (req, res) => {
    try {
        const addon = await (0, addons_service_1.findAddOnById)(Number(req.params.id));
        if (!addon)
            return res.status(404).json({ message: 'Add-on not found' });
        res.json(addon);
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
router.post('/', auth_1.authenticate, (0, auth_1.requireRole)('admin'), async (req, res) => {
    try {
        const addon = await (0, addons_service_1.createAddOn)(req.body);
        res.status(201).json(addon);
    }
    catch (err) {
        res.status(400).json({ message: err.message });
    }
});
router.patch('/:id', auth_1.authenticate, (0, auth_1.requireRole)('admin'), async (req, res) => {
    try {
        const addon = await (0, addons_service_1.updateAddOn)(Number(req.params.id), req.body);
        res.json(addon);
    }
    catch (err) {
        res.status(400).json({ message: err.message });
    }
});
router.delete('/:id', auth_1.authenticate, (0, auth_1.requireRole)('admin'), async (req, res) => {
    try {
        await (0, addons_service_1.deleteAddOn)(Number(req.params.id));
        res.json({ message: 'Add-on removed' });
    }
    catch (err) {
        res.status(400).json({ message: err.message });
    }
});
exports.default = router;
