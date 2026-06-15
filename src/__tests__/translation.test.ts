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

import {
  translationMiddleware,
  languageResolverMiddleware,
  getSupportedLanguages,
  resolveActiveLanguage,
  isTranslationEnabled
} from '../middleware/translation';
import { translatePayload } from '../services/translate.service';

describe('Translation System Unit Tests', () => {
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

  test('translatePayload collects and translates fields correctly on cache miss', async () => {
    const payload = {
      id: 1,
      name: 'Luxury Family Suite',
      description: 'A beautiful luxury suite for families.',
      price: 500,
      slotStartTime: '09:00', // To make it detect as 'suite'
      amenities: ['Wifi', 'TV']
    };

    const mockFetch = jest.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              translations: [
                { translatedText: 'Suite Familiar de Lujo' },
                { translatedText: 'Una hermosa suite de lujo para familias.' },
                { translatedText: 'Wi-Fi' },
                { translatedText: 'Televisión' }
              ]
            }
          })
      })
    );
    global.fetch = mockFetch as any;

    const result = await translatePayload(payload, 'es');

    expect(result.name).toBe('Suite Familiar de Lujo');
    expect(result.description).toBe('Una hermosa suite de lujo para familias.');
    expect(result.amenities).toEqual(['Wi-Fi', 'Televisión']);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Verify cache has been checked
    expect(mockRepository.find).toHaveBeenCalledTimes(1);

    // Verify cache save has been called with the new translations
    expect(mockRepository.save).toHaveBeenCalledTimes(1);
    const savedArgs = mockRepository.save.mock.calls[0][0];
    expect(savedArgs).toHaveLength(4);
    expect(savedArgs[0]).toEqual({
      entityType: 'suite',
      entityId: '1',
      fieldName: 'name',
      language: 'es',
      translatedText: 'Suite Familiar de Lujo'
    });
  });

  test('translatePayload uses cache hits and only translates cache misses', async () => {
    const payload = {
      id: 1,
      name: 'Luxury Family Suite',
      description: 'A beautiful luxury suite for families.',
      price: 500,
      slotStartTime: '09:00',
    };

    // Return cached translation for name, miss for description
    mockRepository.find.mockResolvedValue([
      {
        entityType: 'suite',
        entityId: '1',
        fieldName: 'name',
        language: 'es',
        translatedText: 'Suite de Lujo en Cache'
      }
    ]);

    const mockFetch = jest.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              translations: [
                { translatedText: 'Una hermosa suite de lujo' }
              ]
            }
          })
      })
    );
    global.fetch = mockFetch as any;

    const result = await translatePayload(payload, 'es');

    expect(result.name).toBe('Suite de Lujo en Cache');
    expect(result.description).toBe('Una hermosa suite de lujo');
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockRepository.find).toHaveBeenCalledTimes(1);

    // Verify only description is saved to cache
    expect(mockRepository.save).toHaveBeenCalledTimes(1);
    const savedArgs = mockRepository.save.mock.calls[0][0];
    expect(savedArgs).toHaveLength(1);
    expect(savedArgs[0].fieldName).toBe('description');
  });

  test('languageResolverMiddleware resolves from query params lang or locale', () => {
    const req: any = { query: { lang: 'fr' }, headers: {} };
    const res: any = { locals: {} };
    const next = jest.fn();

    languageResolverMiddleware(req, res, next);

    expect(req.language).toBe('fr');
    expect(res.locals.language).toBe('fr');
    expect(next).toHaveBeenCalledTimes(1);

    const reqLocale: any = { query: { locale: 'de' }, headers: {} };
    languageResolverMiddleware(reqLocale, res, next);
    expect(reqLocale.language).toBe('de');
  });

  test('languageResolverMiddleware resolves from headers X-Locale or Accept-Language if query is missing', () => {
    const reqXLocale: any = { query: {}, headers: { 'x-locale': 'es' } };
    const res: any = { locals: {} };
    const next = jest.fn();

    languageResolverMiddleware(reqXLocale, res, next);
    expect(reqXLocale.language).toBe('es');

    const reqAccept: any = { query: {}, headers: { 'accept-language': 'it-IT,it;q=0.9,en;q=0.8' } };
    languageResolverMiddleware(reqAccept, res, next);
    expect(reqAccept.language).toBe('it');
  });

  test('languageResolverMiddleware resolves from authenticated user preferences in res.json interceptor', async () => {
    let originalJsonBody: any = null;
    let resolveResponse: any = null;
    const responsePromise = new Promise((resolve) => {
      resolveResponse = resolve;
    });

    const req: any = {
      method: 'GET',
      baseUrl: '/suites',
      path: '/',
      originalUrl: '/suites',
      query: {},
      headers: {}
    };
    const res: any = {
      statusCode: 200,
      locals: {},
      json: jest.fn().mockImplementation((body) => {
        originalJsonBody = body;
        resolveResponse();
        return res;
      })
    };
    const next = jest.fn();

    // 1. Initial resolution (runs before authentication occurs)
    languageResolverMiddleware(req, res, next);
    expect(req.language).toBe('en'); // Defaults to en initially

    // 2. Simulate authentication populating req.user after routing middleware
    req.user = { preferredLanguage: 'de' };

    // 3. Intercept JSON response
    translationMiddleware(req, res, next);

    mockRepository.find.mockResolvedValue([
      {
        entityType: 'suite',
        entityId: '1',
        fieldName: 'name',
        language: 'de',
        translatedText: 'Luxuszimmer'
      }
    ]);

    // Simulate controller calling res.json
    res.json({ id: 1, name: 'Luxury Suite', slotStartTime: '09:00' });

    // Wait for the async translation process to complete
    await responsePromise;

    expect(req.language).toBe('de');
    expect(originalJsonBody.name).toBe('Luxuszimmer');
  });

  test('languageResolverMiddleware falls back to English for unsupported languages', () => {
    const req: any = { query: { lang: 'unsupported_lang' }, headers: {} };
    const res: any = { locals: {} };
    const next = jest.fn();

    languageResolverMiddleware(req, res, next);
    expect(req.language).toBe('en');
  });

  test('translationMiddleware honors AUTOMATIC_TRANSLATION_ENABLED toggle', async () => {
    process.env.AUTOMATIC_TRANSLATION_ENABLED = 'false';

    const req: any = {
      method: 'GET',
      baseUrl: '/suites',
      path: '/',
      originalUrl: '/suites',
      query: { lang: 'es' },
      headers: {}
    };
    let originalJsonBody: any = null;
    const res: any = {
      statusCode: 200,
      locals: {},
      json: jest.fn().mockImplementation((body) => {
        originalJsonBody = body;
        return res;
      })
    };
    const next = jest.fn();

    languageResolverMiddleware(req, res, next);
    translationMiddleware(req, res, next);

    res.json({ id: 1, name: 'Luxury Suite', slotStartTime: '09:00' });

    await new Promise((resolve) => setImmediate(resolve));

    // Translation should be bypassed, so we get the original text
    expect(originalJsonBody.name).toBe('Luxury Suite');
  });

  test('getSupportedLanguages parses SUPPORTED_LANGUAGES environment variable', () => {
    process.env.SUPPORTED_LANGUAGES = 'en,fr,ja';
    const langs = getSupportedLanguages();
    expect(langs).toEqual(['en', 'fr', 'ja']);
  });

  test('translationMiddleware bypasses translation if lang is missing or en', () => {
    const originalJsonMock = jest.fn();
    const req: any = { query: {}, baseUrl: '/suites', path: '/', method: 'GET', headers: {} };
    const res: any = { json: originalJsonMock, locals: {} };
    const next = jest.fn();

    translationMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    
    // Simulate controller calling res.json
    res.json({ name: 'Suite' });
    expect(originalJsonMock).toHaveBeenCalledTimes(1);
  });

  test('translationMiddleware bypasses translation if path is not translatable', () => {
    const originalJsonMock = jest.fn();
    const req: any = { query: { lang: 'es' }, baseUrl: '/auth', path: '/me', originalUrl: '/auth/me', method: 'GET', headers: {} };
    const res: any = { json: originalJsonMock, locals: {} };
    const next = jest.fn();

    translationMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    
    // Simulate controller calling res.json
    res.json({ name: 'User' });
    expect(originalJsonMock).toHaveBeenCalledTimes(1);
  });

  test('translationMiddleware intercepts and translates response on translatable routes', async () => {
    const req: any = { query: { lang: 'es' }, baseUrl: '/suites', path: '/4', originalUrl: '/suites/4', method: 'GET', headers: {} };
    
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
    const next = jest.fn();

    mockRepository.find.mockResolvedValue([
      {
        entityType: 'suite',
        entityId: '4',
        fieldName: 'name',
        language: 'es',
        translatedText: 'Suite Traducida'
      }
    ]);

    translationMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);

    // Simulate controller sending response
    res.json({ id: 4, name: 'Luxury Family Suite', slotStartTime: '09:00' });

    await responsePromise;

    expect(originalJsonBody.name).toBe('Suite Traducida');
  });

  test('translationMiddleware invalidates cache on write requests', async () => {
    // A POST write request
    const req: any = {
      method: 'POST',
      baseUrl: '/suites',
      path: '/',
      originalUrl: '/suites',
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
    const next = jest.fn();

    translationMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);

    // Simulate database controller response with the created entity
    res.json({ id: 42, name: 'Suite 42', slotStartTime: '09:00' });

    await responsePromise;

    // Verify cache invalidation occurred asynchronously
    expect(originalJsonBody).toEqual({ id: 42, name: 'Suite 42', slotStartTime: '09:00' });
    
    // Check if delete was called for 'suite' and '42'
    expect(mockRepository.delete).toHaveBeenCalledWith({ entityType: 'suite', entityId: '42' });
  });

  test('translationMiddleware invalidates cache using URL params on DELETE write requests', async () => {
    // A DELETE write request
    const req: any = {
      method: 'DELETE',
      baseUrl: '/suites',
      path: '/73',
      originalUrl: '/suites/73',
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
    const next = jest.fn();

    translationMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);

    // Simulate delete response (e.g. success message, no entity structure)
    res.json({ message: 'Suite removed' });

    await responsePromise;

    expect(originalJsonBody).toEqual({ message: 'Suite removed' });
    
    // Check if delete was called for 'suite' and '73' (extracted from URL segment)
    expect(mockRepository.delete).toHaveBeenCalledWith({ entityType: 'suite', entityId: '73' });
  });
});
