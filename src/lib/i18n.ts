import { azureTranslator } from './azureTranslator';
import { languageStore } from './languageStore';

export type UIStrings = {
  loadingChat: string;
  reload: string;
  healthDetails: string;
  answerIntro: string;
  anyAdditional: string;
  typeExtraPlaceholder: string;
  back: string;
  next: string;
  submitAll: string;
  typeInstead: string;
  thinking: string;
  searching: string;
  analyzing: string;
};

const EN: UIStrings = {
  loadingChat: 'Loading chat…',
  reload: 'Reload',
  healthDetails: 'Health Details',
  answerIntro: 'Answer the questions below to personalize safe guidance. You can select an option or type an answer. Use the final card to add extra conditions.',
  anyAdditional: 'Any additional conditions or details?',
  typeExtraPlaceholder: 'Enter any other symptoms, allergies, medications, or context...',
  back: 'Back',
  next: 'Next',
  submitAll: 'Submit All',
  typeInstead: "I'll type instead above",
  thinking: 'Thinking',
  searching: 'Searching',
  analyzing: 'Analyzing',
};

export async function getUIStrings(code?: string): Promise<UIStrings> {
  const lang = (code || languageStore.get().code) || 'en';
  if (lang === 'en') return EN;
  const values = Object.values(EN);
  try {
    const out = await azureTranslator.translateBatch(values, { to: lang });
    const [loadingChat, reload, healthDetails, answerIntro, anyAdditional, typeExtraPlaceholder, back, next, submitAll, typeInstead, thinking, searching, analyzing] = out;
    return { loadingChat, reload, healthDetails, answerIntro, anyAdditional, typeExtraPlaceholder, back, next, submitAll, typeInstead, thinking, searching, analyzing };
  } catch {
    return EN;
  }
}
