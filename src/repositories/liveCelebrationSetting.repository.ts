import { LiveCelebrationSetting } from '../entities/LiveCelebrationSetting';
import { BaseRepository } from './base.repository';

export class LiveCelebrationSettingRepository extends BaseRepository<LiveCelebrationSetting> {
  constructor() { super(LiveCelebrationSetting); }

  async findByKey(key: string): Promise<LiveCelebrationSetting | null> {
    return this.repo.findOne({ where: { settingKey: key, isActive: true } });
  }

  async findByGroup(group: string): Promise<LiveCelebrationSetting[]> {
    return this.repo.find({ where: { group, isActive: true } });
  }

  async getAllAsMap(): Promise<Record<string, string>> {
    const settings = await this.repo.find({ where: { isActive: true } });
    return settings.reduce((acc, s) => ({ ...acc, [s.settingKey]: s.settingValue }), {} as Record<string, string>);
  }
}
