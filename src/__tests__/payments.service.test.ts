process.env.RAZORPAY_KEY_ID = 'test_key_id';
process.env.RAZORPAY_KEY_SECRET = 'test_key_secret';

import { createPaymentIntent, verifyPayment } from '../services/payments.service';
import { AppDataSource } from '../data-source';

jest.mock('../services/notifications.service', () => ({
  sendEmail: jest.fn().mockResolvedValue({ ok: true })
}));

jest.mock('razorpay', () => {
  return jest.fn().mockImplementation(() => {
    return {
      orders: {
        create: jest.fn().mockResolvedValue({ id: 'order_123' })
      }
    };
  });
});

describe('payments.service', () => {
  const mockRepo: any = {};

  beforeEach(() => {
    jest.restoreAllMocks();
    mockRepo.create = jest.fn((x: any) => x);
    mockRepo.save = jest.fn(async (x: any) => ({ id: 20, ...x }));
    mockRepo.findOneBy = jest.fn(async (query: any) => ({ id: 20, bookingId: 2, status: 'pending' }));
    mockRepo.findOne = jest.fn(async (opts: any) => ({ id: 2, user: { email: 't@example.com' } }));
    mockRepo.find = jest.fn(async () => []);
    jest.spyOn(AppDataSource, 'getRepository').mockReturnValue(mockRepo as any);
  });

  test('createPaymentIntent creates payment record', async () => {
    const payment = await createPaymentIntent(2, 1500, 'razorpay');
    expect(payment.id).toBe(20);
    expect(mockRepo.save).toHaveBeenCalled();
  });

  test('verifyPayment updates status and returns payment', async () => {
    const payment = await verifyPayment(20, { status: 'success', providerPaymentId: 'pay_123' });
    expect(payment.status).toBe('success');
  });
});
