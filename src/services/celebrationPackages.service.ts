import { AppDataSource } from '../data-source';
import { CelebrationPackage } from '../entities/CelebrationPackage';

const repo = () => AppDataSource.getRepository(CelebrationPackage);

export const createPackage = async (payload: Partial<CelebrationPackage>) => {
  const pkg = repo().create(payload);
  return repo().save(pkg);
};

export const findActivePackages = async () =>
  repo().find({ where: { status: 'Active' }, order: { booked: 'DESC' } });

export const findAllPackages = async () =>
  repo().find({ order: { createdAt: 'DESC' } });

export const findPackageById = async (id: number) =>
  repo().findOneBy({ id });

export const updatePackage = async (id: number, payload: Partial<CelebrationPackage>) => {
  const pkg = await repo().findOneBy({ id });
  if (!pkg) throw new Error('Package not found');
  repo().merge(pkg, payload);
  return repo().save(pkg);
};

export const deletePackage = async (id: number) => {
  const pkg = await repo().findOneBy({ id });
  if (!pkg) throw new Error('Package not found');
  return repo().remove(pkg);
};
