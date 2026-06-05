import { OfferConfigurationRepository } from '../repositories/offerConfiguration.repository';
import { AuditLogRepository } from '../repositories/auditLog.repository';
import { OfferConfiguration } from '../entities/OfferConfiguration';

const configRepo = new OfferConfigurationRepository();
const auditRepo = new AuditLogRepository();

export const upsertConfig = async (data: Partial<OfferConfiguration>, userId: number, ip?: string) => {
  if (!data.configKey) throw new Error('configKey is required');
  const existing = await configRepo.findByKey(data.configKey);
  if (existing) {
    const updated = await configRepo.update(existing.id, { ...data, updatedBy: userId });
    await auditRepo.log({ entityType: 'OfferConfiguration', entityId: existing.id, action: 'UPDATE', performedBy: userId, previousData: existing, newData: updated!, ipAddress: ip });
    return updated;
  }
  const config = await configRepo.create({ ...data, updatedBy: userId });
  await auditRepo.log({ entityType: 'OfferConfiguration', entityId: config.id, action: 'CREATE', performedBy: userId, newData: config, ipAddress: ip });
  return config;
};

export const getConfigs = (params: { page?: number; limit?: number }) =>
  configRepo.findAll({ page: params.page, limit: params.limit });

export const getConfigsMap = () => configRepo.getAllAsMap();
