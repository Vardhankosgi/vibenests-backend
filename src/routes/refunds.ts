import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import * as ctrl from '../controllers/refundEngine.controller';
import { refundInitiateSchema, refundProcessSchema } from '../validation/offersSchemas';

const router = Router();
router.use(authenticate);

router.post('/calculate', validateBody(refundInitiateSchema), ctrl.calculateRefund);
router.post('/initiate', validateBody(refundInitiateSchema), ctrl.initiateRefund);

router.get('/', requireRole('admin'), ctrl.listRefunds);
router.get('/:id', requireRole('admin'), ctrl.getRefund);
router.patch('/:id/process', requireRole('admin'), validateBody(refundProcessSchema), ctrl.processRefund);

export default router;
