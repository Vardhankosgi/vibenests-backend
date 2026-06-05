import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import * as ctrl from '../controllers/bookingRules.controller';
import { bookingRuleSchema } from '../validation/offersSchemas';

const router = Router();

// Public: get all rules as a flat key-value map (used by frontend checkout)
router.get('/map', ctrl.getRulesMap);

router.use(authenticate, requireRole('admin'));
router.get('/', ctrl.listRules);
router.post('/', validateBody(bookingRuleSchema), ctrl.upsertRule);
router.delete('/:id', ctrl.deleteRule);

export default router;
