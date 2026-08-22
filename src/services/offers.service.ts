import { OfferRepository } from '../repositories/offer.repository';
import { AuditLogRepository } from '../repositories/auditLog.repository';
import { Offer, OfferStatus } from '../entities/Offer';
import { OfferAssignment } from '../entities/OfferAssignment';
import { AppNotification } from '../entities/AppNotification';
import { Suite } from '../entities/Suite';
import { AppDataSource } from '../data-source';

const offerRepo = new OfferRepository();
const auditRepo = new AuditLogRepository();

export const createOffer = async (data: any, userId: number, ip?: string) => {
  const { assignedUserIds, ...offerData } = data;

  // If suiteId is provided and suiteName is not set, look up suiteName
  if (offerData.suiteId && !offerData.suiteName) {
    try {
      const suite = await AppDataSource.getRepository(Suite).findOneBy({ id: Number(offerData.suiteId) });
      if (suite) {
        offerData.suiteName = suite.name;
      }
    } catch (e) {
      console.warn('Could not resolve suite name for special offer:', e);
    }
  }

  const offer = await offerRepo.create({ ...offerData, createdBy: userId });

  // Handle user assignments if provided
  if (Array.isArray(assignedUserIds) && assignedUserIds.length > 0) {
    const assignmentRepo = AppDataSource.getRepository(OfferAssignment);
    const notifRepo = AppDataSource.getRepository(AppNotification);

    for (const rawUid of assignedUserIds) {
      const uid = Number(rawUid);
      if (!uid || isNaN(uid)) continue;

      const assignment = assignmentRepo.create({
        offerId: offer.id,
        userId: uid,
        status: 'assigned',
      });
      await assignmentRepo.save(assignment);

      // Create in-app notification for the assigned user
      try {
        const notif = notifRepo.create({
          userId: uid,
          title: 'Special Offer Available!',
          message: `You've received a special ${offer.discountValue}% discount offer on ${offer.suiteName || 'your next suite booking'}! Valid until ${new Date(offer.endDate).toLocaleDateString('en-IN')}.`,
          type: 'general',
          isRead: false,
        });
        await notifRepo.save(notif);
      } catch (err) {
        console.warn('Failed to send notification for special offer assignment:', err);
      }
    }
  }

  await auditRepo.log({ entityType: 'Offer', entityId: offer.id, action: 'CREATE', performedBy: userId, newData: offer, ipAddress: ip });
  
  // Return offer with assignments
  return getOfferById(offer.id);
};

export const getOffers = (params: { search?: string; status?: OfferStatus; page?: number; limit?: number }) =>
  offerRepo.search(params);

export const getOfferById = async (id: number) => {
  const offer = await offerRepo.getRepo().findOne({
    where: { id },
    relations: ['assignments', 'assignments.user'],
  });
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

export const getActiveOffers = async () => {
  try {
    const allActive = await offerRepo.getRepo().find({
      where: { status: 'active' },
      relations: ['assignments'],
    });
    // Public offers only: offers that don't have targeted user assignments
    return allActive.filter((o) => !o.assignments || o.assignments.length === 0);
  } catch (err: any) {
    console.error('Error fetching active offers:', err);
    return [];
  }
};

export const getUserSpecialOffers = async (userId: number) => {
  try {
    const assignmentRepo = AppDataSource.getRepository(OfferAssignment);
    const assignments = await assignmentRepo.find({
      where: {
        userId: Number(userId),
        status: 'assigned',
      },
      relations: ['offer'],
    });

    const activeOffers: Offer[] = [];
    for (const a of assignments) {
      const o = a.offer;
      if (!o || o.deletedAt) continue;
      const status = (o.status || '').toLowerCase();
      if (status !== 'active') continue;
      activeOffers.push(o);
    }
    return activeOffers;
  } catch (err: any) {
    console.error('Error fetching user special offers:', err);
    return [];
  }
};

export const redeemSpecialOffer = async (offerId: number, userId: number, bookingId?: number) => {
  const assignmentRepo = AppDataSource.getRepository(OfferAssignment);
  const assignment = await assignmentRepo.findOne({
    where: {
      offerId,
      userId,
      status: 'assigned',
    },
  });

  if (assignment) {
    assignment.status = 'redeemed';
    assignment.bookingId = bookingId;
    assignment.redeemedAt = new Date();
    await assignmentRepo.save(assignment);

    await offerRepo.incrementUsage(offerId);
    console.log(`Special offer ${offerId} successfully redeemed for user ${userId} on booking ${bookingId}`);
    return true;
  }
  return false;
};

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

