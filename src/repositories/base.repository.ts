import { Repository, FindOptionsWhere, ObjectLiteral, DataSource } from 'typeorm';
import { AppDataSource } from '../data-source';

export interface PaginationResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class BaseRepository<T extends ObjectLiteral> {
  protected repo: Repository<T>;

  constructor(entity: new () => T) {
    this.repo = AppDataSource.getRepository(entity);
  }

  async findAll(options?: {
    page?: number;
    limit?: number;
    where?: FindOptionsWhere<T>;
    order?: any;
    relations?: string[];
    withDeleted?: boolean;
  }): Promise<PaginationResult<T>> {
    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const skip = (page - 1) * limit;

    const [data, total] = await this.repo.findAndCount({
      where: options?.where,
      order: options?.order || { id: 'DESC' } as any,
      take: limit,
      skip,
      relations: options?.relations,
      withDeleted: options?.withDeleted,
    });

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findById(id: number, relations?: string[]): Promise<T | null> {
    return this.repo.findOne({ where: { id } as any, relations });
  }

  async create(data: Partial<T>): Promise<T> {
    const entity = this.repo.create(data as any);
    return this.repo.save(entity as any);
  }

  async update(id: number, data: Partial<T>): Promise<T | null> {
    await this.repo.update(id, data as any);
    return this.findById(id);
  }

  async softDelete(id: number): Promise<void> {
    await this.repo.softDelete(id);
  }

  async restore(id: number): Promise<void> {
    await this.repo.restore(id);
  }

  async hardDelete(id: number): Promise<void> {
    await this.repo.delete(id);
  }

  getRepo(): Repository<T> {
    return this.repo;
  }
}
