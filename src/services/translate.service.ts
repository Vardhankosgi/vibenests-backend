import dotenv from 'dotenv';
import { In } from 'typeorm';
import { AppDataSource } from '../data-source';
import { Translation } from '../entities/Translation';

dotenv.config();

// Translatable keys defined globally
export const TRANSLATABLE_FIELDS = new Set([
  'name',
  'title',
  'description',
  'label',
  'ruleValue',
  'occasion',
  'themeType',
  'eventType',
  'category',
  'badge',
  'note'
]);

interface TranslationJob {
  path: (string | number)[];
  text: string;
  entityType: string;
  entityId: string;
  fieldName: string;
}

/**
 * Heuristic to detect database entity types based on unique property patterns.
 */
export function detectEntityType(obj: any): string | null {
  if (typeof obj !== 'object' || obj === null) return null;
  if ('slotStartTime' in obj || 'slotEndTime' in obj) return 'suite';
  if ('category' in obj && 'price' in obj) return 'addon';
  if ('occasion' in obj && 'priceRangeMin' in obj) return 'celebration_package';
  if ('ruleKey' in obj || 'valueType' in obj) return 'booking_rule';
  if ('applicableTo' in obj || ('discountType' in obj && 'startDate' in obj)) return 'offer';
  if ('code' in obj && 'maxDiscountAmount' in obj) return 'coupon';
  if ('tiers' in obj && 'allowPartialRefund' in obj) return 'refund_policy';
  if ('suiteId' in obj && 'eventType' in obj && 'totalAmount' in obj) return 'booking';
  return null;
}

/**
 * Connects to Google Cloud Translation REST API to translate an array of texts in one batch.
 */
export async function translateTexts(texts: string[], targetLang: string): Promise<string[]> {
  const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;
  if (!apiKey) {
    console.warn('[Translate Service] GOOGLE_TRANSLATE_API_KEY is not defined in environment variables. Falling back to original texts.');
    return texts;
  }

  const normalizedLang = targetLang.toLowerCase();
  const results: string[] = [...texts];
  const missingIndexes: number[] = [];
  const missingTexts: string[] = [];

  for (let i = 0; i < texts.length; i++) {
    const text = texts[i];
    if (!text || text.trim() === '') {
      continue;
    }
    missingIndexes.push(i);
    missingTexts.push(text);
  }

  // Fetch from Google Cloud Translation API
  if (missingTexts.length > 0) {
    try {
      const response = await fetch(
        `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            q: missingTexts,
            target: normalizedLang,
            format: 'text'
          }),
        }
      );

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Google Translate API error: status ${response.status} - ${errText}`);
      }

      const resJson = (await response.json()) as any;
      const translations = resJson?.data?.translations || [];

      for (let i = 0; i < missingTexts.length; i++) {
        const translated = translations[i]?.translatedText ?? missingTexts[i];
        const originalIndex = missingIndexes[i];
        results[originalIndex] = translated;
      }
    } catch (err: any) {
      console.error('[Translate Service] API request failed:', err.message);
      // Fallback: original texts are already in results
    }
  }

  return results;
}

/**
 * Recursively scans, checks database cache, translates missing fields,
 * and caches new results in the 'translations' table.
 */
