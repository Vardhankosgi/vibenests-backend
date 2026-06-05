import { Request, Response } from 'express';
import * as svc from '../services/liveCelebrationSettings.service';

const getIp = (req: Request) => req.ip || req.socket.remoteAddress;

export const listSettings = async (req: Request, res: Response) => {
  try {
    const { group, page, limit } = req.query as any;
    res.json(await svc.getSettings({ group, page: +page || 1, limit: +limit || 50 }));
  } catch (e: any) { res.status(400).json({ message: e.message }); }
};

export const getSettingsMap = async (_req: Request, res: Response) => {
  try { res.json(await svc.getSettingsMap()); }
  catch (e: any) { res.status(400).json({ message: e.message }); }
};

export const upsertSetting = async (req: Request & { user?: any }, res: Response) => {
  try { res.json(await svc.upsertSetting(req.body, req.user.id, getIp(req))); }
  catch (e: any) { res.status(400).json({ message: e.message }); }
};

export const deleteSetting = async (req: Request & { user?: any }, res: Response) => {
  try {
    await svc.deleteSetting(+req.params.id, req.user.id, getIp(req));
    res.json({ message: 'Setting deleted' });
  } catch (e: any) { res.status(400).json({ message: e.message }); }
};
