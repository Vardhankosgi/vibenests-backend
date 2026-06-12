import { Request, Response, NextFunction } from 'express';
import { translatePayload, detectEntityType } from '../services/translate.service';
import { AppDataSource } from '../data-source';
import { Translation } from '../entities/Translation';

// Helper to get supported languages from env or defaults
export function getSupportedLanguages(): string[] {
  const envList = process.env.SUPPORTED_LANGUAGES;
  if (envList) {
    return envList.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  }
  return ['en', 'hi', 'te', 'ta', 'kn', 'ml', 'mr', 'bn', 'gu', 'pa', 'es', 'fr', 'de', 'it', 'ru', 'pt', 'ar', 'zh', 'ja'];
}

// Helper to validate if language is supported
export function isValidSupportedLanguage(lang: string): boolean {
  return getSupportedLanguages().includes(lang.toLowerCase());
}

// Helper to check if automatic translation is enabled
export function isTranslationEnabled(): boolean {
  return process.env.AUTOMATIC_TRANSLATION_ENABLED !== 'false';
}

// Centralized helper to resolve active language for a request
export function resolveActiveLanguage(req: any): string {
  // 1. Query parameter (lang or locale)
  const queryLang = req.query.lang || req.query.locale;
  if (typeof queryLang === 'string' && queryLang.trim() !== '') {
    const lang = queryLang.trim().toLowerCase();
    if (isValidSupportedLanguage(lang)) {
      return lang;
    }
  }

  // 2. Request headers (X-Locale or Accept-Language)
  const xLocale = req.headers['x-locale'];
  if (typeof xLocale === 'string' && xLocale.trim() !== '') {
    const lang = xLocale.trim().toLowerCase();
    if (isValidSupportedLanguage(lang)) {
      return lang;
    }
  }

  const acceptLang = req.headers['accept-language'];
  if (typeof acceptLang === 'string' && acceptLang.trim() !== '') {
    const parsed = acceptLang.split(',')[0].split('-')[0].trim().toLowerCase();
    if (isValidSupportedLanguage(parsed)) {
      return parsed;
    }
  }

  // 3. Authenticated user preference (req.user)
  if (req.user) {
    const userLang = req.user.preferredLanguage || req.user.language;
    if (typeof userLang === 'string' && userLang.trim() !== '') {
      const lang = userLang.trim().toLowerCase();
      if (isValidSupportedLanguage(lang)) {
        return lang;
      }
    }
  }

  // 4. Default English
  return 'en';
}

/**
 * Language resolver middleware that runs early to determine the active language
 * and attaches it to the request and response lifecycle.
 */
export function languageResolverMiddleware(req: any, res: Response, next: NextFunction) {
  const lang = resolveActiveLanguage(req);
  req.language = lang;
  if (res && res.locals) {
    res.locals.language = lang;
  }
  next();
}

/**
 * Express middleware that intercepts API responses to translate content
 * and invalidate the translation cache on updates.
 */
export function translationMiddleware(req: any, res: Response, next: NextFunction) {
  // Base endpoints that return dynamic database data requiring translation/invalidation.
  const translatableBases = [
    '/suites',
    '/addons',
    '/celebration-packages',
    '/booking-rules',
    '/offers',
    '/refund-policies',
    '/bookings',
  ];

  // Match the request path, originalUrl, or baseUrl against translatable bases.
  const isTranslatable = translatableBases.some(
    (base) =>
      req.baseUrl.startsWith(base) ||
      req.originalUrl.startsWith(base) ||
      req.path.startsWith(base)
  );

  if (!isTranslatable) {
    return next();
  }

  const isWrite = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);

  // Override res.json to intercept responses
  const originalJson = res.json;
  res.json = function (body: any) {
    // Restore res.json to avoid recursion
    res.json = originalJson;

    // Only process successful 2xx responses
    if (body && res.statusCode >= 200 && res.statusCode < 300) {
      // 1. Perform cache invalidation if it's a write request (regardless of translation toggles)
      if (isWrite) {
        const entityPairsToInvalidate = new Set<string>();

        // Heuristic A: Parse entity type and ID from request URL
        const urlPath = req.originalUrl || req.path || '';
        const pathWithoutQuery = urlPath.split('?')[0];
        const segments = pathWithoutQuery.split('/').filter(Boolean);

        const routeToEntityType: Record<string, string> = {
          'suites': 'suite',
          'addons': 'addon',
          'celebration-packages': 'celebration_package',
          'booking-rules': 'booking_rule',
          'offers': 'offer',
          'coupons': 'coupon',
          'refund-policies': 'refund_policy',
          'bookings': 'booking',
        };

        for (const [routeKey, entityType] of Object.entries(routeToEntityType)) {
          const baseIdx = segments.indexOf(routeKey);
          if (baseIdx !== -1 && segments.length > baseIdx + 1) {
            const nextSegment = segments[baseIdx + 1];
            if (/^\d+$/.test(nextSegment)) {
              entityPairsToInvalidate.add(`${entityType}:${nextSegment}`);
              break;
            }
          }
        }

        // Heuristic B: Scan the response body recursively for updated entities
        const scan = (obj: any) => {
          if (!obj || typeof obj !== 'object') return;
          if (Array.isArray(obj)) {
            for (const item of obj) scan(item);
            return;
          }
          const detectedType = detectEntityType(obj);
          if (detectedType && obj.id) {
            entityPairsToInvalidate.add(`${detectedType}:${obj.id}`);
          }
          for (const key of Object.keys(obj)) {
            if (typeof obj[key] === 'object' && obj[key] !== null) {
              scan(obj[key]);
            }
          }
        };
        scan(body);

        // Asynchronously delete cache entries
        if (entityPairsToInvalidate.size > 0) {
          try {
            const repo = AppDataSource.getRepository(Translation);
            const deletePromises = Array.from(entityPairsToInvalidate).map((pair) => {
              const [entityType, entityId] = pair.split(':');
              return repo.delete({ entityType, entityId }).catch((err) => {
                console.warn(
                  `[Translation Middleware] Failed to delete cache for ${entityType}:${entityId}:`,
                  err.message
                );
              });
            });
            Promise.all(deletePromises);
          } catch (repoErr: any) {
            console.warn('[Translation Middleware] Failed to access translation repository:', repoErr.message);
          }
        }
      }

      // 2. Perform translation if translation is enabled and target language is not English
      if (isTranslationEnabled()) {
        // Resolve language again in case user preferences are now populated (e.g. req.user)
        const lang = resolveActiveLanguage(req);
        req.language = lang;
        if (res && res.locals) {
          res.locals.language = lang;
        }

        const hasLang = lang && lang !== 'en';

        if (hasLang) {
          translatePayload(body, lang)
            .then((translatedBody) => {
              originalJson.call(this, translatedBody);
            })
            .catch((err) => {
              console.error('[Translation Middleware] Error during translation:', err);
              // Fallback to original body
              originalJson.call(this, body);
            });
          return this;
        }
      }
    }

    return originalJson.call(this, body);
  };

  next();
}
