import { GoogleGenAI } from '@google/genai';
import { isHealthRelated } from '@/lib/textAnalysis';
import { OJAS_LITE_SYSTEM } from './systemPrompts';

const API_KEY = (import.meta.env?.VITE_GEMINI_API_KEY as string) || '';


class GeminiLiteService {
  private ai: GoogleGenAI;
  private model: string = 'gemini-2.5-flash-lite';

  constructor() {
    if (!API_KEY) {
      console.warn('Gemini API key missing: set VITE_GEMINI_API_KEY in your .env file');
    }

    this.ai = new GoogleGenAI({ apiKey: API_KEY });
  }

  private isHealthRelated(message: string): boolean { return isHealthRelated(message); }

  private getCurrentTimeContext(): string {
    try {
      const now = new Date();
      const iso = now.toISOString();
      const local = now.toLocaleString(undefined, { hour12: false });
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'local';
      return `CURRENT DATETIME\nISO: ${iso}\nLocal (${tz}): ${local}`;
    } catch {
      return `CURRENT DATETIME\nISO: ${new Date().toISOString()}`;
    }
  }

  // Try to unwrap common redirector URLs to the true destination
  private unwrapRedirect(raw: string): string {
    try {
      const ensureHttp = (u: string) => /^https?:\/\//i.test(u) ? u : `https://${u}`;
      let primary: URL;
      try {
        primary = new URL(raw);
      } catch {
        primary = new URL(ensureHttp(raw));
      }

      // Handle custom schemes like grounding-api-redirect://host/path -> https://host/path
      if (/^grounding/i.test(primary.protocol) || /^vertex/i.test(primary.protocol) || /^genai/i.test(primary.protocol)) {
        if (primary.hostname) {
          const rebuilt = `https://${primary.hostname}${primary.pathname || ''}${primary.search || ''}`;
          return rebuilt;
        }
      }

      // Try to decode Vertex grounding redirect token: /grounding-api-redirect/<base64url>
      if (/vertexaisearch\.cloud\.google\.com$/i.test(primary.hostname) && /\/grounding-api-redirect\//i.test(primary.pathname)) {
        const token = primary.pathname.split('/').filter(Boolean).pop() || '';
        const b64 = token.replace(/-/g, '+').replace(/_/g, '/');
        try {
          const pad = b64.length % 4 === 2 ? '==' : b64.length % 4 === 3 ? '=' : '';
          const decoded = atob(b64 + pad);
          const match = decoded.match(/https?:\/\/[^\s"']+/);
          if (match && match[0]) {
            return match[0];
          }
        } catch { /* ignore and continue */ }
      }

      const paramsToCheck = ['url', 'q', 'u', 'target', 'dest', 'destination', 'redirect', 'redirect_uri'];
      for (const key of paramsToCheck) {
        const v = primary.searchParams.get(key);
        if (!v) continue;
        try {
          const decoded = decodeURIComponent(v);
          const candidate = new URL(ensureHttp(decoded));
          return candidate.toString();
        } catch { /* ignore and continue */ }
      }
      return primary.toString();
    } catch {
      return raw;
    }
  }

  private extractSources(groundingMetadata: any): Array<{ title: string; url: string; snippet?: string; displayUrl?: string }> {
    if (!groundingMetadata?.groundingSupports) return [];
    
    const sources: Array<{ title: string; url: string; snippet?: string; displayUrl?: string }> = [];
    const ensureHttp = (u: string) => /^https?:\/\//i.test(u) ? u : `https://${u}`;
    const isRedirectHost = (host: string) => {
      const h = (host || '').toLowerCase();
      return (
        h === 'vertexaisearch.cloud.google.com' ||
        h.endsWith('.googleusercontent.com') ||
        h === 'google.com' || h === 'www.google.com' ||
        h === 'gemini.google.com' ||
        h.endsWith('.google.com')
      );
    };
    const pickDomainFromTitle = (title?: string): string | null => {
      if (!title) return null;
      const t = title.trim();
      const full = /^(?:[a-z0-9-]+\.)+[a-z]{2,}$/i;
      if (full.test(t)) return t.toLowerCase();
      const any = /([a-z0-9-]+(?:\.[a-z0-9-]+)+)/i;
      const m = t.match(any);
      return m?.[1]?.toLowerCase() || null;
    };
    
    for (const support of groundingMetadata.groundingSupports) {
      if (support?.segment?.startIndex !== undefined && support?.groundingChunkIndices) {
        for (const chunkIndex of support.groundingChunkIndices) {
          const chunk = groundingMetadata.groundingChunks?.[chunkIndex];
          if (chunk?.web) {
            const web = chunk.web as Record<string, any>;
            const candidatesRaw: string[] = [];
            // Collect as many potential URL fields as possible
            for (const key of ['uri','url','link','pageUrl','pageUri','sourceUrl','source_uri','displayUri','displayUrl','canonicalUrl','canonicalUri','resolvedUrl','resolvedUri','openGraphUrl']) {
              if (typeof web[key] === 'string' && web[key]) candidatesRaw.push(web[key]);
            }
            if (candidatesRaw.length === 0 && typeof web === 'string') candidatesRaw.push(String(web));

            // Unwrap each candidate
            const candidates = candidatesRaw.map(v => this.unwrapRedirect(v)).filter(Boolean);

            // Choose best URL to click (prefer a non-redirect article link; else first available even if redirect)
            let finalUrl: string | null = null;
            let displayHost: string | null = null;
            for (const c of candidates) {
              try {
                const u = new URL(ensureHttp(c));
                if (!isRedirectHost(u.hostname)) { finalUrl = u.toString(); displayHost = u.hostname.replace(/^www\./, ''); break; }
              } catch { /* ignore */ }
            }
            if (!finalUrl) {
              for (const c of candidates) {
                try { const u = new URL(ensureHttp(c)); finalUrl = u.toString(); displayHost = isRedirectHost(u.hostname) ? null : u.hostname.replace(/^www\./, ''); break; } catch { /* ignore */ }
              }
            }
            if (!finalUrl) {
              // As last resort, use domain from title for display; but avoid turning it into the link
              const fromTitle = pickDomainFromTitle(web.title);
              if (fromTitle) displayHost = fromTitle;
            }
            if (!finalUrl) finalUrl = 'about:blank';

            // If final link is still a redirect host, prefer to show the domain from title in displayUrl
            try {
              const u = new URL(ensureHttp(finalUrl));
              if (!displayHost) {
                displayHost = isRedirectHost(u.hostname) ? (pickDomainFromTitle(web.title) || u.hostname.replace(/^www\./, '')) : u.hostname.replace(/^www\./, '');
              }
            } catch { /* ignore */ }

            sources.push({
              title: web.title || 'Web Source',
              url: finalUrl,
              snippet: web.snippet || undefined,
              displayUrl: displayHost ?? this.getDisplayUrl(finalUrl)
            });
          }
        }
      }
    }
    
    // Remove duplicates based on URL
    const unique = sources.filter((source, index, self) => 
      index === self.findIndex(s => s.url === source.url)
    );
    
    return unique.slice(0, 6); // Limit to 6 sources
  }

  private getDisplayUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
  }

  async generateResponse(message: string, options?: { historyText?: string; forceSearch?: boolean }): Promise<{ content: string; isHealthRelated: boolean; sources?: Array<{ title: string; url: string; snippet?: string; displayUrl?: string }> }>{
    const isHealth = this.isHealthRelated(message);
    const currentTime = this.getCurrentTimeContext();

    const systemPrompt = `${OJAS_LITE_SYSTEM}

${currentTime}

${options?.historyText ? `CONVERSATION HISTORY:\n${options.historyText}` : ''}`;

    const contents: Array<{ role: 'user'; parts: { text: string }[] }> = [{ role: 'user', parts: [{ text: message }] }];

    // Enable built-in Google Search tool when likely needed for fresh or specific facts
    const doSearch = (
      options?.forceSearch === true ||
      /\b(latest|recent|news|today|yesterday|tomorrow|this week|this month|this year|next week|next month|next year|202[4-9]|update|changed|price|cost|mrp|compare|comparison|availability|stock|buy|where to|market|launch|release|schedule|fixture|fixtures|when|start|date|month|year|season|tournament|ipl|match|guideline|policy|regulation|study|trial|paper|review|india|WHO|FDA|EMA|NICE|best|top|under|rupees|rs|laptop|mobile|phone|graphics|card|rtx|gtx|2050|gaming)\b/i.test(message)
    );
    
    console.log('GeminiLite - Message:', message);
    console.log('GeminiLite - Search trigger test result:', /\b(latest|recent|news|today|this week|202[4-9]|update|changed|price|cost|mrp|compare|comparison|availability|stock|buy|where to|market|launch|release|guideline|policy|regulation|study|trial|paper|review|india|WHO|FDA|EMA|NICE|best|top|under|rupees|rs|laptop|mobile|phone|graphics|card|rtx|gtx|2050|gaming)\b/i.test(message));
    console.log('GeminiLite - Force search:', options?.forceSearch);
    console.log('GeminiLite - Final doSearch decision:', doSearch);
    const config: Record<string, any> = { 
      systemInstruction: `${OJAS_LITE_SYSTEM}\n\n${this.getCurrentTimeContext()}`,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 8192
      }
    };
    if (doSearch) {
      config.tools = [{ googleSearch: {} }];
      config.thinkingConfig = { thinkingBudget: -1 };
      // Request grounding metadata explicitly
      config.generationConfig.responseSchema = undefined;
      config.generationConfig.candidateCount = 1;
    }

    let full = '';
    let groundingMetadata: any = null;
    try {
      const response = await this.ai.models.generateContentStream({ model: this.model, config, contents });
      for await (const chunk of response) {
        if (chunk.text) full += chunk.text;
        if ((chunk as any).groundingMetadata) {
          groundingMetadata = (chunk as any).groundingMetadata;
        }
        if ((chunk as any).candidates?.[0]?.groundingMetadata) {
          groundingMetadata = (chunk as any).candidates[0].groundingMetadata;
        }
      }
    } catch (streamErr) {
      console.warn('GeminiLite stream failed, retrying non-stream...', streamErr);
      try {
        const nonStream = await this.ai.models.generateContent({ model: this.model, config, contents });
        const t: any = (nonStream as any).text;
        full = typeof t === 'function' ? t.call(nonStream) || '' : (t ?? '');
        const cand = (nonStream as any)?.candidates?.[0];
        if (cand?.groundingMetadata) groundingMetadata = cand.groundingMetadata;
      } catch (nonStreamErr) {
        console.error('GeminiLite non-stream also failed', nonStreamErr);
        throw nonStreamErr;
      }
    }

    // Debug: log search configuration
    console.log('GeminiLite - Search enabled:', doSearch, 'Config tools:', config.tools);
    console.log('GeminiLite - Message:', message);
    
    // Extract sources from grounding metadata
    const sources = this.extractSources(groundingMetadata);
    console.log('GeminiLite - Extracted sources:', sources);

    return {
      content: full || 'Sorry, I could not generate a response. Please try again.',
      isHealthRelated: isHealth,
      sources: sources.length > 0 ? sources : undefined,
    };
  }
}

export const geminiLiteService = new GeminiLiteService();
