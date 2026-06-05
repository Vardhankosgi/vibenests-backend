import { Request, Response } from 'express';
import * as svc from '../services/offerConfiguration.service';

const getIp = (req: Request) => req.ip || req.socket.remoteAddress;

export const listConfigs = async (req: Request, res: Response) => {
  try {
    const { page, limit } = req.query as any;
    res.json(await svc.getConfigs({ page: +page || 1, limit: +limit || 50 }));
  } catch (e: any) { res.status(400).json({ message: e.message }); }
};

export const getConfigsMap = async (_req: Request, res: Response) => {
  try { res.json(await svc.getConfigsMap()); }
  catch (e: any) { res.status(400).json({ message: e.message }); }
};

export const upsertConfig = async (req: Request & { user?: any }, res: Response) => {
  try { res.json(await svc.upsertConfig(req.body, req.user.id, getIp(req))); }
  catch (e: any) { res.status(400).json({ message: e.message }); }
};
