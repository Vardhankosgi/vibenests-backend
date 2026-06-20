import { createBooking } from '../services/bookings.service';
import { AppDataSource } from '../data-source';

describe('bookings.service', () => {
  const mockRepo: any = {};

  beforeEach(() => {
    jest.restoreAllMocks();
    mockRepo.findOneBy = jest.fn();
    mockRepo.findOne = jest.fn(async (opt: any) => {
      if (opt?.where?.id) return { id: opt.where.id };
      return null;
    });
    mockRepo.create = jest.fn((x: any) => x);
    mockRepo.save = jest.fn(async (x: any) => ({ id: 10, ...x }));
    jest.spyOn(AppDataSource, 'getRepository').mockReturnValue(mockRepo as any);
  });

  test('createBooking throws if slot already confirmed', async () => {
    mockRepo.findOne.mockImplementation(async (opt: any) => {
      if (opt?.where?.id) return { id: opt.where.id };
      return { id: 5 }; // simulate existing booking
    });
    const bookingPayload = {
      userId: 1,
      suiteId: 1,
      eventType: 'Birthday',
      date: '2023-10-10',
      timeSlots: ['10:00 - 14:00'],
    };
    await expect(
      createBooking(bookingPayload)
    ).rejects.toThrow('Slot already booked');
  });

  test('createBooking saves booking when slot free', async () => {
    // findOne defaults to returning null for availability checks
    const res = (await createBooking({ userId: 1, suiteId: 1, eventType: 'Birthday', date: '2026-06-10', timeSlots: ['18:00-22:00'] })) as any;
    expect(res.id).toBe(10);
    expect(mockRepo.save).toHaveBeenCalled();
  });
});
