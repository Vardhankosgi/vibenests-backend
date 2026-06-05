import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import * as ctrl from '../controllers/refundPolicy.controller';
import { refundPolicyCreateSchema, refundPolicyUpdateSchema, addOnRefundRuleSchema } from '../validation/offersSchemas';

const router = Router();
router.use(authenticate, requireRole('admin'));

router.get('/', ctrl.listPolicies);
router.get('/:id', ctrl.getPolicy);
router.post('/', validateBody(refundPolicyCreateSchema), ctrl.createPolicy);
router.put('/:id', validateBody(refundPolicyUpdateSchema), ctrl.updatePolicy);
router.delete('/:id', ctrl.deletePolicy);

// Add-on refund rules nested under a policy
router.post('/:id/rules', validateBody(addOnRefundRuleSchema), ctrl.addRule);
router.put('/:id/rules/:ruleId', ctrl.updateRule);
router.delete('/:id/rules/:ruleId', ctrl.deleteRule);

export default router;
