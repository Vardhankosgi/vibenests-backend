import { TaxCharge } from '../entities/TaxCharge';
import { BaseRepository } from './base.repository';

export class TaxChargeRepository extends BaseRepository<TaxCharge> {
  constructor() { super(TaxCharge); }

  async findActive(): Promise<TaxCharge[]> {
    return this.repo.find({ where: { isActive: true }, order: { sortOrder: 'ASC' } });
  }

  async search(params: { search?: string; isActive?: boolean; page?: number; limit?: number }) {
    const qb = this.repo.createQueryBuilder('tc').where('tc.deletedAt IS NULL');

    if (params.search)
      qb.andWhere('(tc.name ILIKE :s OR tc.taxCode ILIKE :s)', { s: `%${params.search}%` });
    if (params.isActive !== undefined)
      qb.andWhere('tc.isActive = :isActive', { isActive: params.isActive });

    const page = params.page || 1;
    const limit = params.limit || 20;
    qb.orderBy('tc.sortOrder', 'ASC').skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
}
