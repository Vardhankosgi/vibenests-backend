import { createBooking } from '../services/bookings.service';
import { AppDataSource } from '../data-source';

describe('bookings.service', () => {
  const mockRepo: any = {};

  beforeEach(() => {
    jest.restoreAllMocks();
    mockRepo.findOneBy = jest.fn();
    mockRepo.create = jest.fn((x: any) => x);
    mockRepo.save = jest.fn(async (x: any) => ({ id: 10, ...x }));
    jest.spyOn(AppDataSource, 'getRepository').mockReturnValue(mockRepo as any);
  });

  test('createBooking throws if slot already confirmed', async () => {
    mockRepo.findOneBy.mockResolvedValue({ id: 5 });
    await expect(
      createBooking({ userId: 1, suiteId: 1, eventType: 'Birthday', date: '2026-06-10', timeSlot: '18:00-22:00' })
    ).rejects.toThrow('Slot already booked');
  });

  test('createBooking saves booking when slot free', async () => {
    mockRepo.findOneBy.mockResolvedValue(null);
    const res = (await createBooking({ userId: 1, suiteId: 1, eventType: 'Birthday', date: '2026-06-10', timeSlot: '18:00-22:00' })) as any;
    expect(res.id).toBe(10);
    expect(mockRepo.save).toHaveBeenCalled();
  });
});
