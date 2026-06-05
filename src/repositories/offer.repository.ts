import { ILike, Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { Offer, OfferStatus } from '../entities/Offer';
import { BaseRepository } from './base.repository';

export class OfferRepository extends BaseRepository<Offer> {
  constructor() { super(Offer); }

  async search(params: {
    search?: string;
    status?: OfferStatus;
    page?: number;
    limit?: number;
  }) {
    const qb = this.repo.createQueryBuilder('offer')
      .where('offer.deletedAt IS NULL');

    if (params.search)
      qb.andWhere('(offer.title ILIKE :s OR offer.description ILIKE :s)', { s: `%${params.search}%` });
    if (params.status)
      qb.andWhere('offer.status = :status', { status: params.status });

    const page = params.page || 1;
    const limit = params.limit || 20;
    qb.orderBy('offer.createdAt', 'DESC').skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findActiveOffers(): Promise<Offer[]> {
    const now = new Date();
    return this.repo.createQueryBuilder('offer')
      .where('offer.status = :status', { status: 'active' })
      .andWhere('offer.startDate <= :now', { now })
      .andWhere('offer.endDate >= :now', { now })
      .andWhere('offer.deletedAt IS NULL')
      .orderBy('offer.isFeatured', 'DESC')
      .getMany();
  }

  async incrementUsage(id: number): Promise<void> {
    await this.repo.increment({ id }, 'usedCount', 1);
  }
}
