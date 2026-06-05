import { RefundPolicy } from '../entities/RefundPolicy';
import { BaseRepository } from './base.repository';

export class RefundPolicyRepository extends BaseRepository<RefundPolicy> {
  constructor() { super(RefundPolicy); }

  async findDefault(): Promise<RefundPolicy | null> {
    return this.repo.findOne({ where: { isDefault: true, isActive: true } });
  }

  async search(params: { search?: string; isActive?: boolean; page?: number; limit?: number }) {
    const qb = this.repo.createQueryBuilder('rp')
      .leftJoinAndSelect('rp.addOnRules', 'addOnRules')
      .where('rp.deletedAt IS NULL');

    if (params.search)
      qb.andWhere('(rp.name ILIKE :s OR rp.description ILIKE :s)', { s: `%${params.search}%` });
    if (params.isActive !== undefined)
      qb.andWhere('rp.isActive = :isActive', { isActive: params.isActive });

    const page = params.page || 1;
    const limit = params.limit || 20;
    qb.orderBy('rp.isDefault', 'DESC').addOrderBy('rp.createdAt', 'DESC')
      .skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
}
