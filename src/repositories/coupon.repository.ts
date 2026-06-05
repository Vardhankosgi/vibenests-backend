import { Coupon, CouponStatus } from '../entities/Coupon';
import { BaseRepository } from './base.repository';

export class CouponRepository extends BaseRepository<Coupon> {
  constructor() { super(Coupon); }

  async findByCode(code: string): Promise<Coupon | null> {
    return this.repo.findOne({ where: { code: code.toUpperCase() } });
  }

  async search(params: { search?: string; status?: CouponStatus; page?: number; limit?: number }) {
    const qb = this.repo.createQueryBuilder('coupon').where('coupon.deletedAt IS NULL');

    if (params.search)
      qb.andWhere('(coupon.code ILIKE :s OR coupon.description ILIKE :s)', { s: `%${params.search}%` });
    if (params.status)
      qb.andWhere('coupon.status = :status', { status: params.status });

    const page = params.page || 1;
    const limit = params.limit || 20;
    qb.orderBy('coupon.createdAt', 'DESC').skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async incrementUsage(id: number): Promise<void> {
    await this.repo.increment({ id }, 'usedCount', 1);
  }
}
