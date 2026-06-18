import { Request, Response } from 'express';
import * as svc from '../services/coupons.service';
import jwt from 'jsonwebtoken';
import { JwtPayload } from '../middleware/auth';

const getIp = (req: Request) => req.ip || req.socket.remoteAddress;

export const listCoupons = async (req: Request, res: Response) => {
  try {
    const { search, status, page, limit } = req.query as any;
    res.json(await svc.getCoupons({ search, status, page: +page || 1, limit: +limit || 20 }));
  } catch (e: any) { res.status(400).json({ message: e.message }); }
};

export const getCoupon = async (req: Request, res: Response) => {
  try {
    res.json(await svc.getCouponById(+req.params.id));
  } catch (e: any) { res.status(404).json({ message: e.message }); }
};

export const createCoupon = async (req: Request & { user?: any }, res: Response) => {
  try {
    res.status(201).json(await svc.createCoupon(req.body, req.user.id, getIp(req)));
  } catch (e: any) { res.status(400).json({ message: e.message }); }
};

export const updateCoupon = async (req: Request & { user?: any }, res: Response) => {
  try {
    res.json(await svc.updateCoupon(+req.params.id, req.body, req.user.id, getIp(req)));
  } catch (e: any) { res.status(400).json({ message: e.message }); }
};

export const deleteCoupon = async (req: Request & { user?: any }, res: Response) => {
  try {
    await svc.deleteCoupon(+req.params.id, req.user.id, getIp(req));
    res.json({ message: 'Coupon deleted' });
  } catch (e: any) { res.status(400).json({ message: e.message }); }
};

export const validateCoupon = async (req: Request, res: Response) => {
  try {
    const { code, bookingAmount } = req.body;
    let userId = 0;
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const token = authHeader.split(' ')[1];
      if (token) {
        try {
          const payload = jwt.verify(token, process.env.JWT_SECRET || 'secret') as JwtPayload;
          userId = payload.userId;
        } catch (err) {
          // Ignore invalid token for optional auth
        }
      }
    }
    res.json(await svc.validateCoupon(code, bookingAmount, userId));
  } catch (e: any) { res.status(400).json({ message: e.message }); }
};

export const listActiveCoupons = async (_req: Request, res: Response) => {
  try {
    res.json(await svc.getActiveCoupons());
  } catch (e: any) { res.status(400).json({ message: e.message }); }
};
