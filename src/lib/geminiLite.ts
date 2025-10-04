import { GoogleGenAI } from '@google/genai';
import { isHealthRelated } from '@/lib/textAnalysis';
import { OJAS_LITE_SYSTEM } from './systemPrompts';
import { languageStore } from './languageStore';

const API_KEY = (import.meta.env?.VITE_GEMINI_API_KEY as string) || '';


class GeminiLiteService {
  private ai: GoogleGenAI;
  private model: string = 'gemini-2.5-flash-lite-preview-09-2025';

  constructor() {
    if (!API_KEY) {
      console.warn('Gemini API key missing: set VITE_GEMINI_API_KEY in your .env file');
    }
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

  async generateResponse(message: string, options?: { historyText?: string; historyParts?: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }>; forceSearch?: boolean; thinkingBudget?: number; files?: File[]; maxTokens?: number }): Promise<{ content: string; isHealthRelated: boolean; sources?: Array<{ title: string; url: string; snippet?: string; displayUrl?: string }> }> {
    const isHealth = this.isHealthRelated(message);
    const currentTime = this.getCurrentTimeContext();

    const systemPrompt = `${OJAS_LITE_SYSTEM}

${currentTime}

${options?.historyText ? `CONVERSATION HISTORY:\n${options.historyText}` : ''}`;

    // Build conversation with history; append image parts to the final user message
    const userParts: any[] = [{ text: message }];
    if (options?.files && options.files.length > 0) {
      const imageFiles = options.files.filter(f => !!f && typeof f.type === 'string' && f.type.startsWith('image/'));
      if (imageFiles.length > 0) {
        try {
          const inlineParts = await Promise.all(imageFiles.map(f => this.fileToInlinePart(f)));
          userParts.push(...inlineParts);
        } catch (e) {
          console.warn('GeminiLite - Failed to attach one or more images', e);
        }
      }
    }
    const contents: Array<{ role: 'user' | 'model'; parts: any[] }> = options?.historyParts ? 
      [...options.historyParts as any[], { role: 'user' as const, parts: userParts }] : 
      [{ role: 'user' as const, parts: userParts }];

    // Detect if user provided a URL for context analysis (with or without protocol)
    const urlPattern = /(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:[\/?#][^\s]*)?/i;
    const hasUrl = urlPattern.test(message);
    
    // Enable built-in Google Search tool when likely needed for fresh or specific facts
    const doSearch = (
      options?.forceSearch === true ||
      /\b(latest|recent|news|today|yesterday|tomorrow|this week|this month|this year|next week|next month|next year|202[4-9]|update|changed|price|cost|mrp|compare|comparison|availability|stock|buy|where to|market|launch|release|schedule|fixture|fixtures|when|start|date|month|year|season|tournament|ipl|match|guideline|policy|regulation|study|trial|paper|review|india|WHO|FDA|EMA|NICE|best|top|under|rupees|rs|laptop|mobile|phone|graphics|card|rtx|gtx|2050|gaming)\b/i.test(message)
    );
    
    // Removed verbose logging
    const lang = languageStore.get();
    const languageNote = lang && lang.code !== 'en'
      ? `
⚠️ CRITICAL LANGUAGE INSTRUCTION: The user has selected ${lang.label} (${lang.code}).
YOU MUST RESPOND ENTIRELY IN ${lang.label.toUpperCase()}.
Generate ALL content (headers, lists, explanations, examples) directly in ${lang.label}.
DO NOT write in English. Think and respond natively in ${lang.label}.
`
      : '';
    const config: Record<string, any> = { 
      systemInstruction: `${OJAS_LITE_SYSTEM}\n\n${this.getCurrentTimeContext()}${languageNote ? `\n\n${languageNote}` : ''}`,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: options?.maxTokens ?? 8192
      }
    };
    
    // Configure tools based on needs
    const tools: any[] = [];
    if (hasUrl) {
      // Add URL context tool for analyzing provided URLs
      tools.push({ urlContext: {} });
    }
    if (doSearch || hasUrl) {
      // Add Google Search for web searches or to complement URL analysis
      tools.push({ googleSearch: {} });
    }
    
    // Add thinking mode if specified; default to dynamic (-1)
    if (options?.thinkingBudget !== undefined) {
      config.thinkingConfig = { thinkingBudget: options.thinkingBudget, includeThoughts: true };
    } else {
      config.thinkingConfig = { thinkingBudget: -1, includeThoughts: true };
    }
    
    if (tools.length > 0) {
      config.tools = tools;
      if (!config.thinkingConfig) {
        config.thinkingConfig = { thinkingBudget: -1 };
      }
      // Request grounding metadata explicitly
      config.generationConfig.responseSchema = undefined;
      config.generationConfig.candidateCount = 1;
    }

    let full = '';
    let groundingMetadata: any = null;
    try {
      // Starting stream request...
      const streamStartTime = Date.now();
      
      // Create stream with timeout wrapper
      const streamPromise = (async () => {
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
      })();
      
      // Add 30 second timeout
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Stream timeout after 30s')), 30000)
      );
      
      await Promise.race([streamPromise, timeoutPromise]);
      
      // Stream completed
    } catch (streamErr) {
      console.warn('GeminiLite stream failed, retrying non-stream...', streamErr);
      try {
        const nonStreamStartTime = Date.now();
        const nonStream = await this.withRetry(() => this.ai.models.generateContent({ model: this.model, config, contents }));
        const t: any = (nonStream as any).text;
        full = typeof t === 'function' ? t.call(nonStream) || '' : (t ?? '');
        const cand = (nonStream as any)?.candidates?.[0];
        if (cand?.groundingMetadata) groundingMetadata = cand.groundingMetadata;
        // Non-stream completed
      } catch (nonStreamErr) {
        console.error('GeminiLite non-stream also failed', nonStreamErr);
        throw nonStreamErr;
      }
    }

    // Validate response
    if (!full || full.trim().length === 0) {
      console.error('GeminiLite - Empty response received');
      throw new Error('Empty response from model');
    }
    // Extract sources from grounding metadata
    const sources = this.extractSources(groundingMetadata);
    return {
      content: full,
      isHealthRelated: isHealth,
      sources: sources.length > 0 ? sources : undefined,
    };
  }

