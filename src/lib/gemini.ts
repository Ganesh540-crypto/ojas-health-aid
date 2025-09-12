import { GoogleGenAI } from '@google/genai';
import { detectTone, isHealthRelated } from './textAnalysis';
import { OJAS_HEALTH_SYSTEM } from './systemPrompts';

// Using Gemini built-in Google Search; legacy googleSearch service removed

const API_KEY = (import.meta.env?.VITE_GEMINI_API_KEY as string) || '';


export class GeminiService {
  private ai: GoogleGenAI;
  private model: string = 'gemini-2.5-flash';
  private conversationHistory: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];
  private conversationMemory: string[] = [];

  constructor() {
    if (!API_KEY) console.warn('Gemini API key missing: set VITE_GEMINI_API_KEY in your .env file');
    this.ai = new GoogleGenAI({ apiKey: API_KEY });
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
            const web = chunk.web;
            const raw = web.uri || '';
            const clean = this.unwrapRedirect(raw);
            let finalUrl = clean; // keep redirect link if not decodable
            let displayHost: string | null = null;
            try {
              const u = new URL(ensureHttp(clean));
              if (isRedirectHost(u.hostname)) {
                const fromTitle = pickDomainFromTitle(web.title);
                if (fromTitle) displayHost = fromTitle;
              } else {
                displayHost = u.hostname.replace(/^www\./, '');
              }
            } catch {
              const fromTitle = pickDomainFromTitle(web.title);
              if (fromTitle) displayHost = fromTitle;
            }
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
    }
  ): Promise<{ content: string; isHealthRelated: boolean; sources?: Array<{ title: string; url: string; snippet?: string; displayUrl?: string }> }> {
    const isHealth = this.isHealthRelated(message);
    const forceSearch = options?.forceSearch || this.shouldPerformWebSearch(message);
    const currentTime = this.getCurrentTimeContext();

    // Build conversation history with provided parts or existing history
    const history = options?.historyParts || this.conversationHistory;
    const contents = [...history, { role: 'user' as const, parts: [{ text: message }] }];

    // Always use web search for health queries
    const config: Record<string, any> = {
      systemInstruction: `${OJAS_HEALTH_SYSTEM}\n\n${currentTime}`,
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 8192
      }
    };

    // Enable search for health queries or when explicitly requested
    if (forceSearch) {
      config.tools = [{ googleSearch: {} }];
    }

    let full = '';
    let groundingMetadata: any = null;

    try {
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
        console.warn('Stream failed, retrying non-stream request...', streamErr);
        // Fallback to non-streaming request
        try {
          const nonStream = await this.ai.models.generateContent({ model: this.model, config, contents });
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
}

export const geminiService = new GeminiService();