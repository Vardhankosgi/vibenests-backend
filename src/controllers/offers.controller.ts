import { Request, Response } from 'express';
import * as svc from '../services/offers.service';

const getIp = (req: Request) => req.ip || req.socket.remoteAddress;

export const listOffers = async (req: Request, res: Response) => {
  try {
    const { search, status, page, limit } = req.query as any;
    const result = await svc.getOffers({ search, status, page: +page || 1, limit: +limit || 20 });
    res.json(result);
  } catch (e: any) { res.status(400).json({ message: e.message }); }
};

export const getOffer = async (req: Request, res: Response) => {
  try {
    res.json(await svc.getOfferById(+req.params.id));
  } catch (e: any) { res.status(404).json({ message: e.message }); }
};

export const createOffer = async (req: Request & { user?: any }, res: Response) => {
  try {
    res.status(201).json(await svc.createOffer(req.body, req.user.id, getIp(req)));
  } catch (e: any) { res.status(400).json({ message: e.message }); }
};

export const updateOffer = async (req: Request & { user?: any }, res: Response) => {
  try {
    res.json(await svc.updateOffer(+req.params.id, req.body, req.user.id, getIp(req)));
  } catch (e: any) { res.status(400).json({ message: e.message }); }
};

export const deleteOffer = async (req: Request & { user?: any }, res: Response) => {
  try {
    await svc.deleteOffer(+req.params.id, req.user.id, getIp(req));
    res.json({ message: 'Offer deleted' });
  } catch (e: any) { res.status(400).json({ message: e.message }); }
};

export const activeOffers = async (_req: Request, res: Response) => {
  try {
    res.json(await svc.getActiveOffers());
  } catch (e: any) { res.status(400).json({ message: e.message }); }
};
