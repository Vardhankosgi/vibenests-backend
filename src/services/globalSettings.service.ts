import { AppDataSource } from '../data-source';
import { GlobalSetting } from '../entities/GlobalSetting';

const globalSettingsRepo = AppDataSource.getRepository(GlobalSetting);

export async function getSettingsMap(isPublicOnly: boolean = false): Promise<Record<string, any>> {
  const query = isPublicOnly ? { where: { isPublic: true } } : {};
  const settings = await globalSettingsRepo.find(query);

  const map: Record<string, any> = {};
  for (const s of settings) {
    if (s.valueType === 'boolean') {
      map[s.settingKey] = s.settingValue === 'true';
    } else if (s.valueType === 'number') {
      map[s.settingKey] = parseFloat(s.settingValue);
    } else if (s.valueType === 'json') {
      try {
        map[s.settingKey] = JSON.parse(s.settingValue);
      } catch {
        map[s.settingKey] = s.settingValue;
      }
    } else {
      map[s.settingKey] = s.settingValue;
    }
  }
  return map;
}

export async function upsertSettings(settingsMap: Record<string, any>): Promise<void> {
  const keys = Object.keys(settingsMap);
  for (const key of keys) {
    const value = settingsMap[key];
    
    let valueType: 'string' | 'number' | 'boolean' | 'json' = 'string';
    let settingValue = String(value);

    if (typeof value === 'boolean') {
      valueType = 'boolean';
    } else if (typeof value === 'number') {
      valueType = 'number';
    } else if (typeof value === 'object' && value !== null) {
      valueType = 'json';
      settingValue = JSON.stringify(value);
    }

    // Determine group and isPublic dynamically based on the key, or we can just default.
    // For now, default group to 'general' and isPublic to false unless known.
    // We could define a map of public keys. Let's make appearance and basic profile public.
    const publicKeys = [
      'businessName', 'logoUrl', 'email', 'phone', 'address', 'currency', 'language',
      'theme', 'accentColor', 'compactMode', 'animationsEnabled', 'whatsappNumber'
    ];
    const isPublic = publicKeys.includes(key);

    let setting = await globalSettingsRepo.findOne({ where: { settingKey: key } });
    if (setting) {
      setting.settingValue = settingValue;
      setting.valueType = valueType;
      setting.isPublic = isPublic;
      await globalSettingsRepo.save(setting);
    } else {
      setting = globalSettingsRepo.create({
        settingKey: key,
        settingValue,
        valueType,
        group: 'general',
        isPublic
      });
      await globalSettingsRepo.save(setting);
    }
  }
}
