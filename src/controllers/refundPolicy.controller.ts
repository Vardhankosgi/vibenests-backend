import { Request, Response } from 'express';
import * as svc from '../services/refundPolicy.service';

const getIp = (req: Request) => req.ip || req.socket.remoteAddress;

export const listPolicies = async (req: Request, res: Response) => {
  try {
    const { search, isActive, page, limit } = req.query as any;
    res.json(await svc.getRefundPolicies({ search, isActive: isActive !== undefined ? isActive === 'true' : undefined, page: +page || 1, limit: +limit || 20 }));
  } catch (e: any) { res.status(400).json({ message: e.message }); }
};

export const getPolicy = async (req: Request, res: Response) => {
  try {
    res.json(await svc.getRefundPolicyById(+req.params.id));
  } catch (e: any) { res.status(404).json({ message: e.message }); }
};

export const createPolicy = async (req: Request & { user?: any }, res: Response) => {
  try {
    res.status(201).json(await svc.createRefundPolicy(req.body, req.user.id, getIp(req)));
  } catch (e: any) { res.status(400).json({ message: e.message }); }
};

export const updatePolicy = async (req: Request & { user?: any }, res: Response) => {
  try {
    res.json(await svc.updateRefundPolicy(+req.params.id, req.body, req.user.id, getIp(req)));
  } catch (e: any) { res.status(400).json({ message: e.message }); }
};

export const deletePolicy = async (req: Request & { user?: any }, res: Response) => {
  try {
    await svc.deleteRefundPolicy(+req.params.id, req.user.id, getIp(req));
    res.json({ message: 'Refund policy deleted' });
  } catch (e: any) { res.status(400).json({ message: e.message }); }
};

export const addRule = async (req: Request & { user?: any }, res: Response) => {
  try {
    res.status(201).json(await svc.addAddOnRule(+req.params.id, req.body, req.user.id));
  } catch (e: any) { res.status(400).json({ message: e.message }); }
};

export const updateRule = async (req: Request & { user?: any }, res: Response) => {
  try {
    res.json(await svc.updateAddOnRule(+req.params.ruleId, req.body, req.user.id));
  } catch (e: any) { res.status(400).json({ message: e.message }); }
};

export const deleteRule = async (req: Request & { user?: any }, res: Response) => {
  try {
    await svc.deleteAddOnRule(+req.params.ruleId, req.user.id);
    res.json({ message: 'Rule deleted' });
  } catch (e: any) { res.status(400).json({ message: e.message }); }
};