export async function translatePayload(payload: any, targetLang: string): Promise<any> {
  if (!payload || !targetLang || targetLang.toLowerCase() === 'en') {
    return payload;
  }

  const jobs: TranslationJob[] = [];

  // Helper to recursively collect strings and their paths
  function collect(node: any, path: (string | number)[], entityType: string, entityId: string) {
    if (!node) return;

    if (Array.isArray(node)) {
      const parentKey = path[path.length - 1];
      if (parentKey === 'amenities') {
        for (let i = 0; i < node.length; i++) {
          if (typeof node[i] === 'string') {
            jobs.push({
              path: [...path, i],
              text: node[i],
              entityType,
              entityId,
              fieldName: `amenities.${i}`
            });
          } else {
            collect(node[i], [...path, i], entityType, entityId);
          }
        }
      } else {
        for (let i = 0; i < node.length; i++) {
          collect(node[i], [...path, i], entityType, entityId);
        }
      }
      return;
    }

    if (typeof node === 'object') {
      const detectedType = detectEntityType(node);
      const currentType = detectedType || entityType;
      const currentId = detectedType ? String(node.id || '0') : entityId;
      const isStringRule = node.valueType === 'string' || node.valueType === undefined;

      for (const key of Object.keys(node)) {
        const val = node[key];

        if (key === 'amenities' && Array.isArray(val)) {
          for (let i = 0; i < val.length; i++) {
            if (typeof val[i] === 'string') {
              jobs.push({
                path: [...path, key, i],
                text: val[i],
                entityType: currentType,
                entityId: currentId,
                fieldName: `amenities.${i}`
              });
            } else {
              collect(val[i], [...path, key, i], currentType, currentId);
            }
          }
        } else if (TRANSLATABLE_FIELDS.has(key) && typeof val === 'string') {
          // Skip if ruleValue is not a string rule description
          if (key === 'ruleValue' && !isStringRule) {
            continue;
          }
          // Skip URLs
          if (val.startsWith('http://') || val.startsWith('https://')) {
            continue;
          }
          jobs.push({
            path: [...path, key],
            text: val,
            entityType: currentType,
            entityId: currentId,
            fieldName: key
          });
        } else if (typeof val === 'object' && val !== null) {
          collect(val, [...path, key], currentType, currentId);
        }
      }
    }
  }

  // Clone payload to prevent side effects on cached objects or TypeORM entities
  const cloned = JSON.parse(JSON.stringify(payload));
  collect(cloned, [], 'general', '0');

  if (jobs.length === 0) {
    return cloned;
  }

  const repo = AppDataSource.getRepository(Translation);
  const normalizedLang = targetLang.toLowerCase();

  // 1. Batch lookup DB cache using a single index-optimized query
  let dbTranslations: Translation[] = [];
  try {
    dbTranslations = await repo.find({
      where: jobs.map(j => ({
        entityType: j.entityType,
        entityId: j.entityId,
        fieldName: j.fieldName,
        language: normalizedLang
      }))
    });
  } catch (err: any) {
    console.error('[Translate Service] Cache lookup failed:', err.message);
  }

  const cacheMap = new Map<string, string>();
  for (const t of dbTranslations) {
    cacheMap.set(`${t.entityType}:${t.entityId}:${t.fieldName}`, t.translatedText);
  }

  // 2. Separate hits and misses
  const missingJobs: TranslationJob[] = [];
  const missingTexts: string[] = [];

  for (const job of jobs) {
    const cacheKey = `${job.entityType}:${job.entityId}:${job.fieldName}`;
    if (cacheMap.has(cacheKey)) {
      // Cache hit: write immediately to the cloned payload
      let current = cloned;
      for (let i = 0; i < job.path.length - 1; i++) {
        current = current[job.path[i]];
      }
      current[job.path[job.path.length - 1]] = cacheMap.get(cacheKey)!;
    } else {
      missingJobs.push(job);
      missingTexts.push(job.text);
    }
  }

  // 3. Translate missing texts and save in DB cache
  if (missingTexts.length > 0) {
    const uniqueTexts = Array.from(new Set(missingTexts));
    const translations = await translateTexts(uniqueTexts, targetLang);

    const translationMap = new Map<string, string>();
    for (let i = 0; i < uniqueTexts.length; i++) {
      translationMap.set(uniqueTexts[i], translations[i]);
    }

    const newEntities: Translation[] = [];

    for (const job of missingJobs) {
      const translatedText = translationMap.get(job.text) || job.text;

      // Write to cloned payload
      let current = cloned;
      for (let i = 0; i < job.path.length - 1; i++) {
        current = current[job.path[i]];
      }
      current[job.path[job.path.length - 1]] = translatedText;

      // Queue for cache save (only if not empty string and changed)
      if (job.text && job.text.trim() !== '') {
        newEntities.push(
          repo.create({
            entityType: job.entityType,
            entityId: job.entityId,
            fieldName: job.fieldName,
            language: normalizedLang,
            translatedText
          })
        );
      }
    }

    if (newEntities.length > 0) {
      try {
        // Save all new cache entries in a single batch write
        await repo.save(newEntities);
      } catch (dbErr: any) {
        // Log warning and proceed to avoid breaking API if insert fails
        console.warn('[Translate Service] Failed to save translations to DB cache:', dbErr.message);
      }
    }
  }

  return cloned;
}
