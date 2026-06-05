import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import * as ctrl from '../controllers/taxCharges.controller';
import { taxChargeCreateSchema, taxChargeUpdateSchema, taxCalculateSchema } from '../validation/offersSchemas';

const router = Router();

// Public: calculate tax for a given amount
router.post('/calculate', validateBody(taxCalculateSchema), ctrl.calculateTax);

router.use(authenticate, requireRole('admin'));
router.get('/', ctrl.listTaxCharges);
router.get('/:id', ctrl.getTaxCharge);
router.post('/', validateBody(taxChargeCreateSchema), ctrl.createTaxCharge);
router.put('/:id', validateBody(taxChargeUpdateSchema), ctrl.updateTaxCharge);
router.delete('/:id', ctrl.deleteTaxCharge);

export default router;
