import { AppDataSource } from '../data-source';
import { AddOn } from '../entities/AddOn';

const repo = () => AppDataSource.getRepository(AddOn);

export const createAddOn = async (payload: Partial<AddOn>) => {
  const addon = repo().create(payload);
  return repo().save(addon);
};

export const findAddOns = async () => repo().find({ where: { status: 'active' } });

export const findAllAddOns = async () => repo().find();

export const findAddOnById = async (id: number) => repo().findOneBy({ id });

export const updateAddOn = async (id: number, payload: Partial<AddOn>) => {
  const addon = await repo().findOneBy({ id });
  if (!addon) throw new Error('Add-on not found');
  repo().merge(addon, payload);
  return repo().save(addon);
};

export const deleteAddOn = async (id: number) => {
  const addon = await repo().findOneBy({ id });
  if (!addon) throw new Error('Add-on not found');
  return repo().remove(addon);
};
