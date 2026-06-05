import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import * as ctrl from '../controllers/offerConfiguration.controller';
import { offerConfigSchema } from '../validation/offersSchemas';

const router = Router();
router.use(authenticate, requireRole('admin'));

router.get('/', ctrl.listConfigs);
router.get('/map', ctrl.getConfigsMap);
router.post('/', validateBody(offerConfigSchema), ctrl.upsertConfig);

export default router;
