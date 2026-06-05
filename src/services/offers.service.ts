import { OfferRepository } from '../repositories/offer.repository';
import { AuditLogRepository } from '../repositories/auditLog.repository';
import { Offer, OfferStatus } from '../entities/Offer';

const offerRepo = new OfferRepository();
const auditRepo = new AuditLogRepository();

export const createOffer = async (data: Partial<Offer>, userId: number, ip?: string) => {
  const offer = await offerRepo.create({ ...data, createdBy: userId });
  await auditRepo.log({ entityType: 'Offer', entityId: offer.id, action: 'CREATE', performedBy: userId, newData: offer, ipAddress: ip });
  return offer;
};

export const getOffers = (params: { search?: string; status?: OfferStatus; page?: number; limit?: number }) =>
  offerRepo.search(params);

export const getOfferById = async (id: number) => {
  const offer = await offerRepo.findById(id);
  if (!offer) throw new Error('Offer not found');
  return offer;
};

export const updateOffer = async (id: number, data: Partial<Offer>, userId: number, ip?: string) => {
  const prev = await getOfferById(id);
  const updated = await offerRepo.update(id, data);
  await auditRepo.log({ entityType: 'Offer', entityId: id, action: 'UPDATE', performedBy: userId, previousData: prev, newData: updated!, ipAddress: ip });
  return updated;
};

export const deleteOffer = async (id: number, userId: number, ip?: string) => {
  await getOfferById(id);
  await offerRepo.softDelete(id);
  await auditRepo.log({ entityType: 'Offer', entityId: id, action: 'DELETE', performedBy: userId, ipAddress: ip });
};

export const getActiveOffers = () => offerRepo.findActiveOffers();

export const expireStaleOffers = async () => {
  const now = new Date();
  const result = await offerRepo.getRepo()
    .createQueryBuilder()
    .update(Offer)
    .set({ status: 'expired' })
    .where('endDate < :now', { now })
    .andWhere('status != :expired', { expired: 'expired' })
    .andWhere('deletedAt IS NULL')
    .execute();
  return result.affected || 0;
};

export const activateScheduledOffers = async () => {
  const now = new Date();
  const result = await offerRepo.getRepo()
    .createQueryBuilder()
    .update(Offer)
    .set({ status: 'active' })
    .where('startDate <= :now', { now })
    .andWhere('endDate >= :now', { now })
    .andWhere('status = :scheduled', { scheduled: 'scheduled' })
    .andWhere('deletedAt IS NULL')
    .execute();
  return result.affected || 0;
};
