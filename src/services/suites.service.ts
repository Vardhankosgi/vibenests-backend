import { AppDataSource } from '../data-source';
import { Suite } from '../entities/Suite';
import { SuiteAvailability } from '../entities/SuiteAvailability';

const suiteRepo = () => AppDataSource.getRepository(Suite);
const availabilityRepo = () => AppDataSource.getRepository(SuiteAvailability);

export const createSuite = async (payload: Partial<Suite>) => {
  const suite = suiteRepo().create(payload);
  return suiteRepo().save(suite);
};

export const findSuites = async () => suiteRepo().find();

export const findSuiteById = async (id: number) => suiteRepo().findOne({ where: { id } });

export const updateSuite = async (id: number, payload: Partial<Suite>) => {
  const suite = await suiteRepo().findOneBy({ id });
  if (!suite) throw new Error('Suite not found');
  suiteRepo().merge(suite, payload);
  return suiteRepo().save(suite);
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
