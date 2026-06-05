import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import * as ctrl from '../controllers/offers.controller';
import { offerCreateSchema, offerUpdateSchema } from '../validation/offersSchemas';

const router = Router();

// Public: active offers for frontend display
router.get('/active', ctrl.activeOffers);

// Admin only
router.use(authenticate, requireRole('admin'));
router.get('/', ctrl.listOffers);
router.get('/:id', ctrl.getOffer);
router.post('/', validateBody(offerCreateSchema), ctrl.createOffer);
router.put('/:id', validateBody(offerUpdateSchema), ctrl.updateOffer);
router.delete('/:id', ctrl.deleteOffer);

export default router;
