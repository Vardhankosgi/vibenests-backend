import { OfferConfiguration } from '../entities/OfferConfiguration';
import { BaseRepository } from './base.repository';

export class OfferConfigurationRepository extends BaseRepository<OfferConfiguration> {
  constructor() { super(OfferConfiguration); }

  async findByKey(key: string): Promise<OfferConfiguration | null> {
    return this.repo.findOne({ where: { configKey: key, isActive: true } });
  }

  async getAllAsMap(): Promise<Record<string, string>> {
    const configs = await this.repo.find({ where: { isActive: true } });
    return configs.reduce((acc, c) => ({ ...acc, [c.configKey]: c.configValue }), {} as Record<string, string>);
  }
}
