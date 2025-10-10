import { useCallback, useEffect, useState } from 'react';

import { azureTranslator } from '@/lib/azureTranslator';
import { languageStore } from '@/lib/languageStore';

import type { ChatMessageRecord } from '@/features/chat/types';

const DEFAULT_I18N = {
  loadingChat: 'Loading chat…',
  reload: 'Reload',
  healthDetails: 'Health Details',
  answerIntro:
    'Answer the questions below to personalize safe guidance. You can select an option or type an answer. Use the final card to add extra conditions.',
  anyAdditional: 'Any additional conditions or details?',
  typeExtraPlaceholder: 'Enter any other symptoms, allergies, medications, or context...',
  back: 'Back',
  next: 'Next',
  submitAll: 'Submit All',
  typeInstead: "I'll type instead above",
  thinking: 'Thinking',
  searching: 'Searching',
  analyzing: 'Analyzing',
} as const;

type DefaultI18NKeys = keyof typeof DEFAULT_I18N;
export type ChatTranslations = Record<DefaultI18NKeys, string>;

interface UseChatTranslationsArgs {
  messages: ChatMessageRecord[];
  chatLoading: boolean;
  isLoading: boolean;
  streamController: { stop: () => void } | null;
}

interface UseChatTranslationsResult {
  lang: ReturnType<typeof languageStore.get>;
  i18n: ChatTranslations;
  translatedMap: Record<string, string>;
  setTranslatedMap: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}

export const useChatTranslations = ({
  messages,
  chatLoading,
  isLoading,
  streamController,
}: UseChatTranslationsArgs): UseChatTranslationsResult => {
  const [lang, setLang] = useState(() => languageStore.get());
  const [i18n, setI18n] = useState<ChatTranslations>(DEFAULT_I18N);
  const [translatedMap, setTranslatedMap] = useState<Record<string, string>>({});

  // Subscribe to language changes
  useEffect(() => {
    const unsub = languageStore.subscribe((next) => setLang(next));
    return () => {
      unsub();
    };
  }, []);

  // Update UI translations when language changes
  useEffect(() => {
    let cancelled = false;

    const updateTranslations = async () => {
      const target = lang?.code || 'en';
      if (target === 'en') {
        setI18n(DEFAULT_I18N);
        return;
      }

      const texts = [
        DEFAULT_I18N.loadingChat,
        DEFAULT_I18N.reload,
        DEFAULT_I18N.healthDetails,
        DEFAULT_I18N.answerIntro,
        DEFAULT_I18N.anyAdditional,
        DEFAULT_I18N.typeExtraPlaceholder,
        DEFAULT_I18N.back,
        DEFAULT_I18N.next,
        DEFAULT_I18N.submitAll,
        DEFAULT_I18N.typeInstead,
        DEFAULT_I18N.thinking,
        DEFAULT_I18N.searching,
        DEFAULT_I18N.analyzing,
      ];

      try {
        const out = await azureTranslator.translateBatch(texts, { to: target });
        if (cancelled) return;
        const nextI18n: ChatTranslations = {
          loadingChat: out[0] ?? DEFAULT_I18N.loadingChat,
          reload: out[1] ?? DEFAULT_I18N.reload,
          healthDetails: out[2] ?? DEFAULT_I18N.healthDetails,
          answerIntro: out[3] ?? DEFAULT_I18N.answerIntro,
          anyAdditional: out[4] ?? DEFAULT_I18N.anyAdditional,
          typeExtraPlaceholder: out[5] ?? DEFAULT_I18N.typeExtraPlaceholder,
          back: out[6] ?? DEFAULT_I18N.back,
          next: out[7] ?? DEFAULT_I18N.next,
          submitAll: out[8] ?? DEFAULT_I18N.submitAll,
          typeInstead: out[9] ?? DEFAULT_I18N.typeInstead,
          thinking: out[10] ?? DEFAULT_I18N.thinking,
          searching: out[11] ?? DEFAULT_I18N.searching,
          analyzing: out[12] ?? DEFAULT_I18N.analyzing,
        };
        setI18n(nextI18n);
      } catch {
        if (!cancelled) {
          setI18n(DEFAULT_I18N);
        }
      }
    };

    void updateTranslations();
    return () => {
      cancelled = true;
    };
  }, [lang]);

  const rebuildTranslations = useCallback(async () => {
    const target = lang?.code || 'en';
    if (target === 'en') {
      setTranslatedMap({});
      return;
    }

    const ids: string[] = [];
    const texts: string[] = [];
    for (const message of messages) {
      ids.push(message.id);
      texts.push(message.content);
    }

    if (texts.length === 0) {
      setTranslatedMap({});
      return;
    }

    try {
      const out = await azureTranslator.translateBatch(texts, { to: target });
      const map: Record<string, string> = {};
      ids.forEach((id, index) => {
        map[id] = out[index];
      });
      setTranslatedMap(map);
    } catch {
      // swallow errors silently
    }
  }, [lang?.code, messages]);

  // Rebuild translations when language changes and chat is ready
  useEffect(() => {
    if (!chatLoading) {
      void rebuildTranslations();
    }
  }, [chatLoading, rebuildTranslations, lang?.code]);

  // Rebuild translations once streaming completes
  useEffect(() => {
    if (!isLoading && !streamController) {
      void rebuildTranslations();
    }
  }, [isLoading, streamController, rebuildTranslations]);

  return {
    lang,
    i18n,
    translatedMap,
    setTranslatedMap,
  };
};
