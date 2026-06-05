import { Request, Response } from 'express';
import * as svc from '../services/bookingRules.service';

const getIp = (req: Request) => req.ip || req.socket.remoteAddress;

export const listRules = async (req: Request, res: Response) => {
  try {
    const { group, page, limit } = req.query as any;
    res.json(await svc.getBookingRules({ group, page: +page || 1, limit: +limit || 50 }));
  } catch (e: any) { res.status(400).json({ message: e.message }); }
};

export const getRulesMap = async (_req: Request, res: Response) => {
  try { res.json(await svc.getBookingRulesMap()); }
  catch (e: any) { res.status(400).json({ message: e.message }); }
};

export const upsertRule = async (req: Request & { user?: any }, res: Response) => {
  try { res.json(await svc.upsertBookingRule(req.body, req.user.id, getIp(req))); }
  catch (e: any) { res.status(400).json({ message: e.message }); }
};

export const deleteRule = async (req: Request & { user?: any }, res: Response) => {
  try {
    await svc.deleteBookingRule(+req.params.id, req.user.id, getIp(req));
    res.json({ message: 'Rule deleted' });
  } catch (e: any) { res.status(400).json({ message: e.message }); }
};
