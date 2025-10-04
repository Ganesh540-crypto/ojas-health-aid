export type AppLanguage = {
  code: string; // BCP-47 code
  label: string;
  isIndian?: boolean;
};

export const DEFAULT_LANGUAGE: AppLanguage = { code: 'en', label: 'English' };

export const INDIAN_LANGUAGES: AppLanguage[] = [
  { code: 'hi', label: 'हिन्दी (Hindi)', isIndian: true },
  { code: 'bn', label: 'বাংলা (Bengali)', isIndian: true },
  { code: 'te', label: 'తెలుగు (Telugu)', isIndian: true },
  { code: 'mr', label: 'मराठी (Marathi)', isIndian: true },
  { code: 'ta', label: 'தமிழ் (Tamil)', isIndian: true },
  { code: 'gu', label: 'ગુજરાતી (Gujarati)', isIndian: true },
  { code: 'kn', label: 'ಕನ್ನಡ (Kannada)', isIndian: true },
  { code: 'ml', label: 'മലയാളം (Malayalam)', isIndian: true },
  { code: 'pa', label: 'ਪੰਜਾਬੀ (Punjabi)', isIndian: true },
  { code: 'ur', label: 'اردو (Urdu)', isIndian: true },
];

export const GLOBAL_LANGUAGES: AppLanguage[] = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español (Spanish)' },
  { code: 'fr', label: 'Français (French)' },
  { code: 'de', label: 'Deutsch (German)' },
  { code: 'pt', label: 'Português (Portuguese)' },
  { code: 'ar', label: 'العربية (Arabic)' },
  { code: 'ru', label: 'Русский (Russian)' },
  { code: 'ja', label: '日本語 (Japanese)' },
  { code: 'ko', label: '한국어 (Korean)' },
  { code: 'zh-Hans', label: '简体中文 (Chinese Simplified)' },
];

export function findLanguageByCode(code: string): AppLanguage | undefined {
  return [...INDIAN_LANGUAGES, ...GLOBAL_LANGUAGES].find(l => l.code === code);
}
