import { DEFAULT_LANGUAGE, findLanguageByCode, type AppLanguage } from './languages';

const LS_KEY = 'ojas.language.v1';

function read(): AppLanguage {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return DEFAULT_LANGUAGE;
    const parsed = JSON.parse(raw) as Partial<AppLanguage>;
    const lang = parsed?.code ? findLanguageByCode(parsed.code) : undefined;
    return lang || DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

function write(lang: AppLanguage) {
  try { localStorage.setItem(LS_KEY, JSON.stringify({ code: lang.code })); } catch {}
}

export const languageStore = {
  get(): AppLanguage { return read(); },
  set(langCode: string) {
    const lang = findLanguageByCode(langCode) || DEFAULT_LANGUAGE;
    write(lang);
    const ev = new CustomEvent('ojas-language-changed', { detail: lang });
    window.dispatchEvent(ev);
  },
  subscribe(handler: (lang: AppLanguage) => void) {
    const fn = (e: Event) => handler((e as CustomEvent<AppLanguage>).detail);
    window.addEventListener('ojas-language-changed', fn as EventListener);
    return () => window.removeEventListener('ojas-language-changed', fn as EventListener);
  }
};
