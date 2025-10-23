import { useEffect, useRef, useState } from 'react';

/**
 * Image fallback hook
 * - Use server-provided imageUrl if present
 * - If missing/broken, progressively try to extract og:image from provided source URLs (client-side)
 */
export function useImageFallback(
  initialImageUrl: string | null | undefined,
  urls?: string[]
) {
  const [imageUrl, setImageUrl] = useState<string | null>(initialImageUrl || null);
  const [index, setIndex] = useState(0);
  const tryingRef = useRef(false);

  // Reset when article changes
  useEffect(() => {
    setImageUrl(initialImageUrl || null);
    setIndex(0);
    tryingRef.current = false;
  }, [initialImageUrl]);

  // When there is no image yet, try to find from sources (limited attempts to avoid many requests)
  useEffect(() => {
    if (imageUrl) return; // already have an image
    if (!urls || urls.length === 0) return;
    if (tryingRef.current) return;

    let cancelled = false;
    const maxTries = Math.min(urls.length, 5); // cap client trials to 5 sources

    const tryFromSources = async () => {
      tryingRef.current = true;
      for (let i = index; i < maxTries; i++) {
        if (cancelled) break;
        try {
          const target = urls[i];
          const resp = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(target)}`);
          if (!resp.ok) continue;
          const html = await resp.text();

          const patterns = [
            /<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i,
            /<meta\s+name=["']twitter:image["']\s+content=["']([^"']+)["']/i,
            /<meta\s+itemprop=["']image["']\s+content=["']([^"']+)["']/i,
          ];

          for (const re of patterns) {
            const m = html.match(re);
            if (m && m[1]) {
              if (!cancelled) setImageUrl(m[1]);
              tryingRef.current = false;
              return;
            }
          }
        } catch {
          // ignore and try next
        }
        if (!cancelled) setIndex(i + 1);
      }
      tryingRef.current = false;
    };

    tryFromSources();
    return () => {
      cancelled = true;
    };
  }, [imageUrl, urls, index]);

  const handleImageError = () => {
    // Current candidate failed. Clear and try the next source
    if (urls && index < urls.length) {
      setImageUrl(null);
      setIndex(index + 1);
      tryingRef.current = false;
    } else {
      setImageUrl(null);
    }
  };

  return { imageUrl, handleImageError };
}
