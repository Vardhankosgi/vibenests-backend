import { BookingRuleRepository } from '../repositories/bookingRule.repository';
import { AuditLogRepository } from '../repositories/auditLog.repository';
import { BookingRule } from '../entities/BookingRule';

const ruleRepo = new BookingRuleRepository();
const auditRepo = new AuditLogRepository();

export const upsertBookingRule = async (data: Partial<BookingRule>, userId: number, ip?: string) => {
  if (!data.ruleKey) throw new Error('ruleKey is required');
  const existing = await ruleRepo.findByKey(data.ruleKey);
  if (existing) {
    const updated = await ruleRepo.update(existing.id, { ...data, updatedBy: userId });
    await auditRepo.log({ entityType: 'BookingRule', entityId: existing.id, action: 'UPDATE', performedBy: userId, previousData: existing, newData: updated!, ipAddress: ip });
    return updated;
  }
  const rule = await ruleRepo.create({ ...data, updatedBy: userId });
  await auditRepo.log({ entityType: 'BookingRule', entityId: rule.id, action: 'CREATE', performedBy: userId, newData: rule, ipAddress: ip });
  return rule;
};

export const getBookingRules = (params: { group?: string; page?: number; limit?: number }) =>
  ruleRepo.findAll({ where: params.group ? { group: params.group } as any : undefined, page: params.page, limit: params.limit });

export const getBookingRulesMap = () => ruleRepo.getAllAsMap();

export const deleteBookingRule = async (id: number, userId: number, ip?: string) => {
  const rule = await ruleRepo.findById(id);
  if (!rule) throw new Error('Booking rule not found');
  await ruleRepo.hardDelete(id);
  await auditRepo.log({ entityType: 'BookingRule', entityId: id, action: 'DELETE', performedBy: userId, ipAddress: ip });
};
