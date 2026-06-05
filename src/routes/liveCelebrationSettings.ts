import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import * as ctrl from '../controllers/liveCelebrationSettings.controller';
import { liveCelebrationSettingSchema } from '../validation/offersSchemas';

const router = Router();

// Public: settings map for frontend
router.get('/map', ctrl.getSettingsMap);

router.use(authenticate, requireRole('admin'));
router.get('/', ctrl.listSettings);
router.post('/', validateBody(liveCelebrationSettingSchema), ctrl.upsertSetting);
router.delete('/:id', ctrl.deleteSetting);

export default router;
