import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import * as ctrl from '../controllers/coupons.controller';
import { couponCreateSchema, couponUpdateSchema, couponValidateSchema } from '../validation/offersSchemas';

const router = Router();

// Public: validate coupon (called during checkout)
router.post('/validate', validateBody(couponValidateSchema), ctrl.validateCoupon);

// Admin only
router.use(authenticate, requireRole('admin'));
router.get('/', ctrl.listCoupons);
router.get('/:id', ctrl.getCoupon);
router.post('/', validateBody(couponCreateSchema), ctrl.createCoupon);
router.put('/:id', validateBody(couponUpdateSchema), ctrl.updateCoupon);
router.delete('/:id', ctrl.deleteCoupon);

export default router;
