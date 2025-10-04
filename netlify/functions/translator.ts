// Netlify Function: Azure Translator proxy
// Protects API keys by running on server side

const KEY = process.env.AZURE_TRANSLATOR_KEY || '';
const REGION = process.env.AZURE_TRANSLATOR_REGION || '';
const ENDPOINT = process.env.AZURE_TRANSLATOR_ENDPOINT || 'https://api.cognitive.microsofttranslator.com';

function buildTranslateUrl(base: string): URL {
  try {
    const u = new URL(base);
    const host = u.host.toLowerCase();
    const hasVersionPath = /\/translator\/text\/v3\.0/i.test(u.pathname);
    if (hasVersionPath) {
      const pathname = u.pathname.replace(/\/?$/, '/');
      return new URL(pathname + 'translate', u.origin);
    }
    if (host === 'api.cognitive.microsofttranslator.com') {
      return new URL('/translate', u.origin);
    }
    return new URL('/translator/text/v3.0/translate', u.origin);
  } catch {
    return new URL('/translate', 'https://api.cognitive.microsofttranslator.com');
  }
}

export async function handler(event: any) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  if (!KEY || !REGION) {
    return { statusCode: 500, body: 'Server missing AZURE_TRANSLATOR_KEY or AZURE_TRANSLATOR_REGION' };
  }

  try {
    const { texts, to, from } = JSON.parse(event.body || '{}');
    if (!Array.isArray(texts) || typeof to !== 'string' || !to) {
      return { statusCode: 400, body: 'Invalid payload. Expected { texts: string[], to: string, from?: string }' };
    }

    const url = buildTranslateUrl(ENDPOINT);
    url.searchParams.set('api-version', '3.0');
    url.searchParams.set('to', to);
    if (from) url.searchParams.set('from', from);

    // Chunk into max 90 per request
    const chunkSize = 90;
    const results: string[] = [];
    for (let i = 0; i < texts.length; i += chunkSize) {
      const slice = texts.slice(i, i + chunkSize);
      const res = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': KEY,
          'Ocp-Apim-Subscription-Region': REGION,
          'Content-Type': 'application/json; charset=UTF-8'
        },
        body: JSON.stringify(slice.map((t) => ({ Text: t || '' })))
      });
      if (!res.ok) {
        return { statusCode: res.status, body: await res.text() };
      }
      const data = await res.json();
      const translated = (data || []).map((row: any, idx: number) => row?.translations?.[0]?.text ?? slice[idx] ?? '');
      results.push(...translated);
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(results),
    };
  } catch (e: any) {
    return { statusCode: 500, body: `Translator proxy error: ${e?.message || 'unknown'}` };
  }
}
