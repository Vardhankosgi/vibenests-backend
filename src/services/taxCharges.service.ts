import { TaxChargeRepository } from '../repositories/taxCharge.repository';
import { AuditLogRepository } from '../repositories/auditLog.repository';
import { TaxCharge } from '../entities/TaxCharge';

const taxRepo = new TaxChargeRepository();
const auditRepo = new AuditLogRepository();

export const createTaxCharge = async (data: Partial<TaxCharge>, userId: number, ip?: string) => {
  const tax = await taxRepo.create({ ...data, createdBy: userId });
  await auditRepo.log({ entityType: 'TaxCharge', entityId: tax.id, action: 'CREATE', performedBy: userId, newData: tax, ipAddress: ip });
  return tax;
};

export const getTaxCharges = (params: { search?: string; isActive?: boolean; page?: number; limit?: number }) =>
  taxRepo.search(params);

export const getTaxChargeById = async (id: number) => {
  const tax = await taxRepo.findById(id);
  if (!tax) throw new Error('Tax charge not found');
  return tax;
};

export const updateTaxCharge = async (id: number, data: Partial<TaxCharge>, userId: number, ip?: string) => {
  const prev = await getTaxChargeById(id);
  const updated = await taxRepo.update(id, data);
  await auditRepo.log({ entityType: 'TaxCharge', entityId: id, action: 'UPDATE', performedBy: userId, previousData: prev, newData: updated!, ipAddress: ip });
  return updated;
};

export const deleteTaxCharge = async (id: number, userId: number, ip?: string) => {
  await getTaxChargeById(id);
  await taxRepo.softDelete(id);
  await auditRepo.log({ entityType: 'TaxCharge', entityId: id, action: 'DELETE', performedBy: userId, ipAddress: ip });
};

export const getActiveTaxes = () => taxRepo.findActive();

export const calculateTax = async (amount: number): Promise<{ breakdown: any[]; totalTax: number; finalAmount: number }> => {
  const taxes = await taxRepo.findActive();
  let totalTax = 0;
  const breakdown = taxes.map(t => {
    const taxAmount = t.taxType === 'percentage' ? (amount * Number(t.taxValue)) / 100 : Number(t.taxValue);
    totalTax += taxAmount;
    return { name: t.name, taxCode: t.taxCode, taxAmount: Math.round(taxAmount * 100) / 100 };
  });
  return { breakdown, totalTax: Math.round(totalTax * 100) / 100, finalAmount: Math.round((amount + totalTax) * 100) / 100 };
};
