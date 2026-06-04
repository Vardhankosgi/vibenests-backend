import express from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import {
  createAddOn,
  findAddOns,
  findAllAddOns,
  findAddOnById,
  updateAddOn,
  deleteAddOn,
} from '../services/addons.service';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const addons = await findAddOns();
    res.json(addons);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/all', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const addons = await findAllAddOns();
    res.json(addons);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const addon = await findAddOnById(Number(req.params.id));
    if (!addon) return res.status(404).json({ message: 'Add-on not found' });
    res.json(addon);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', authenticate, requireRole('admin'), async (req: any, res) => {
  try {
    const addon = await createAddOn(req.body);
    res.status(201).json(addon);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.patch('/:id', authenticate, requireRole('admin'), async (req: any, res) => {
  try {
    const addon = await updateAddOn(Number(req.params.id), req.body);
    res.json(addon);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.delete('/:id', authenticate, requireRole('admin'), async (req: any, res) => {
  try {
    await deleteAddOn(Number(req.params.id));
    res.json({ message: 'Add-on removed' });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

export default router;
