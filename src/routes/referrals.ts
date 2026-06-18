import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import * as svc from '../services/referrals.service';

const router = Router();

// Public: validate code before/during registration
router.get('/validate/:code', async (req, res) => {
  try {
    const result = await svc.validateReferralCode(req.params.code);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// Authenticated customer: get my statistics and rewards
router.get('/stats', authenticate, async (req: any, res) => {
  try {
    const stats = await svc.getReferralStats(req.user.id);
    res.json(stats);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// Admin: view all referrals
router.get('/admin/all', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const result = await svc.adminGetReferrals({ page, limit });
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// Admin: approve referral reward
router.post('/admin/rewards/:id/approve', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const result = await svc.adminApproveReward(Number(req.params.id));
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// Admin: revoke referral reward
router.post('/admin/rewards/:id/revoke', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const result = await svc.adminRevokeReward(Number(req.params.id));
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

export default router;
