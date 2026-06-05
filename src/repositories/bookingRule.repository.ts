import { BookingRule } from '../entities/BookingRule';
import { BaseRepository } from './base.repository';

export class BookingRuleRepository extends BaseRepository<BookingRule> {
  constructor() { super(BookingRule); }

  async findByKey(key: string): Promise<BookingRule | null> {
    return this.repo.findOne({ where: { ruleKey: key, isActive: true } });
  }

  async findByGroup(group: string): Promise<BookingRule[]> {
    return this.repo.find({ where: { group, isActive: true } });
  }

  async getAllAsMap(): Promise<Record<string, string>> {
    const rules = await this.repo.find({ where: { isActive: true } });
    return rules.reduce((acc, r) => ({ ...acc, [r.ruleKey]: r.ruleValue }), {} as Record<string, string>);
  }
}
