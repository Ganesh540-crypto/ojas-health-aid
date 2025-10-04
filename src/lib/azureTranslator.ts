/* Azure Translator (Text Translation API v3)
 * Client-side usage requires exposing an API key. For production, proxy via a serverless function.
 */

export type TranslateOptions = {
  from?: string; // BCP-47 code; if omitted, auto-detect
  to: string;    // BCP-47 code
};

const KEY = (import.meta.env?.VITE_AZURE_TRANSLATOR_KEY as string) || '';
const REGION = (import.meta.env?.VITE_AZURE_TRANSLATOR_REGION as string) || '';
// You can use either the global endpoint host or your custom resource endpoint host
// Examples:
// - Global: https://api.cognitive.microsofttranslator.com
// - Custom: https://<resource>.cognitiveservices.azure.com
const BASE = (import.meta.env?.VITE_AZURE_TRANSLATOR_ENDPOINT as string) || 'https://api.cognitive.microsofttranslator.com';
const PROXY = (import.meta.env?.VITE_TRANSLATOR_PROXY_URL as string) || '';

function buildTranslateUrl(base: string): URL {
  // If base already contains the 'translator/text/v3.0' path, append '/translate'.
  // If base is the global host, the path is just '/translate'. For custom host, path is '/translator/text/v3.0/translate'.
  try {
    const u = new URL(base);
    const host = u.host.toLowerCase();
    const hasVersionPath = /\/translator\/text\/v3\.0/i.test(u.pathname);
    if (hasVersionPath) {
      // ensure single trailing slash then translate
      const pathname = u.pathname.replace(/\/?$/, '/');
      return new URL(pathname + 'translate', u.origin);
    }
    if (host === 'api.cognitive.microsofttranslator.com') {
      return new URL('/translate', u.origin);
    }
    // custom domain
    return new URL('/translator/text/v3.0/translate', u.origin);
  } catch {
    // Fallback to global
    return new URL('/translate', 'https://api.cognitive.microsofttranslator.com');
  }
}

// In-memory cache: key -> translated text
// key format: `${to}|${from || 'auto'}|${text}`
const cache = new Map<string, string>();

function keyFor(text: string, to: string, from?: string) {
  return `${to}|${from || 'auto'}|${text}`;
}

async function translateText(text: string, opts: TranslateOptions): Promise<string> {
  const { to, from } = opts;
  if (!text) return '';
  if (!to || to === 'en' && (!from || from === 'en')) return text;

  const ck = keyFor(text, to, from);
  const cached = cache.get(ck);
  if (cached !== undefined) return cached;

  // Use proxy if configured (recommended for production)
  if (PROXY) {
    try {
      const res = await fetch(PROXY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texts: [text], to, from })
      });
      if (!res.ok) throw new Error(`Proxy HTTP ${res.status}`);
      const data = await res.json();
      const arr: string[] | undefined = Array.isArray(data) ? data : data?.translations;
      const out = arr?.[0] ?? text;
      cache.set(ck, out);
      return out;
    } catch (e) {
      console.warn('Translator proxy failed; falling back to client mode', e);
      // fallthrough to direct
    }
  }

  if (!KEY || !REGION) {
    console.warn('Azure Translator key/region missing. Returning original text.');
    return text;
  }

  try {
    const url = buildTranslateUrl(BASE);
    url.searchParams.set('api-version', '3.0');
    url.searchParams.set('to', to);
    if (from) url.searchParams.set('from', from);

    const res = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': KEY,
        'Ocp-Apim-Subscription-Region': REGION,
        'Content-Type': 'application/json; charset=UTF-8'
      },
      body: JSON.stringify([{ Text: text }])
    });
    if (!res.ok) throw new Error(`Translator HTTP ${res.status}`);
    const data = await res.json();
    const translated: string | undefined = data?.[0]?.translations?.[0]?.text;
    const out = translated ?? text;
    cache.set(ck, out);
    return out;
  } catch (e) {
    console.warn('Azure translateText failed:', e);
    return text;
  }
}

async function translateBatch(texts: string[], opts: TranslateOptions): Promise<string[]> {
  const { to, from } = opts;
  if (texts.length === 0) return [];

  // Fast-path: prepare result with cached items; collect misses
  const results: string[] = new Array(texts.length);
  const missIndices: number[] = [];
  const missPayload: { Text: string }[] = [];

  for (let i = 0; i < texts.length; i++) {
    const t = texts[i];
    if (!t) { results[i] = ''; continue; }
    if (!to || (to === 'en' && (!from || from === 'en'))) { results[i] = t; continue; }
    const ck = keyFor(t, to, from);
    const cached = cache.get(ck);
    if (cached !== undefined) {
      results[i] = cached;
    } else {
      missIndices.push(i);
      missPayload.push({ Text: t });
    }
  }

  if (missIndices.length === 0) return results;

  // Use proxy if configured for batch
  if (PROXY) {
    try {
      const res = await fetch(PROXY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texts, to, from })
      });
      if (!res.ok) throw new Error(`Proxy HTTP ${res.status}`);
      const data = await res.json();
      const arr: string[] | undefined = Array.isArray(data) ? data : data?.translations;
      if (Array.isArray(arr) && arr.length === texts.length) {
        // cache results
        for (let i = 0; i < texts.length; i++) {
          cache.set(keyFor(texts[i], to, from), arr[i]);
        }
        return arr;
      }
    } catch (e) {
      console.warn('Translator proxy (batch) failed; falling back to client mode', e);
      // fallthrough to direct
    }
  }

  if (!KEY || !REGION) {
    console.warn('Azure Translator key/region missing for batch. Returning originals for misses.');
    missIndices.forEach((idx) => { results[idx] = texts[idx]; });
    return results;
  }

  try {
    const url = buildTranslateUrl(BASE);
    url.searchParams.set('api-version', '3.0');
    url.searchParams.set('to', to);
    if (from) url.searchParams.set('from', from);

    // Azure Translator accepts up to 100 elements per request; chunk accordingly
    const chunkSize = 90;
    let processed = 0;
    while (processed < missIndices.length) {
      const chunkIndices = missIndices.slice(processed, processed + chunkSize);
      const chunkPayload = chunkIndices.map((idx) => ({ Text: texts[idx] }));

      const res = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': KEY,
          'Ocp-Apim-Subscription-Region': REGION,
          'Content-Type': 'application/json; charset=UTF-8'
        },
        body: JSON.stringify(chunkPayload)
      });
      if (!res.ok) throw new Error(`Translator HTTP ${res.status}`);
      const data = await res.json();
      for (let i = 0; i < chunkIndices.length; i++) {
        const idx = chunkIndices[i];
        const translated: string | undefined = data?.[i]?.translations?.[0]?.text;
        const out = translated ?? texts[idx];
        results[idx] = out;
        cache.set(keyFor(texts[idx], to, from), out);
      }
      processed += chunkIndices.length;
    }
  } catch (e) {
    console.warn('Azure translateBatch failed:', e);
    // Fill misses with originals
    missIndices.forEach((idx) => { results[idx] = texts[idx]; });
  }

  return results;
}

export const azureTranslator = {
  translateText,
  translateBatch,
};
