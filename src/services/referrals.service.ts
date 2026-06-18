import { AppDataSource } from '../data-source';
import { User } from '../entities/User';
import { Coupon } from '../entities/Coupon';
import { ReferralCode } from '../entities/ReferralCode';
import { ReferralRelationship } from '../entities/ReferralRelationship';
import { ReferralReward } from '../entities/ReferralReward';
import { ReferralTransaction } from '../entities/ReferralTransaction';
import { OfferConfiguration } from '../entities/OfferConfiguration';
import { Repository } from 'typeorm';

const userRepo = () => AppDataSource.getRepository(User);
const couponRepo = () => AppDataSource.getRepository(Coupon);
const refCodeRepo = () => AppDataSource.getRepository(ReferralCode);
const refRelationshipRepo = () => AppDataSource.getRepository(ReferralRelationship);
const refRewardRepo = () => AppDataSource.getRepository(ReferralReward);
const refTransactionRepo = () => AppDataSource.getRepository(ReferralTransaction);
const configRepo = () => AppDataSource.getRepository(OfferConfiguration);

// Generate unique referral code: VN-XXXXXX
export async function generateUniqueReferralCode(): Promise<string> {
  const repo = userRepo();
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let attempts = 0;
  while (attempts < 100) {
    let code = 'VN-';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const exists = await repo.findOneBy({ referralCode: code });
    if (!exists) {
      return code;
    }
    attempts++;
  }
  return 'VN-' + Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Validate a referral code during signup
export async function validateReferralCode(code: string, refereeUserId?: number): Promise<{ valid: boolean; referrer?: User; message?: string }> {
  const systemEnabledConfig = await configRepo().findOneBy({ configKey: 'REFERRAL_SYSTEM_ENABLED', isActive: true });
  const systemEnabled = systemEnabledConfig ? systemEnabledConfig.configValue === 'true' : true;
  if (!systemEnabled) {
    return { valid: false, message: 'Referral program is currently disabled' };
  }

  if (!code || typeof code !== 'string') {
    return { valid: false, message: 'Invalid code format' };
  }
  const codeClean = code.trim().toUpperCase();
  const referrer = await userRepo().findOneBy({ referralCode: codeClean });
  if (!referrer) {
    return { valid: false, message: 'Referral code not found' };
  }

  if (refereeUserId) {
    if (referrer.id === refereeUserId) {
      return { valid: false, message: 'Self-referrals are not allowed' };
    }
    // Check duplicate referrals
    const alreadyReferred = await refRelationshipRepo().findOneBy({ refereeId: refereeUserId });
    if (alreadyReferred) {
      return { valid: false, message: 'You have already been referred by another user' };
    }
  }

  return { valid: true, referrer, message: 'Valid referral code' };
}

// Create referral relationship
export async function createReferralRelationship(referrerCode: string, refereeUser: User): Promise<ReferralRelationship> {
  const validation = await validateReferralCode(referrerCode, refereeUser.id);
  if (!validation.valid || !validation.referrer) {
    throw new Error(validation.message || 'Invalid referral code');
  }

  const relationship = refRelationshipRepo().create({
    referrerId: validation.referrer.id,
    refereeId: refereeUser.id,
    referralCode: referrerCode.trim().toUpperCase(),
    status: 'pending',
  });

  const saved = await refRelationshipRepo().save(relationship);

  // Log transaction
  const transaction = refTransactionRepo().create({
    referralId: saved.id,
    type: 'registration',
    description: `Referee ${refereeUser.fullName} (${refereeUser.email}) registered using referral code of ${validation.referrer.fullName}.`,
  });
  await refTransactionRepo().save(transaction);

  return saved;
}

// Process qualifying action (like a first payment/booking)
export async function processReferralQualifyingAction(userId: number, actionType: string, bookingId: number): Promise<void> {
  // Check if this user (referee) has a pending referral relationship
  const relationship = await refRelationshipRepo().findOne({
    where: { refereeId: userId, status: 'pending' },
  });

  if (!relationship) {
    return; // User was not referred or relationship is already success/revoked
  }

  // Update status to successful
  relationship.status = 'successful';
  relationship.completedAt = new Date();
  await refRelationshipRepo().save(relationship);

  // Log transaction
  const transaction = refTransactionRepo().create({
    referralId: relationship.id,
    type: 'qualifying_booking',
    description: `Qualifying action completed: user finished booking ID ${bookingId} (${actionType}).`,
  });
  await refTransactionRepo().save(transaction);

  // Issue reward to referrer
  await issueReferrerReward(relationship);
}

// Issue reward to the referrer
export async function issueReferrerReward(relationship: ReferralRelationship): Promise<ReferralReward> {
  // Load reward configurations
  const rewardTypeConfig = await configRepo().findOneBy({ configKey: 'REFERRAL_REWARD_TYPE', isActive: true });
  const rewardValueConfig = await configRepo().findOneBy({ configKey: 'REFERRAL_REWARD_VALUE', isActive: true });
  const expiryDaysConfig = await configRepo().findOneBy({ configKey: 'REFERRAL_COUPON_EXPIRY_DAYS', isActive: true });

  const rewardType = (rewardTypeConfig?.configValue || 'flat') as 'percentage' | 'flat';
  const rewardValue = Number(rewardValueConfig?.configValue || '500');
  const expiryDays = Number(expiryDaysConfig?.configValue || '90');

  // Generate unique coupon code for the referrer: VNREF-XXXXX
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let couponCode = '';
  let isUnique = false;
  while (!isUnique) {
    couponCode = 'VNREF-';
    for (let i = 0; i < 5; i++) {
      couponCode += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const exists = await couponRepo().findOneBy({ code: couponCode });
    if (!exists) {
      isUnique = true;
    }
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiryDays);

  const referrer = await userRepo().findOneBy({ id: relationship.referrerId });
  const referee = await userRepo().findOneBy({ id: relationship.refereeId });

  // Create personalized discount coupon
  const coupon = couponRepo().create({
    code: couponCode,
    description: `Referral Reward Coupon earned for inviting ${referee?.fullName || 'a friend'}.`,
    discountType: rewardType,
    discountValue: rewardValue,
    minBookingAmount: 1000, // standard min booking
    expiresAt,
    usageLimit: 1,
    usedCount: 0,
    usageLimitPerUser: 1,
    status: 'active',
    assignedToUserId: relationship.referrerId,
  });

  const savedCoupon = await couponRepo().save(coupon);

  // Create reward entry
  const reward = refRewardRepo().create({
    referralId: relationship.id,
    recipientId: relationship.referrerId,
    rewardType: 'discount_coupon',
    rewardValue,
    couponId: savedCoupon.id,
    status: 'issued',
  });

  const savedReward = await refRewardRepo().save(reward);

  // Log transaction
  const txn = refTransactionRepo().create({
    referralId: relationship.id,
    type: 'reward_issued',
    description: `Referral reward coupon ${couponCode} (value: ₹${rewardValue}) issued to referrer ${referrer?.fullName || 'User'}.`,
  });
  await refTransactionRepo().save(txn);

  return savedReward;
}

// Get referral statistics for a user
export async function getReferralStats(userId: number) {
  const user = await userRepo().findOneBy({ id: userId });
  if (!user) throw new Error('User not found');

  // Ensure user has a referral code
  let code = user.referralCode;
  if (!code) {
    code = await generateUniqueReferralCode();
    user.referralCode = code;
    await userRepo().save(user);

    // Also register in referral_codes table
    const refCode = refCodeRepo().create({ code, userId: user.id, isActive: true });
    await refCodeRepo().save(refCode);
  }

  const relationships = await refRelationshipRepo().find({
    where: { referrerId: userId },
    relations: ['referee'],
  });

  const rewards = await refRewardRepo().find({
    where: { recipientId: userId },
    relations: ['coupon'],
    order: { createdAt: 'DESC' },
  });

  const totalReferrals = relationships.length;
  const pendingReferrals = relationships.filter((r) => r.status === 'pending').length;
  const successfulReferrals = relationships.filter((r) => r.status === 'successful').length;

  // Calculate earnings
  let earnedRewards = 0;
  let redeemedRewards = 0;

  rewards.forEach((r) => {
    const val = Number(r.rewardValue) || 0;
    if (r.status === 'issued' || r.status === 'redeemed') {
      earnedRewards += val;
    }
    if (r.status === 'redeemed' || (r.coupon && r.coupon.usedCount > 0)) {
      redeemedRewards += val;
    }
  });

  const systemEnabledConfig = await configRepo().findOneBy({ configKey: 'REFERRAL_SYSTEM_ENABLED', isActive: true });
  const systemEnabled = systemEnabledConfig ? systemEnabledConfig.configValue === 'true' : true;

  return {
    systemEnabled,
    referralCode: code,
    totalReferrals,
    pendingReferrals,
    successfulReferrals,
    earnedRewards,
    redeemedRewards,
    rewards: rewards.map((r) => ({
      id: r.id,
      refereeName: relationships.find((rel) => rel.id === r.referralId)?.referee?.fullName || 'Referred Friend',
      refereeEmail: relationships.find((rel) => rel.id === r.referralId)?.referee?.email || '',
      rewardType: r.rewardType,
      rewardValue: r.rewardValue,
      couponCode: r.coupon?.code || 'N/A',
      status: r.coupon && r.coupon.usedCount > 0 ? 'redeemed' : r.status,
      expiresAt: r.coupon?.expiresAt || null,
      createdAt: r.createdAt,
    })),
  };
}

// Get all referrals for admin view
export async function adminGetReferrals(params: { page: number; limit: number }) {
  const page = params.page || 1;
  const limit = params.limit || 20;

  const [data, total] = await refRelationshipRepo().findAndCount({
    relations: ['referrer', 'referee'],
    order: { createdAt: 'DESC' },
    skip: (page - 1) * limit,
    take: limit,
  });

  const rewards = await refRewardRepo().find({
    relations: ['coupon'],
  });

  const mapped = data.map((rel) => {
    const reward = rewards.find((r) => r.referralId === rel.id);
    return {
      id: rel.id,
      referrer: {
        id: rel.referrer?.id,
        fullName: rel.referrer?.fullName,
        email: rel.referrer?.email,
      },
      referee: {
        id: rel.referee?.id,
        fullName: rel.referee?.fullName,
        email: rel.referee?.email,
      },
      code: rel.referralCode,
      status: rel.status,
      createdAt: rel.createdAt,
      completedAt: rel.completedAt,
      reward: reward ? {
        id: reward.id,
        value: reward.rewardValue,
        couponCode: reward.coupon?.code || 'N/A',
        status: reward.coupon && reward.coupon.usedCount > 0 ? 'redeemed' : reward.status,
      } : null,
    };
  });

  return { data: mapped, total };
}

// Admin manual approve reward override
export async function adminApproveReward(rewardId: number): Promise<ReferralReward> {
  const reward = await refRewardRepo().findOne({
    where: { id: rewardId },
    relations: ['referral', 'coupon'],
  });

  if (!reward) throw new Error('Reward not found');
  if (reward.status === 'redeemed') throw new Error('Reward already redeemed');

  reward.status = 'issued';
  if (reward.coupon) {
    reward.coupon.status = 'active';
    await couponRepo().save(reward.coupon);
  }

  // Update referral relationship if pending
  if (reward.referral && reward.referral.status === 'pending') {
    reward.referral.status = 'successful';
    reward.referral.completedAt = new Date();
    await refRelationshipRepo().save(reward.referral);
  }

  const saved = await refRewardRepo().save(reward);

  // Log transaction
  const txn = refTransactionRepo().create({
    referralId: reward.referralId,
    type: 'reward_issued',
    description: `Manual administrative approval of reward ID ${rewardId} and coupon code ${reward.coupon?.code || 'N/A'}.`,
  });
  await refTransactionRepo().save(txn);

  return saved;
}

// Admin manual revoke reward override
export async function adminRevokeReward(rewardId: number): Promise<ReferralReward> {
  const reward = await refRewardRepo().findOne({
    where: { id: rewardId },
    relations: ['referral', 'coupon'],
  });

  if (!reward) throw new Error('Reward not found');
  if (reward.status === 'redeemed') throw new Error('Cannot revoke a redeemed reward');

  reward.status = 'revoked';
  if (reward.coupon) {
    reward.coupon.status = 'inactive';
    await couponRepo().save(reward.coupon);
  }

  if (reward.referral) {
    reward.referral.status = 'revoked';
    await refRelationshipRepo().save(reward.referral);
  }

  const saved = await refRewardRepo().save(reward);

  // Log transaction
  const txn = refTransactionRepo().create({
    referralId: reward.referralId,
    type: 'reward_revoked',
    description: `Manual administrative revocation of reward ID ${rewardId} and deactivate coupon code ${reward.coupon?.code || 'N/A'}.`,
  });
  await refTransactionRepo().save(txn);

  return saved;
}

// Startup seeding to backfill unique referral codes for legacy users who do not have one
export async function seedLegacyUsersReferralCodes(): Promise<void> {
  const repo = userRepo();
  const legacyUsers = await repo.find({ where: { referralCode: undefined } }); // TypeORM maps null to undefined here depending on config, but to be sure:
  const usersWithNull = await repo.createQueryBuilder('user')
    .where('user.referralCode IS NULL')
    .getMany();

  const allToSeed = [...legacyUsers, ...usersWithNull].filter((value, index, self) =>
    self.findIndex(t => t.id === value.id) === index
  );

  if (allToSeed.length > 0) {
    console.log(`Backfilling referral codes for ${allToSeed.length} legacy users...`);
    for (const u of allToSeed) {
      try {
        const code = await generateUniqueReferralCode();
        u.referralCode = code;
        await repo.save(u);

        // Also save to referral_codes table
        const refCode = refCodeRepo().create({ code, userId: u.id, isActive: true });
        await refCodeRepo().save(refCode);
      } catch (err: any) {
        console.error(`Failed to seed referral code for user ${u.id}:`, err?.message);
      }
    }
    console.log('Finished backfilling referral codes.');
  }

  // Also seed default offer configurations for referral values if they do not exist
  const seedConfigs = [
    { key: 'REFERRAL_REWARD_TYPE', value: 'flat', label: 'Referral Reward Type', desc: 'Type of coupon reward: flat or percentage' },
    { key: 'REFERRAL_REWARD_VALUE', value: '500', label: 'Referral Reward Value', desc: 'Discount value of referral coupons' },
    { key: 'REFERRAL_COUPON_EXPIRY_DAYS', value: '90', label: 'Referral Coupon Expiration Days', desc: 'Days referral coupons remain active' },
    { key: 'REFERRAL_SYSTEM_ENABLED', value: 'true', label: 'Referral Program Enabled', desc: 'Enable or disable the referral system program-wide' }
  ];

  for (const c of seedConfigs) {
    const exists = await configRepo().findOneBy({ configKey: c.key });
    if (!exists) {
      const config = configRepo().create({
        configKey: c.key,
        configValue: c.value,
        valueType: 'string',
        label: c.label,
        description: c.desc,
        isActive: true,
      });
      await configRepo().save(config);
      console.log(`Seeded referral config: ${c.key} = ${c.value}`);
    }
  }
}
