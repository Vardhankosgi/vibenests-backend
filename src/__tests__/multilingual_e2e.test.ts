const mockRepository = {
  find: jest.fn(),
  create: jest.fn((data) => data),
  save: jest.fn(),
  delete: jest.fn()
};

jest.mock('../data-source', () => ({
  AppDataSource: {
    getRepository: () => mockRepository
  }
}));

import { translationMiddleware, languageResolverMiddleware } from '../middleware/translation';
import { translatePayload } from '../services/translate.service';

describe('Multilingual System E2E Flow Simulation', () => {
  beforeEach(() => {
    process.env.GOOGLE_TRANSLATE_API_KEY = 'test_api_key';
    delete process.env.AUTOMATIC_TRANSLATION_ENABLED;
    delete process.env.SUPPORTED_LANGUAGES;
    jest.clearAllMocks();
    mockRepository.find.mockResolvedValue([]);
    mockRepository.save.mockResolvedValue([]);
    mockRepository.delete.mockResolvedValue({ affected: 1 });
    if ((global as any).fetch) {
      jest.restoreAllMocks();
    }
  });

  // Flow A: Browsing suites & details / Search & Filtering / Amenities & Packages
  test('Flow A: Browse suites in Spanish (via query parameters)', async () => {
    const req: any = {
      method: 'GET',
      baseUrl: '/suites',
      path: '/',
      originalUrl: '/suites',
      query: { lang: 'es' },
      headers: {}
    };

    let originalJsonBody: any = null;
    let resolveResponse: any = null;
    const responsePromise = new Promise((resolve) => {
      resolveResponse = resolve;
    });

    const res: any = {
      statusCode: 200,
      locals: {},
      json: jest.fn().mockImplementation((body) => {
        originalJsonBody = body;
        resolveResponse();
        return res;
      })
    };

    // Mock cache hit for suites
    mockRepository.find.mockResolvedValue([
      {
        entityType: 'suite',
        entityId: '12',
        fieldName: 'name',
        language: 'es',
        translatedText: 'Suite Familiar Real'
      },
      {
        entityType: 'suite',
        entityId: '12',
        fieldName: 'description',
        language: 'es',
        translatedText: 'Habitaciones elegantes y espaciosas.'
      }
    ]);

    // Exec pipeline
    languageResolverMiddleware(req, res, () => {});
    translationMiddleware(req, res, () => {});

    // Controller emits response
    res.json({
      id: 12,
      name: 'Royal Family Suite',
      description: 'Elegant and spacious rooms.',
      slotStartTime: '09:00',
      amenities: ['Private Pool', 'Balcony']
    });

    await responsePromise;

    // Assert translations are applied correctly without altering other properties
    expect(req.language).toBe('es');
    expect(originalJsonBody.id).toBe(12);
    expect(originalJsonBody.name).toBe('Suite Familiar Real');
    expect(originalJsonBody.description).toBe('Habitaciones elegantes y espaciosas.');
    expect(originalJsonBody.slotStartTime).toBe('09:00');
    expect(originalJsonBody.amenities).toEqual(['Private Pool', 'Balcony']);
  });

  // Flow B: Bookings and booking history
  test('Flow B: Browse bookings in French (via Accept-Language header)', async () => {
    const req: any = {
      method: 'GET',
      baseUrl: '/bookings',
      path: '/',
      originalUrl: '/bookings',
      query: {},
      headers: { 'accept-language': 'fr-FR,fr;q=0.9,en;q=0.8' }
    };

    let originalJsonBody: any = null;
    let resolveResponse: any = null;
    const responsePromise = new Promise((resolve) => {
      resolveResponse = resolve;
    });

    const res: any = {
      statusCode: 200,
      locals: {},
      json: jest.fn().mockImplementation((body) => {
        originalJsonBody = body;
        resolveResponse();
        return res;
      })
    };

    // Google Translate Mock for French translations (cache miss)
    const mockFetch = jest.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              translations: [
                { translatedText: 'Mariage' }
              ]
            }
          })
      })
    );
    global.fetch = mockFetch as any;

    languageResolverMiddleware(req, res, () => {});
    translationMiddleware(req, res, () => {});

    // Controller emits booking response containing dynamic fields
    res.json({
      id: 5,
      suiteId: 1,
      eventType: 'Wedding',
      totalAmount: 15000,
      status: 'confirmed'
    });

    await responsePromise;

    expect(req.language).toBe('fr');
    expect(originalJsonBody.id).toBe(5);
    expect(originalJsonBody.eventType).toBe('Mariage');
    expect(mockRepository.save).toHaveBeenCalledTimes(1);
  });

  // Flow C: User profile, settings, and authentication
  test('Flow C: Resolve language from authenticated user preferredLanguage setting', async () => {
    const req: any = {
      method: 'GET',
      baseUrl: '/suites',
      path: '/me',
      originalUrl: '/suites/me',
      query: {},
      headers: {}
    };

    let originalJsonBody: any = null;
    let resolveResponse: any = null;
    const responsePromise = new Promise((resolve) => {
      resolveResponse = resolve;
    });

    const res: any = {
      statusCode: 200,
      locals: {},
      json: jest.fn().mockImplementation((body) => {
        originalJsonBody = body;
        resolveResponse();
        return res;
      })
    };

    // 1. Initial resolution (no auth info resolved yet)
    languageResolverMiddleware(req, res, () => {});
    expect(req.language).toBe('en');

    // 2. Authentication middleware runs, populating req.user.preferredLanguage
    req.user = { id: 45, email: 'user@example.com', preferredLanguage: 'hi' };

    // 3. Response interception
    translationMiddleware(req, res, () => {});

    // Mock cache hit for User details
    mockRepository.find.mockResolvedValue([
      {
        entityType: 'general', // Fallback type
        entityId: '0',
        fieldName: 'note',
        language: 'hi',
        translatedText: 'वीआईपी ग्राहक'
      }
    ]);

    // Controller returns user details
    res.json({
      id: 45,
      fullName: 'John Doe',
      note: 'VIP Customer'
    });

    await responsePromise;

    expect(req.language).toBe('hi');
    expect(originalJsonBody.fullName).toBe('John Doe');
    expect(originalJsonBody.note).toBe('वीआईपी ग्राहक');
  });

  // Flow D: Payment and Checkout Cache Invalidation
  test('Flow D: Checkout/Payment update invalidates cached translations', async () => {
    // When a booking status or payment occurs (write request), the cache is invalidated.
    const req: any = {
      method: 'POST',
      baseUrl: '/bookings',
      path: '/',
      originalUrl: '/bookings',
      query: {},
      headers: {}
    };

    let originalJsonBody: any = null;
    let resolveResponse: any = null;
    const responsePromise = new Promise((resolve) => {
      resolveResponse = resolve;
    });

    const res: any = {
      statusCode: 201,
      locals: {},
      json: jest.fn().mockImplementation((body) => {
        originalJsonBody = body;
        resolveResponse();
        return res;
      })
    };

    languageResolverMiddleware(req, res, () => {});
    translationMiddleware(req, res, () => {});

    // Controller returns created/updated booking payload
    res.json({
      id: 88,
      suiteId: 3,
      eventType: 'Celebration',
      totalAmount: 1200,
      status: 'confirmed'
    });

    await responsePromise;

    // Confirm that invalidation script identified the new booking and deleted old cache
    expect(mockRepository.delete).toHaveBeenCalledWith({
      entityType: 'booking',
      entityId: '88'
    });
  });

  // Flow E: Unsupported Languages Fallback
  test('Flow E: Fallback to English for unsupported target language', async () => {
    const req: any = {
      method: 'GET',
      baseUrl: '/suites',
      path: '/',
      originalUrl: '/suites',
      query: { lang: 'xyz' }, // Invalid/unsupported language code
      headers: {}
    };

    let originalJsonBody: any = null;
    let resolveResponse: any = null;
    const responsePromise = new Promise((resolve) => {
      resolveResponse = resolve;
    });

    const res: any = {
      statusCode: 200,
      locals: {},
      json: jest.fn().mockImplementation((body) => {
        originalJsonBody = body;
        resolveResponse();
        return res;
      })
    };

    languageResolverMiddleware(req, res, () => {});
    translationMiddleware(req, res, () => {});

    res.json({
      id: 1,
      name: 'Presidential Suite'
    });

    await responsePromise;

    // Resolved language falls back to 'en', bypassing translation
    expect(req.language).toBe('en');
    expect(originalJsonBody.name).toBe('Presidential Suite');
    expect(mockRepository.find).not.toHaveBeenCalled();
  });
});
