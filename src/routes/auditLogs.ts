import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import * as ctrl from '../controllers/auditLog.controller';

const router = Router();
router.use(authenticate, requireRole('admin'));

router.get('/', ctrl.listAuditLogs);

export default router;
