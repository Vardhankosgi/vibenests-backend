import { Router, Request, Response } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { AppDataSource } from '../data-source';
import { MembershipPlan } from '../entities/MembershipPlan';
import { UserMembership } from '../entities/UserMembership';
import { User } from '../entities/User';
import { sendPackageSubscriptionEmail } from '../services/notifications.service';
import { z } from 'zod';
import { validateBody } from '../middleware/validate';

const router = Router();

const planRepo = AppDataSource.getRepository(MembershipPlan);
const userMembershipRepo = AppDataSource.getRepository(UserMembership);

const updatePlanSchema = z.object({
  name: z.string().min(1).optional(),
  price: z.number().nonnegative().optional(),
  validityType: z.enum(['monthly', 'quarterly', 'half-yearly', 'yearly', 'custom']).optional(),
  validityDays: z.number().int().positive().optional(),
  maxFreeBookings: z.number().int().nonnegative().optional(),
  eligibleSuites: z.array(z.string()).optional(),
  discountPercent: z.number().min(0).max(100).optional(),
  benefits: z.array(z.string()).optional(),
  terms: z.string().optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

const createPlanSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  price: z.number().nonnegative(),
  validityType: z.enum(['monthly', 'quarterly', 'half-yearly', 'yearly', 'custom']).optional(),
  validityDays: z.number().int().positive(),
  maxFreeBookings: z.number().int().nonnegative().optional(),
  eligibleSuites: z.array(z.string()).optional(),
  discountPercent: z.number().min(0).max(100).optional(),
  benefits: z.array(z.string()).optional(),
  terms: z.string().optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

// 1. GET /memberships/plans - Public list of active plans
router.get('/plans', async (_req: Request, res: Response) => {
  try {
    const plans = await planRepo.find({
      order: { price: 'ASC' }
    });
    res.json(plans);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// 2. GET /memberships/plans/:id - Get specific plan details
router.get('/plans/:id', async (req: Request, res: Response) => {
  try {
    const plan = await planRepo.findOneBy({ id: Number(req.params.id) });
    if (!plan) return res.status(404).json({ message: 'Plan not found' });
    res.json(plan);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// 3. POST /memberships/plans - Admin Create Membership plan (Silver or Gold only)
router.post('/plans', authenticate, requireRole('admin', 'superadmin'), validateBody(createPlanSchema), async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    const existing = await planRepo.findOneBy({ name });
    if (existing) {
      return res.status(400).json({ message: `Membership plan '${name}' already exists.` });
    }
    const plan = planRepo.create(req.body);
    await planRepo.save(plan);
    res.status(201).json(plan);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// 4. PUT /memberships/plans/:id - Admin Update Membership plan
router.put('/plans/:id', authenticate, requireRole('admin', 'superadmin'), validateBody(updatePlanSchema), async (req: Request, res: Response) => {
  try {
    const plan = await planRepo.findOneBy({ id: Number(req.params.id) });
    if (!plan) return res.status(404).json({ message: 'Plan not found' });
    
    planRepo.merge(plan, req.body);
    await planRepo.save(plan);
    res.json(plan);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// 5. DELETE /memberships/plans/:id - Admin Delete Membership plan
router.delete('/plans/:id', authenticate, requireRole('admin', 'superadmin'), async (req: Request, res: Response) => {
  try {
    const plan = await planRepo.findOneBy({ id: Number(req.params.id) });
    if (!plan) return res.status(404).json({ message: 'Plan not found' });
    
    await planRepo.remove(plan);
    res.json({ message: 'Plan deleted successfully' });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// 6. POST /memberships/subscribe - User purchase a membership
router.post('/subscribe', authenticate, async (req: any, res: Response) => {
  try {
    const { planId } = req.body;
    if (!planId) return res.status(400).json({ message: 'planId is required' });

    const plan = await planRepo.findOneBy({ id: Number(planId) });
    if (!plan) return res.status(404).json({ message: 'Plan not found' });
    if (plan.status !== 'active') return res.status(400).json({ message: 'This plan is currently inactive.' });

    // Deactivate existing active memberships of this user
    await userMembershipRepo.update({ userId: req.user.id, status: 'active' }, { status: 'inactive' });

    const now = new Date();
    const expiry = new Date();
    expiry.setDate(now.getDate() + plan.validityDays);

    const paymentId = 'MEM-PAY-' + Math.random().toString(36).substring(2, 11).toUpperCase();

    const userMembership = userMembershipRepo.create({
      userId: req.user.id,
      planId: plan.id,
      planName: plan.name,
      maxFreeBookings: plan.maxFreeBookings ?? 10,
      bookingsUsed: 0,
      eligibleSuites: plan.eligibleSuites || [],
      activationDate: now,
      expiryDate: expiry,
      status: 'active',
      paymentId,
      paymentStatus: 'success',
      amountPaid: plan.price,
    });

    await userMembershipRepo.save(userMembership);

    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOneBy({ id: req.user.id });
    if (user && user.email) {
      sendPackageSubscriptionEmail({
        to: user.email,
        guestName: user.fullName || 'Guest',
        planName: plan.name,
        price: plan.price,
        validityDays: plan.validityDays,
        expiryDate: expiry.toLocaleDateString('en-IN'),
        maxFreeBookings: plan.maxFreeBookings ?? 10,
      }).catch((e) => console.warn('Package subscription email failed:', e?.message));
    }

    res.status(201).json(userMembership);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// 7. GET /memberships/my-active - Get user's current active or latest expired membership
router.get('/my-active', authenticate, async (req: any, res: Response) => {
  try {
    const latest = await userMembershipRepo.findOne({
      where: { userId: req.user.id },
      order: { createdAt: 'DESC' },
      relations: ['plan'],
    });
    
    // Check expiry
    if (latest) {
      const now = new Date();
      if (latest.status === 'active' && latest.expiryDate < now) {
        latest.status = 'expired';
        await userMembershipRepo.save(latest);
      }
    }
    
    res.json(latest || null);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// 8. GET /memberships/purchases - Admin tracker for all membership purchases
router.get('/purchases', authenticate, requireRole('admin', 'superadmin'), async (_req: Request, res: Response) => {
  try {
    const purchases = await userMembershipRepo.find({
      relations: ['user', 'plan'],
      order: { createdAt: 'DESC' },
    });
    res.json(purchases);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
