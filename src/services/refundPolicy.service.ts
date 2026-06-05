import { RefundPolicyRepository } from '../repositories/refundPolicy.repository';
import { AuditLogRepository } from '../repositories/auditLog.repository';
import { AppDataSource } from '../data-source';
import { RefundPolicy } from '../entities/RefundPolicy';
import { AddOnRefundRule } from '../entities/AddOnRefundRule';

const policyRepo = new RefundPolicyRepository();
const auditRepo = new AuditLogRepository();

export const createRefundPolicy = async (data: Partial<RefundPolicy>, userId: number, ip?: string) => {
  const policy = await AppDataSource.transaction(async (manager) => {
    if (data.isDefault) {
      await manager.update(RefundPolicy, { isDefault: true }, { isDefault: false });
    }
    const created = manager.create(RefundPolicy, { ...data, createdBy: userId });
    return manager.save(RefundPolicy, created);
  });
  await auditRepo.log({ entityType: 'RefundPolicy', entityId: policy.id, action: 'CREATE', performedBy: userId, newData: policy, ipAddress: ip });
  return policy;
};

export const getRefundPolicies = (params: { search?: string; isActive?: boolean; page?: number; limit?: number }) =>
  policyRepo.search(params);

export const getRefundPolicyById = async (id: number) => {
  const policy = await policyRepo.findById(id, ['addOnRules']);
  if (!policy) throw new Error('Refund policy not found');
  return policy;
};

export const updateRefundPolicy = async (id: number, data: Partial<RefundPolicy>, userId: number, ip?: string) => {
  const prev = await getRefundPolicyById(id);
  const updated = await AppDataSource.transaction(async (manager) => {
    if (data.isDefault) {
      await manager.update(RefundPolicy, { isDefault: true }, { isDefault: false });
    }
    await manager.update(RefundPolicy, id, data);
    return manager.findOne(RefundPolicy, { where: { id }, relations: ['addOnRules'] });
  });
  await auditRepo.log({ entityType: 'RefundPolicy', entityId: id, action: 'UPDATE', performedBy: userId, previousData: prev, newData: updated!, ipAddress: ip });
  return updated;
};

export const deleteRefundPolicy = async (id: number, userId: number, ip?: string) => {
  await getRefundPolicyById(id);
  await policyRepo.softDelete(id);
  await auditRepo.log({ entityType: 'RefundPolicy', entityId: id, action: 'DELETE', performedBy: userId, ipAddress: ip });
};

export const addAddOnRule = async (policyId: number, ruleData: Partial<AddOnRefundRule>, userId: number) => {
  await getRefundPolicyById(policyId);
  const ruleRepo = AppDataSource.getRepository(AddOnRefundRule);
  const rule = ruleRepo.create({ ...ruleData, refundPolicyId: policyId });
  const saved = await ruleRepo.save(rule);
  await auditRepo.log({ entityType: 'AddOnRefundRule', entityId: saved.id, action: 'CREATE', performedBy: userId, newData: saved });
  return saved;
};

export const updateAddOnRule = async (ruleId: number, data: Partial<AddOnRefundRule>, userId: number) => {
  const ruleRepo = AppDataSource.getRepository(AddOnRefundRule);
  await ruleRepo.update(ruleId, data);
  return ruleRepo.findOneBy({ id: ruleId });
};

export const deleteAddOnRule = async (ruleId: number, userId: number) => {
  const ruleRepo = AppDataSource.getRepository(AddOnRefundRule);
  await ruleRepo.delete(ruleId);
  await auditRepo.log({ entityType: 'AddOnRefundRule', entityId: ruleId, action: 'DELETE', performedBy: userId });
};
