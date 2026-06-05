import { RefundCalculation, RefundStatus } from '../entities/RefundCalculation';
import { BaseRepository } from './base.repository';

export class RefundCalculationRepository extends BaseRepository<RefundCalculation> {
  constructor() { super(RefundCalculation); }

  async findByBookingId(bookingId: number): Promise<RefundCalculation | null> {
    return this.repo.findOne({
      where: { bookingId },
      relations: ['booking'],
      order: { createdAt: 'DESC' },
    });
  }

  async search(params: { status?: RefundStatus; page?: number; limit?: number }) {
    const qb = this.repo.createQueryBuilder('rc')
      .leftJoinAndSelect('rc.booking', 'booking');

    if (params.status) qb.andWhere('rc.status = :status', { status: params.status });

    const page = params.page || 1;
    const limit = params.limit || 20;
    qb.orderBy('rc.createdAt', 'DESC').skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
}
