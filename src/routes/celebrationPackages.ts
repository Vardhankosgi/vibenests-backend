import express from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import {
  createPackage,
  findActivePackages,
  findAllPackages,
  findPackageById,
  updatePackage,
  deletePackage,
} from '../services/celebrationPackages.service';

const router = express.Router();

// Public: active packages only
router.get('/', async (_req, res) => {
  try {
    res.json(await findActivePackages());
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// Admin: all packages
router.get('/all', authenticate, requireRole('admin', 'superadmin'), async (_req, res) => {
  try {
    res.json(await findAllPackages());
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const pkg = await findPackageById(Number(req.params.id));
    if (!pkg) return res.status(404).json({ message: 'Package not found' });
    res.json(pkg);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', authenticate, requireRole('admin', 'superadmin'), async (req, res) => {
  try {
    const pkg = await createPackage(req.body);
    res.status(201).json(pkg);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.patch('/:id', authenticate, requireRole('admin', 'superadmin'), async (req, res) => {
  try {
    const pkg = await updatePackage(Number(req.params.id), req.body);
    res.json(pkg);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.delete('/:id', authenticate, requireRole('admin', 'superadmin'), async (req, res) => {
  try {
    await deletePackage(Number(req.params.id));
    res.json({ message: 'Package deleted' });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

export default router;
