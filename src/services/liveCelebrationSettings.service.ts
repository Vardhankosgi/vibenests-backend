import { LiveCelebrationSettingRepository } from '../repositories/liveCelebrationSetting.repository';
import { AuditLogRepository } from '../repositories/auditLog.repository';
import { LiveCelebrationSetting } from '../entities/LiveCelebrationSetting';

const settingRepo = new LiveCelebrationSettingRepository();
const auditRepo = new AuditLogRepository();

export const upsertSetting = async (data: Partial<LiveCelebrationSetting>, userId: number, ip?: string) => {
  if (!data.settingKey) throw new Error('settingKey is required');
  const existing = await settingRepo.findByKey(data.settingKey);
  if (existing) {
    const updated = await settingRepo.update(existing.id, { ...data, updatedBy: userId });
    await auditRepo.log({ entityType: 'LiveCelebrationSetting', entityId: existing.id, action: 'UPDATE', performedBy: userId, previousData: existing, newData: updated!, ipAddress: ip });
    return updated;
  }
  const setting = await settingRepo.create({ ...data, updatedBy: userId });
  await auditRepo.log({ entityType: 'LiveCelebrationSetting', entityId: setting.id, action: 'CREATE', performedBy: userId, newData: setting, ipAddress: ip });
  return setting;
};

export const getSettings = (params: { group?: string; page?: number; limit?: number }) =>
  settingRepo.findAll({ where: params.group ? { group: params.group } as any : undefined, page: params.page, limit: params.limit });

export const getSettingsMap = () => settingRepo.getAllAsMap();

export const deleteSetting = async (id: number, userId: number, ip?: string) => {
  const setting = await settingRepo.findById(id);
  if (!setting) throw new Error('Setting not found');
  await settingRepo.hardDelete(id);
  await auditRepo.log({ entityType: 'LiveCelebrationSetting', entityId: id, action: 'DELETE', performedBy: userId, ipAddress: ip });
};
