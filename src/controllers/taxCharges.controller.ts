import { Request, Response } from 'express';
import * as svc from '../services/taxCharges.service';

const getIp = (req: Request) => req.ip || req.socket.remoteAddress;

export const listTaxCharges = async (req: Request, res: Response) => {
  try {
    const { search, isActive, page, limit } = req.query as any;
    res.json(await svc.getTaxCharges({ search, isActive: isActive !== undefined ? isActive === 'true' : undefined, page: +page || 1, limit: +limit || 20 }));
  } catch (e: any) { res.status(400).json({ message: e.message }); }
};

export const getTaxCharge = async (req: Request, res: Response) => {
  try { res.json(await svc.getTaxChargeById(+req.params.id)); }
  catch (e: any) { res.status(404).json({ message: e.message }); }
};

export const createTaxCharge = async (req: Request & { user?: any }, res: Response) => {
  try { res.status(201).json(await svc.createTaxCharge(req.body, req.user.id, getIp(req))); }
  catch (e: any) { res.status(400).json({ message: e.message }); }
};

export const updateTaxCharge = async (req: Request & { user?: any }, res: Response) => {
  try { res.json(await svc.updateTaxCharge(+req.params.id, req.body, req.user.id, getIp(req))); }
  catch (e: any) { res.status(400).json({ message: e.message }); }
};

export const deleteTaxCharge = async (req: Request & { user?: any }, res: Response) => {
  try {
    await svc.deleteTaxCharge(+req.params.id, req.user.id, getIp(req));
    res.json({ message: 'Tax charge deleted' });
  } catch (e: any) { res.status(400).json({ message: e.message }); }
};

export const calculateTax = async (req: Request, res: Response) => {
  try { res.json(await svc.calculateTax(+req.body.amount)); }
  catch (e: any) { res.status(400).json({ message: e.message }); }
};
