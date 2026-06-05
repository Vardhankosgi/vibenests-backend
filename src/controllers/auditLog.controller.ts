import { Request, Response } from 'express';
import { AuditLogRepository } from '../repositories/auditLog.repository';

const auditRepo = new AuditLogRepository();

export const listAuditLogs = async (req: Request, res: Response) => {
  try {
    const { entityType, entityId, action, performedBy, page, limit } = req.query as any;
    res.json(await auditRepo.search({
      entityType, entityId: entityId ? +entityId : undefined,
      action, performedBy: performedBy ? +performedBy : undefined,
      page: +page || 1, limit: +limit || 20,
    }));
  } catch (e: any) { res.status(400).json({ message: e.message }); }
};
