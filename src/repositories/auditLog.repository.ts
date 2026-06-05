import { AuditLog } from '../entities/AuditLog';
import { BaseRepository } from './base.repository';

export class AuditLogRepository extends BaseRepository<AuditLog> {
  constructor() { super(AuditLog); }

  async log(data: {
    entityType: string;
    entityId: number;
    action: AuditLog['action'];
    performedBy?: number;
    performedByRole?: string;
    previousData?: object;
    newData?: object;
    note?: string;
    ipAddress?: string;
  }): Promise<AuditLog> {
    return this.create(data);
  }

  async search(params: {
    entityType?: string;
    entityId?: number;
    action?: string;
    performedBy?: number;
    page?: number;
    limit?: number;
  }) {
    const qb = this.repo.createQueryBuilder('al');

    if (params.entityType) qb.andWhere('al.entityType = :et', { et: params.entityType });
    if (params.entityId) qb.andWhere('al.entityId = :eid', { eid: params.entityId });
    if (params.action) qb.andWhere('al.action = :action', { action: params.action });
    if (params.performedBy) qb.andWhere('al.performedBy = :pb', { pb: params.performedBy });

    const page = params.page || 1;
    const limit = params.limit || 20;
    qb.orderBy('al.createdAt', 'DESC').skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
}
