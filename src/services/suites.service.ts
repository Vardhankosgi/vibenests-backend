import { AppDataSource } from '../data-source';
import { Suite } from '../entities/Suite';
import { SuiteAvailability } from '../entities/SuiteAvailability';

const suiteRepo = () => AppDataSource.getRepository(Suite);
const availabilityRepo = () => AppDataSource.getRepository(SuiteAvailability);

function parseImages(images: any): string[] {
  if (Array.isArray(images)) return images;
  try { return JSON.parse(images); } catch { return []; }
}

export const createSuite = async (payload: Partial<Suite>) => {
  const data = { ...payload, images: JSON.stringify(payload.images ?? []) } as any;
  const suite = suiteRepo().create(data);
  const saved = await suiteRepo().save(suite);
  saved.images = parseImages(saved.images);
  return saved;
};

export const findSuites = async () => {
  const suites = await suiteRepo().find();
  return suites.map(s => ({ ...s, images: parseImages(s.images) }));
};

export const findSuiteById = async (id: number) => {
  const suite = await suiteRepo().findOne({ where: { id } });
  if (suite) suite.images = parseImages(suite.images);
  return suite;
};

export const updateSuite = async (id: number, payload: Partial<Suite>) => {
  const suite = await suiteRepo().findOneBy({ id });
  if (!suite) throw new Error('Suite not found');
  const data = { ...payload, images: JSON.stringify(payload.images ?? parseImages(suite.images)) } as any;
  suiteRepo().merge(suite, data);
  const saved = await suiteRepo().save(suite);
  saved.images = parseImages(saved.images);
  return saved;
};

export const deleteSuite = async (id: number) => {
  const suite = await suiteRepo().findOneBy({ id });
  if (!suite) throw new Error('Suite not found');
  return suiteRepo().remove(suite);
};

export const addAvailabilitySlot = async (suiteId: number, date: string, timeSlot: string, note?: string) => {
  const entry = availabilityRepo().create({ suite: { id: suiteId } as any, suiteId, date, timeSlot, status: 'blocked', note });
  return availabilityRepo().save(entry);
};

export const removeAvailabilitySlot = async (id: number) => {
  const entry = await availabilityRepo().findOneBy({ id });
  if (!entry) throw new Error('Availability entry not found');
  return availabilityRepo().remove(entry);
};

export const getAvailabilityForSuite = async (suiteId: number) => availabilityRepo().find({ where: { suiteId } });

export const findAvailableSuites = async (date?: string, timeSlot?: string) => {
  const qb = suiteRepo().createQueryBuilder('suite');
  if (date && timeSlot) {
    qb.leftJoinAndSelect('suite.availability', 'availability')
      .andWhere('(availability.date != :date OR availability.timeSlot != :timeSlot OR availability.status = :status)', {
        date,
        timeSlot,
        status: 'available',
      });
  }
  return qb.getMany();
};