  // Stream response with real-time chunks. Calls onChunk for each delta and returns controller + finished promise.
  public streamResponse(
    message: string,
    options: { historyText?: string; historyParts?: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }>; forceSearch?: boolean; thinkingBudget?: number; files?: File[]; maxTokens?: number } | undefined,
    onChunk?: (delta: string) => void,
    onEvent?: (evt: any) => void
  ): { stop: () => void; finished: Promise<{ content: string; isHealthRelated: boolean; sources?: Array<{ title: string; url: string; snippet?: string; displayUrl?: string }> }> } {
    let stopped = false;
    const finished = (async () => {
      const isHealth = this.isHealthRelated(message);
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
      const contents: Array<{ role: 'user' | 'model'; parts: any[] }> = options?.historyParts ?
        [...options.historyParts as any[], { role: 'user' as const, parts: userParts }] :
        [{ role: 'user' as const, parts: userParts }];

      const urlPattern = /(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:[\/?#][^\s]*)?/i;
      const hasUrl = urlPattern.test(message);
      const doSearch = (
        options?.forceSearch === true ||
        /\b(latest|recent|news|today|yesterday|tomorrow|this week|this month|this year|next week|next month|next year|202[4-9]|update|changed|price|cost|mrp|compare|comparison|availability|stock|buy|where to|market|launch|release|schedule|fixture|fixtures|when|start|date|month|year|season|tournament|ipl|match|guideline|policy|regulation|study|trial|paper|review|india|WHO|FDA|EMA|NICE|best|top|under|rupees|rs|laptop|mobile|phone|graphics|card|rtx|gtx|2050|gaming)\b/i.test(message)
      );
      const lang = languageStore.get();
      const languageNote = lang && lang.code !== 'en'
        ? `
⚠️ CRITICAL LANGUAGE INSTRUCTION: The user has selected ${lang.label} (${lang.code}).
YOU MUST RESPOND ENTIRELY IN ${lang.label.toUpperCase()}.
Generate ALL content (headers, lists, explanations, examples) directly in ${lang.label}.
DO NOT write in English. Think and respond natively in ${lang.label}.
`
        : '';
      const config: Record<string, any> = {
        systemInstruction: `${OJAS_LITE_SYSTEM}\n\n${this.getCurrentTimeContext()}${languageNote ? `\n\n${languageNote}` : ''}`,
        generationConfig: { temperature: 0.7, maxOutputTokens: options?.maxTokens ?? 8192 }
      };
      const tools: any[] = [];
      if (hasUrl) tools.push({ urlContext: {} });
      if (doSearch || hasUrl) tools.push({ googleSearch: {} });
      if (options?.thinkingBudget !== undefined) (config as any).thinkingConfig = { thinkingBudget: options.thinkingBudget, includeThoughts: true };
      else (config as any).thinkingConfig = { thinkingBudget: -1, includeThoughts: true };
      if (tools.length > 0) {
        (config as any).tools = tools;
        if (!(config as any).thinkingConfig) (config as any).thinkingConfig = { thinkingBudget: -1, includeThoughts: true };
        (config as any).generationConfig.responseSchema = undefined;
        (config as any).generationConfig.candidateCount = 1;
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
      if (!full || full.trim().length === 0) {
        return { content: 'I could not generate a response this time.', isHealthRelated: false };
      }
      const sources = this.extractSources(groundingMetadata);
      return { content: full, isHealthRelated: isHealth, sources: sources.length ? sources : undefined };
    })();
    return { stop: () => { stopped = true; }, finished };
  }
}

export const geminiLiteService = new GeminiLiteService();
