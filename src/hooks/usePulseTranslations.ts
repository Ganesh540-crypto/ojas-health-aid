import { useCallback, useEffect, useState } from 'react';
import { azureTranslator } from '@/lib/azureTranslator';
import { languageStore } from '@/lib/languageStore';
import type { PulseArticle } from '@/pages/Pulse';

interface TranslatedArticle {
  title: string;
  summary: string;
  lede?: string;
  paragraphs?: string[];
  keyPoints?: string[];
}

export const usePulseTranslations = (articles: PulseArticle[]) => {
  const [lang, setLang] = useState(() => languageStore.get());
  const [translatedArticles, setTranslatedArticles] = useState<Record<string, TranslatedArticle>>({});
  const [isTranslating, setIsTranslating] = useState(false);

  // Subscribe to language changes
  useEffect(() => {
    const unsub = languageStore.subscribe((next) => setLang(next));
    return () => unsub();
  }, []);

  // Translate when articles or language changes
  useEffect(() => {
    const target = lang?.code || 'en';
    if (target === 'en' || articles.length === 0) {
      setTranslatedArticles({});
      return;
    }

    // Only translate articles that we don't have translations for yet
    const needsTranslation = articles.filter(a => !translatedArticles[a.id]);
    if (needsTranslation.length === 0) {
      return;
    }

    let cancelled = false;
    
    const doTranslate = async () => {
      setIsTranslating(true);
      try {
        const translatedMap: Record<string, TranslatedArticle> = { ...translatedArticles };

        // Translate new articles in batches of 10 to avoid overwhelming the API
        const batchSize = 10;
        for (let i = 0; i < needsTranslation.length; i += batchSize) {
          if (cancelled) break;
          
          const batch = needsTranslation.slice(i, i + batchSize);
          
          for (const article of batch) {
            if (cancelled) break;
          
          const textsToTranslate: string[] = [
            article.title,
            article.summary,
          ];
          
          if (article.lede) textsToTranslate.push(article.lede);
          if (article.paragraphs) textsToTranslate.push(...article.paragraphs);
          if (article.keyPoints) textsToTranslate.push(...article.keyPoints);

          const translated = await azureTranslator.translateBatch(textsToTranslate, { to: target });
          
          let index = 0;
          const translatedArticle: TranslatedArticle = {
            title: translated[index++] || article.title,
            summary: translated[index++] || article.summary,
          };

          if (article.lede) {
            translatedArticle.lede = translated[index++] || article.lede;
          }

          if (article.paragraphs && article.paragraphs.length > 0) {
            translatedArticle.paragraphs = article.paragraphs.map(() => 
              translated[index++] || ''
            );
          }

          if (article.keyPoints && article.keyPoints.length > 0) {
            translatedArticle.keyPoints = article.keyPoints.map(() => 
              translated[index++] || ''
            );
          }

          translatedMap[article.id] = translatedArticle;
          }
          
          // Update state after each batch to show progress
          if (!cancelled) {
            setTranslatedArticles({ ...translatedMap });
          }
        }
      } catch (error) {
        console.warn('Translation failed:', error);
        if (!cancelled) {
          setTranslatedArticles({});
        }
      } finally {
        if (!cancelled) {
          setIsTranslating(false);
        }
      }
    };

    void doTranslate();
    
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articles.map(a => a.id).join(','), lang?.code]);

  return {
    lang,
    translatedArticles,
    isTranslating,
  };
};
