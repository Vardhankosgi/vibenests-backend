import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import * as ctrl from '../controllers/refundEngine.controller';

const router = Router();

// ── Public: policy tiers ──────────────────────────────────────────────────────
router.get('/policy', ctrl.getPolicy);

// ── Authenticated ─────────────────────────────────────────────────────────────
router.use(authenticate);

// Customer-facing
router.post('/calculate', ctrl.calculateRefund);
router.post('/initiate', ctrl.initiateRefund);
router.get('/', ctrl.listRefunds);
router.get('/:id', ctrl.getRefund);

// Admin manual overrides (exceptional cases)
router.patch('/:id/under-review', requireRole('admin'), ctrl.markUnderReview);
router.post('/:id/approve', requireRole('admin'), ctrl.approveRefund);
router.post('/:id/reject', requireRole('admin'), ctrl.rejectRefund);
router.post('/:id/processing', requireRole('admin'), ctrl.progressToProcessing);
router.post('/:id/complete', requireRole('admin'), ctrl.completeRefund);

export default router;
