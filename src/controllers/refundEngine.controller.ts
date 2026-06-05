import { Request, Response } from 'express';
import * as svc from '../services/refundEngine.service';

const getIp = (req: Request) => req.ip || req.socket.remoteAddress;

export const calculateRefund = async (req: Request, res: Response) => {
  try {
    const { bookingId, policyId } = req.body;
    res.json(await svc.calculateRefund(+bookingId, policyId ? +policyId : undefined));
  } catch (e: any) { res.status(400).json({ message: e.message }); }
};

export const initiateRefund = async (req: Request & { user?: any }, res: Response) => {
  try {
    const { bookingId, policyId } = req.body;
    res.status(201).json(await svc.initiateRefund(+bookingId, req.user.id, policyId ? +policyId : undefined, getIp(req)));
  } catch (e: any) { res.status(400).json({ message: e.message }); }
};

export const processRefund = async (req: Request & { user?: any }, res: Response) => {
  try {
    const { action, reason } = req.body;
    res.json(await svc.processRefund(+req.params.id, action, req.user.id, reason, getIp(req)));
  } catch (e: any) { res.status(400).json({ message: e.message }); }
};

export const listRefunds = async (req: Request, res: Response) => {
  try {
    const { status, page, limit } = req.query as any;
    res.json(await svc.getRefunds({ status, page: +page || 1, limit: +limit || 20 }));
  } catch (e: any) { res.status(400).json({ message: e.message }); }
};

export const getRefund = async (req: Request, res: Response) => {
  try {
    res.json(await svc.getRefundById(+req.params.id));
  } catch (e: any) { res.status(404).json({ message: e.message }); }
};
