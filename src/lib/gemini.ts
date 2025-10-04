import { GoogleGenAI } from '@google/genai';
import { detectTone, isHealthRelated } from './textAnalysis';
import { OJAS_HEALTH_SYSTEM } from './systemPrompts';
import { languageStore } from './languageStore';

// Using Gemini built-in Google Search; legacy googleSearch service removed

const API_KEY = (import.meta.env?.VITE_GEMINI_API_KEY as string) || '';


export class GeminiService {
  private ai: GoogleGenAI;
  private model: string = 'gemini-2.5-flash-preview-09-2025';
  private conversationHistory: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];
  private conversationMemory: string[] = [];

  constructor() {
    if (!API_KEY) console.warn('Gemini API key missing: set VITE_GEMINI_API_KEY in your .env file');
    this.ai = new GoogleGenAI({ apiKey: API_KEY });
  }

  // Lightweight retry helper for transient API failures (e.g., 503)
  private async withRetry<T>(fn: () => Promise<T>, tries = 2, delayMs = 700): Promise<T> {
    let lastErr: any;
    for (let i = 0; i < tries; i++) {
      try {
        return await fn();
      } catch (err) {
        lastErr = err;
        if (i === tries - 1) break;
        await new Promise(res => setTimeout(res, delayMs));
      }
    }
    throw lastErr;
  }

  // Convert a File to a Gemini inlineData part (base64)
  private async fileToInlinePart(file: File): Promise<{ inlineData: { data: string; mimeType: string } }> {
    return new Promise((resolve, reject) => {
      try {
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const result = String(reader.result || '');
            const base64 = result.includes(',') ? result.split(',')[1] : result; // dataURL -> base64
            resolve({ inlineData: { data: base64, mimeType: file.type || 'application/octet-stream' } });
          } catch (e) { reject(e); }
        };
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(file);
      } catch (e) {
        reject(e);
      }
    });
  }

  private isHealthRelated(message: string) { return isHealthRelated(message); }

  private shouldPerformWebSearch(message: string): boolean {
    // Search when recency/specificity likely matters; expanded for shopping queries
    const lower = message.toLowerCase();
    const recencyRegex = /\b(latest|recent|news|today|yesterday|tomorrow|this week|this month|this year|next week|next month|next year|202[4-9]|update|changed|guideline|policy|regulation|study|trial|paper|review|price|cost|availability|market|compare|comparison|schedule|fixture|fixtures|when|start|date|month|year|season|tournament|ipl|match|release|launch|india|WHO|FDA|EMA|NICE|best|top|under|rupees|rs|laptop|mobile|phone|graphics|card|rtx|gtx|nvidia|amd|intel)\b/i;
    const orgTriggers = ['medtrack','vistora','who created you','who made you','creator'];
    return recencyRegex.test(message) || orgTriggers.some(t => lower.includes(t));
  }

  private isImportantHealthQuery(message: string): boolean {
    const seriousKeywords = [ 'severe','intense','emergency','urgent','serious','can\'t breathe','chest pain','heart attack','stroke','bleeding','unconscious','poisoning','overdose','allergic reaction','broken','fracture','surgery','prescription','diagnosis','treatment plan' ];
    const lower = message.toLowerCase();
    return seriousKeywords.some(k => lower.includes(k));
  }

  private detectToneLocal(message: string) { return detectTone(message); }

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

            // Get the raw URL first
            const rawUrl = candidatesRaw[0] || web.uri || '';
            
            // Try to unwrap/decode the URL
            const decoded = this.unwrapRedirect(rawUrl);
            
            // Check if decoding was successful (URL changed and is not a redirect host)
            let finalUrl: string = rawUrl;
            let displayHost: string | null = null;
            
            try {
              const decodedParsed = new URL(ensureHttp(decoded));
              if (!isRedirectHost(decodedParsed.hostname)) {
                // Successfully decoded to a real article URL
                finalUrl = decodedParsed.toString();
                displayHost = decodedParsed.hostname.replace(/^www\./, '');
              } else {
                // Still a redirect after decoding, keep the original
                finalUrl = rawUrl;
                // Try to get display name from title
                const fromTitle = pickDomainFromTitle(web.title);
                if (fromTitle) displayHost = fromTitle;
              }
            } catch {
              // Decoding failed, keep original URL
              finalUrl = rawUrl;
              const fromTitle = pickDomainFromTitle(web.title);
              if (fromTitle) displayHost = fromTitle;
            }

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

    return unique; // No cap on source count
  }

  private getDisplayUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
  }

  // Try to unwrap common redirector URLs to the true destination
  private unwrapRedirect(raw: string): string {
    try {
      const ensureHttp = (u: string) => /^https?:\/\//i.test(u) ? u : `https://${u}`;
      let u: URL;
      try { u = new URL(raw); } catch { u = new URL(ensureHttp(raw)); }

      // Handle custom schemes like grounding-api-redirect://host/path -> https://host/path
      if (/^grounding/i.test(u.protocol) || /^vertex/i.test(u.protocol) || /^genai/i.test(u.protocol)) {
        if (u.hostname) {
          const rebuilt = `https://${u.hostname}${u.pathname || ''}${u.search || ''}`;
          return rebuilt;
        }
      }

      // Try to decode Vertex grounding redirect token: /grounding-api-redirect/<base64url>
      if (/vertexaisearch\.cloud\.google\.com$/i.test(u.hostname) && /\/grounding-api-redirect\//i.test(u.pathname)) {
        const token = u.pathname.split('/').filter(Boolean).pop() || '';
        const b64 = token.replace(/-/g, '+').replace(/_/g, '/');
        try {
          // Pad base64 if needed
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
        const v = u.searchParams.get(key);
        if (!v) continue;
        try {
          const decoded = decodeURIComponent(v);
          const candidate = new URL(ensureHttp(decoded));
          return candidate.toString();
        } catch { /* ignore and continue */ }
      }
      return u.toString();
    } catch {
      return raw;
    }
  }

  private addToMemory(userMessage: string, response: string, health: boolean) {
    this.conversationHistory.push({ role: 'user', parts: [{ text: userMessage }] }, { role: 'model', parts: [{ text: response }] });
    if (this.conversationHistory.length > 20) this.conversationHistory = this.conversationHistory.slice(-20);
    if (health && this.isImportantHealthQuery(userMessage)) {
      const summary = `User asked about: ${userMessage.substring(0,100)}... - Health consultation provided`;
      this.conversationMemory.push(summary);
      if (this.conversationMemory.length > 5) this.conversationMemory = this.conversationMemory.slice(-5);
    }
  }

  async generateResponse(
    message: string,
    options?: {
      historyParts?: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }>;
      forceSearch?: boolean;
      thinkingBudget?: number;
      files?: File[];
    }
  ): Promise<{ content: string; isHealthRelated: boolean; sources?: Array<{ title: string; url: string; snippet?: string; displayUrl?: string }> }> {
    const isHealth = this.isHealthRelated(message);
    const forceSearch = (options?.forceSearch ?? false) || this.shouldPerformWebSearch(message);
    const currentTime = this.getCurrentTimeContext();

    // Build conversation history with provided parts or existing history
    const history = options?.historyParts || this.conversationHistory;
    const userParts: any[] = [{ text: message }];
    if (options?.files && options.files.length > 0) {
      const imageFiles = options.files.filter(f => !!f && typeof f.type === 'string' && f.type.startsWith('image/'));
      if (imageFiles.length > 0) {
        try {
          const inlineParts = await Promise.all(imageFiles.map(f => this.fileToInlinePart(f)));
          userParts.push(...inlineParts);
        } catch (e) {
          console.warn('Gemini (full) - Failed to attach one or more images', e);
        }
      }
    }
    const contents = [...history, { role: 'user' as const, parts: userParts }];

    // Always use web search for health queries
    const lang = languageStore.get();
    const languageNote = (() => {
      if (!lang?.code) return '';
      const target = lang.label || 'English';
      const code = lang.code;
      return `\nCRITICAL LANGUAGE INSTRUCTION: The user selected ${target} (${code}).\nRespond ENTIRELY in ${target}. Do not switch languages mid-answer.\nNever default to Hindi. If ${code}==='en', use natural English.`;
    })();
    const config: Record<string, any> = {
      systemInstruction: `${OJAS_HEALTH_SYSTEM}\n\n${currentTime}${languageNote ? `\n\n${languageNote}` : ''}`,
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 8192
      }
    };

    // Add thinking mode if specified
    if (options?.thinkingBudget !== undefined) {
      config.thinkingConfig = { thinkingBudget: options.thinkingBudget };
    }

    // Always enable Google Search tool for full model responses
    config.tools = [{ googleSearch: {} }];

    let full = '';
    let groundingMetadata: any = null;

    try {
      try {
        const response: any = await this.withRetry(() => this.ai.models.generateContentStream({ model: this.model, config, contents }) as any);
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
        console.warn('Stream failed, retrying non-stream request...', streamErr);
        // Fallback to non-streaming request
        try {
          const nonStream = await this.withRetry(() => this.ai.models.generateContent({ model: this.model, config, contents }));
          // Support both getter and method styles for text on different SDK versions
          const t: any = (nonStream as any).text;
          full = typeof t === 'function' ? t.call(nonStream) || '' : (t ?? '');
          // Pull grounding from candidates if present
          const cand = (nonStream as any)?.candidates?.[0];
          if (cand?.groundingMetadata) groundingMetadata = cand.groundingMetadata;
        } catch (nonStreamErr) {
          console.error('Non-stream also failed', nonStreamErr);
          throw nonStreamErr;
        }
      }

      // Extract sources from grounding metadata
      const sources = this.extractSources(groundingMetadata);

      const finalText = full || 'I could not generate a response this time.';
      this.addToMemory(message, finalText, isHealth);
      return { content: finalText, isHealthRelated: isHealth, sources: sources.length > 0 ? sources : undefined };

    } catch (e) {
      console.error('Gemini API Error:', e);
      return { content: 'I encountered an error processing that. Please retry.', isHealthRelated: false, sources: undefined };
    }
  }

  // Stream response with real-time chunks for the full health model
  public streamResponse(
    message: string,
    options?: {
      historyParts?: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }>;
      forceSearch?: boolean;
      thinkingBudget?: number;
      files?: File[];
    },
    onChunk?: (delta: string) => void,
    onEvent?: (evt: any) => void
  ): { stop: () => void; finished: Promise<{ content: string; isHealthRelated: boolean; sources?: Array<{ title: string; url: string; snippet?: string; displayUrl?: string }> }> } {
    let stopped = false;
    const finished = (async () => {
      const isHealth = this.isHealthRelated(message);
      const history = options?.historyParts || this.conversationHistory;
      const userParts: any[] = [{ text: message }];
      if (options?.files && options.files.length > 0) {
        const imageFiles = options.files.filter(f => !!f && typeof f.type === 'string' && f.type.startsWith('image/'));
        if (imageFiles.length > 0) {
          try {
            const inlineParts = await Promise.all(imageFiles.map(f => this.fileToInlinePart(f)));
            userParts.push(...inlineParts);
          } catch {}
        }
      }
      const contents = [...history, { role: 'user' as const, parts: userParts }];

      const lang = languageStore.get();
      const languageNote = (() => {
        if (!lang?.code) return '';
        const target = lang.label || 'English';
        const code = lang.code;
        return `\nCRITICAL LANGUAGE INSTRUCTION: The user selected ${target} (${code}).\nRespond ENTIRELY in ${target}. Do not switch languages mid-answer.\nNever default to Hindi. If ${code}==='en', use natural English.`;
      })();
      const config: Record<string, any> = {
        systemInstruction: `${OJAS_HEALTH_SYSTEM}\n\n${this.getCurrentTimeContext()}${languageNote ? `\n\n${languageNote}` : ''}`,
        generationConfig: { temperature: 0.8, maxOutputTokens: 8192 },
      };
      if (options?.thinkingBudget !== undefined) {
        (config as any).thinkingConfig = { thinkingBudget: options.thinkingBudget, includeThoughts: true };
      } else {
        (config as any).thinkingConfig = { thinkingBudget: -1, includeThoughts: true };
      }
      if (options?.forceSearch || true) {
        (config as any).tools = [{ googleSearch: {} }];
      }

      let full = '';
      let groundingMetadata: any = null;
      const seenQueries = new Set<string>();
      const emitEvents = (chunk: any) => {
        try {
          const cand = (chunk as any)?.candidates?.[0];
          const th = (cand as any)?.thoughts ?? (chunk as any)?.thoughts;
          if (typeof th === 'string') onEvent?.({ type: 'thought', text: th });
          if (Array.isArray(th)) th.forEach((t: any) => {
            const txt = typeof t === 'string' ? t : (t?.text ?? '');
            if (txt) onEvent?.({ type: 'thought', text: txt });
          });
          const parts = (cand as any)?.content?.parts || [];
          for (const p of parts) {
            const ttxt = p?.thought || (p?.text && /thought/i.test(p?.mimeType || '')) ? p.text : undefined;
            if (ttxt) onEvent?.({ type: 'thought', text: ttxt });
            const inv = p?.toolInvocation || p?.functionCall || p?.toolRequest;
            const q = inv?.googleSearch?.query || inv?.google_search?.query || inv?.googleSearch?.args?.query;
            if (q && !seenQueries.has(q)) { seenQueries.add(q); onEvent?.({ type: 'search_query', query: q }); }
          }
          const gm = (chunk as any).groundingMetadata || (cand as any)?.groundingMetadata;
          const qs = gm?.searchQueries || gm?.webSearchQueries || gm?.queries;
          if (Array.isArray(qs)) qs.forEach((q: any) => { if (q && !seenQueries.has(String(q))) { seenQueries.add(String(q)); onEvent?.({ type: 'search_query', query: String(q) }); } });
        } catch {}
      };
      try {
        const response: any = await this.withRetry(() => this.ai.models.generateContentStream({ model: this.model, config, contents }) as any);
        for await (const chunk of response) {
          if (stopped) break;
          if ((chunk as any).groundingMetadata) groundingMetadata = (chunk as any).groundingMetadata;
          if ((chunk as any).candidates?.[0]?.groundingMetadata) groundingMetadata = (chunk as any).candidates[0].groundingMetadata;
          emitEvents(chunk);
          if (chunk.text) {
            full += chunk.text;
            onChunk?.(chunk.text);
          }
        }
      } catch {
        try {
          const nonStream = await this.withRetry(() => this.ai.models.generateContent({ model: this.model, config, contents }));
          const t: any = (nonStream as any).text;
          full = typeof t === 'function' ? t.call(nonStream) || '' : (t ?? '');
          const cand = (nonStream as any)?.candidates?.[0];
          if (cand?.groundingMetadata) groundingMetadata = cand.groundingMetadata;
          if (!stopped && full) onChunk?.(full);
        } catch {}
      }

      const sources = this.extractSources(groundingMetadata);
      const finalText = full || 'I could not generate a response this time.';
      this.addToMemory(message, finalText, isHealth);
      return { content: finalText, isHealthRelated: isHealth, sources: sources.length ? sources : undefined };
    })();
    return { stop: () => { stopped = true; }, finished };
  }
}

export const geminiService = new GeminiService();