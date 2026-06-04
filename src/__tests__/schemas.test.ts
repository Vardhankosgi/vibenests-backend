import { registerSchema, loginSchema, bookingCreateSchema } from '../validation/schemas';

describe('validation schemas', () => {
  test('registerSchema - valid', () => {
    const data = { fullName: 'Alice', email: 'alice@example.com', password: 'secret123' };
    expect(() => registerSchema.parse(data)).not.toThrow();
  });

  test('registerSchema - invalid email', () => {
    const data = { fullName: 'Bob', email: 'not-an-email', password: 'secret123' };
    expect(() => registerSchema.parse(data)).toThrow();
  });

  test('loginSchema - valid', () => {
    const data = { email: 'a@b.com', password: 'secret123' };
    expect(() => loginSchema.parse(data)).not.toThrow();
  });

  test('bookingCreateSchema - valid', () => {
    const data = { suiteId: 1, date: '2026-06-10', timeSlot: '18:00-22:00' };
    expect(() => bookingCreateSchema.parse(data)).not.toThrow();
  });

  test('bookingCreateSchema - invalid suiteId', () => {
    const data = { suiteId: -5, date: '2026-06-10', timeSlot: '18:00-22:00' };
    expect(() => bookingCreateSchema.parse(data)).toThrow();
  });
});
