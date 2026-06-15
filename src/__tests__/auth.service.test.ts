import { registerUser, loginUser } from '../services/auth.service';
import { AppDataSource } from '../data-source';
import bcrypt from 'bcrypt';

describe('auth.service', () => {
  const mockRepo: any = {};

  beforeEach(() => {
    jest.restoreAllMocks();
    mockRepo.findOneBy = jest.fn();
    mockRepo.create = jest.fn((x: any) => x);
    mockRepo.save = jest.fn(async (x: any) => ({ id: 1, ...x }));
    jest.spyOn(AppDataSource, 'getRepository').mockReturnValue(mockRepo as any);
  });

  test('registerUser creates user when not exists', async () => {
    mockRepo.findOneBy.mockResolvedValue(null);
    const user = await registerUser({ fullName: 'Test', email: 't@example.com', password: 'secret' });
    expect(user).toBeDefined();
    expect(mockRepo.save).toHaveBeenCalled();
  });

  test('loginUser returns tokens on valid credentials', async () => {
    const hashed = await bcrypt.hash('secret', 8);
    mockRepo.findOneBy.mockResolvedValue({ id: 2, email: 't@example.com', password: hashed, role: 'customer', isVerified: true });
    const data = await loginUser('t@example.com', 'secret');
    expect(data.accessToken).toBeDefined();
    expect(data.refreshToken).toBeDefined();
    expect(data.user.id).toBe(2);
  });
});
