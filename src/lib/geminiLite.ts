import { GoogleGenAI } from '@google/genai';
import { isHealthRelated } from '@/lib/textAnalysis';
import { OJAS_LITE_SYSTEM } from './systemPrompts';
import { languageStore } from './languageStore';
// Function-calling removed per latest design: no function tools are offered

const API_KEY = (import.meta.env?.VITE_GEMINI_API_KEY as string) || '';


class GeminiLiteService {
  private ai: GoogleGenAI;
  private model: string = 'gemini-flash-lite-latest';

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

  // Enforce paragraph-first style for shopping/product responses and instruct inline citations
  private enforceProductStyleNote(message: string): string {
    try {
      const m = (message || '').toLowerCase();
      const shoppingSignals = /(price|cost|under\s*₹?|budget|best|top|vs|compare|spec|model|buy|where to|deal|₹|rs\.?|rupees)/i;
      if (!shoppingSignals.test(m)) return '';
      return `\n\nSTRICT OUTPUT FORMAT (Shopping/Product):\n- Use paragraph-style sentences.\n- Do NOT create nested bullet lists (no "Key Specifications:" sub-lists).\n- For each pick, write one compact paragraph: **Model** — Price: ₹X–₹Y; Key specs: s1; s2; s3; Best for: ...\n- CRITICAL: Add inline citations [1], [2], [3] RIGHT AFTER each sentence that uses web data (prices/specs/availability).\n- Example: "The RTX 4060 costs ₹32,000. [1] It offers excellent 1080p performance. [2]"\n- Cite as you write facts throughout the response, NOT bunched at the end.\n- NO "References:" section - inline citations only.`;
    } catch { return ''; }
  }

  // Flatten common nested product bullets (e.g., "Key Specifications:" followed by dotted sub-points) into inline sentences
  // Inject inline citations [n] based on grounding segment data (like Perplexity/Pulse)
  // Groups citations by sentence to show as "Source +N" instead of separate badges
  private injectCitations(text: string, groundingMetadata: any): string {
    if (!groundingMetadata?.groundingSupports || !text) return text;
    
    try {
      // Build map of chunk index to citation number
      const chunkToCitation = new Map<number, number>();
      const processedChunks = new Set<number>();
      let citationNum = 1;
      
      // Collect all segments with their positions and chunk indices
      const segments: Array<{ start: number; end: number; chunkIndices: number[] }> = [];
      for (const support of groundingMetadata.groundingSupports) {
        if (support?.segment?.startIndex !== undefined && support?.segment?.endIndex !== undefined && support?.groundingChunkIndices) {
          segments.push({
            start: support.segment.startIndex,
            end: support.segment.endIndex,
            chunkIndices: support.groundingChunkIndices
          });
        }
      }
      
      // Sort segments by end position
      segments.sort((a, b) => a.end - b.end);
      
      // Assign citation numbers to chunks in order of appearance
      for (const seg of segments) {
        for (const chunkIdx of seg.chunkIndices) {
          if (!processedChunks.has(chunkIdx)) {
            chunkToCitation.set(chunkIdx, citationNum++);
            processedChunks.add(chunkIdx);
          }
        }
      }
      
      // Find PARAGRAPH boundaries - citations should only appear at paragraph/section ends, not every sentence
      const paragraphEnds: number[] = [];
      // Split by double newline (paragraph breaks) and single newline followed by heading/numbering
      const lines = text.split('\n');
      let currentPos = 0;
      let inParagraph = false;
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineEnd = currentPos + line.length;
        const nextLine = i < lines.length - 1 ? lines[i + 1] : '';
        
        // End of paragraph if: next line is empty, next line is heading, or last line with content
        const isLastLine = i === lines.length - 1;
        const nextIsEmpty = !nextLine.trim();
        const nextIsHeading = /^#{1,6}\s/.test(nextLine) || /^\d+\.\s/.test(nextLine) || /^\*\*\d+\./.test(nextLine);
        
        if (line.trim() && (isLastLine || nextIsEmpty || nextIsHeading)) {
          // This line ends a paragraph - find last sentence end in this line
          const sentenceMatches = line.match(/[.!?](?:\s|$)/g);
          if (sentenceMatches && sentenceMatches.length > 0) {
            // Use the LAST sentence end in this paragraph line
            const lastSentencePos = line.lastIndexOf(sentenceMatches[sentenceMatches.length - 1]);
            if (lastSentencePos !== -1) {
              paragraphEnds.push(currentPos + lastSentencePos + 1);
            }
          }
        }
        
        currentPos = lineEnd + 1; // +1 for newline
      }
      
      if (paragraphEnds.length === 0 || paragraphEnds[paragraphEnds.length - 1] !== text.length) {
        paragraphEnds.push(text.length);
      }
      
      // Group segments by paragraph (find which paragraph each segment belongs to)
      const paragraphCitations = new Map<number, Set<number>>();
      for (const seg of segments) {
        // Find the paragraph that this segment belongs to (based on seg.end)
        const paragraphIdx = paragraphEnds.findIndex(endPos => seg.end <= endPos);
        if (paragraphIdx === -1) continue;
        
        const paragraphEnd = paragraphEnds[paragraphIdx];
        if (!paragraphCitations.has(paragraphEnd)) {
          paragraphCitations.set(paragraphEnd, new Set());
        }
        
        // Add all citation numbers for this segment to the paragraph
        for (const chunkIdx of seg.chunkIndices) {
          const citNum = chunkToCitation.get(chunkIdx);
          if (citNum) paragraphCitations.get(paragraphEnd)!.add(citNum);
        }
      }
      
      // Detect heading lines (markdown ## or numbered 1. 2. 3.) to skip citations in headings
      const headingRanges: Array<{ start: number; end: number }> = [];
      const lines2 = text.split('\n');
      let currentPos2 = 0;
      for (const line of lines2) {
        const lineEnd = currentPos2 + line.length;
        // Check if line is a heading (markdown ## or numbered list like "1. ")
        if (/^#{1,6}\s/.test(line) || /^\d+\.\s/.test(line)) {
          headingRanges.push({ start: currentPos2, end: lineEnd });
        }
        currentPos2 = lineEnd + 1; // +1 for newline
      }
      
      // Helper to check if position is within a heading
      const isInHeading = (pos: number) => {
        return headingRanges.some(range => pos >= range.start && pos <= range.end);
      };
      
      // Now inject grouped citations at paragraph ends (working backwards), but skip headings
      const sortedParagraphEnds = Array.from(paragraphCitations.keys()).sort((a, b) => b - a);
      let result = text;
      
      for (const paragraphEnd of sortedParagraphEnds) {
        // Skip if this citation would be in a heading
        if (isInHeading(paragraphEnd)) {
          console.log('⏭️ Skipping citation in heading at position', paragraphEnd);
          continue;
        }
        
        const citations = Array.from(paragraphCitations.get(paragraphEnd)!).sort((a, b) => a - b);
        if (citations.length === 0) continue;
        
        // Format as [1][2][3] (consecutive for grouping in UI)
        const citationText = citations.map(n => `[${n}]`).join('');
        
        // Insert at paragraph end
        let insertPos = paragraphEnd;
        if (insertPos > result.length) insertPos = result.length;
        
        // Insert citation right after punctuation
        const before = result.substring(0, insertPos);
        const after = result.substring(insertPos);
        const needsSpace = before.length > 0 && !/\s$/.test(before);
        result = before + (needsSpace ? ' ' : '') + citationText + (after && !/^\s/.test(after) ? ' ' : '') + after;
      }
      
      console.log('📌 Injected', processedChunks.size, 'citations grouped into', paragraphCitations.size, 'paragraphs');
      return result;
    } catch (err) {
      console.warn('⚠️ Citation injection failed:', err);
      return text;
    }
  }
  
  private flattenProductBullets(text: string): string {
    try {
      let out = text;
      // 1) Collapse "Key Specifications:" blocks into one inline line
      out = out.replace(/(^|\n)[ \t]*[-*]\s*Key\s*Specifications:\s*\n((?:[ \t]*[-*]\s.*\n)+)/gi, (_m, p1, block) => {
        const items = block
          .split(/\n+/)
          .map((l: string) => l.trim())
          .filter((l: string) => /^[-*]\s/.test(l))
          .map((l: string) => l.replace(/^[-*]\s*/, '').replace(/\.*\s*$/, ''))
          .filter(Boolean);
        if (items.length === 0) return _m;
        const inline = items.join('; ');
        return `${p1}Key specs: ${inline}.\n`;
      });

      // 2) Normalize common field labels and drop bullet markers
      out = out.replace(/^[ \t]*[-*]\s*Price:\s*/gim, 'Price: ');
      out = out.replace(/^[ \t]*[-*]\s*Best\s*Use\s*Case:\s*/gim, 'Best for: ');
      out = out.replace(/^[ \t]*[-*]\s*Best\s*for:\s*/gim, 'Best for: ');

      // 3) Merge typical three-line blocks under a numbered pick into one paragraph
      out = out.replace(/(^\d+\.\s[^\n]+)\nPrice:\s*([^\n]+)\nKey\s*specs:\s*([^\n]+)\nBest\s*for:\s*([^\n]+)(?=\n|$)/gim,
        (_m, head, price, specs, best) => `${String(head)} — Price: ${String(price).trim()}; Key specs: ${String(specs).trim()}; Best for: ${String(best).trim()}.`);

      return out;
    } catch { return text; }
  }

  async generateResponse(message: string, options?: { historyText?: string; historyParts?: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }>; forceSearch?: boolean; thinkingBudget?: number; files?: File[]; maxTokens?: number; memoryContext?: string }): Promise<{ content: string; isHealthRelated: boolean; sources?: Array<{ title: string; url: string; snippet?: string; displayUrl?: string }> }> {
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
      /\b(latest|recent|news|today|yesterday|tomorrow|this week|this month|this year|next week|next month|next year|202[4-9]|update|changed|price|cost|mrp|compare|comparison|availability|stock|buy|where to|market|launch|release|schedule|fixture|fixtures|when|start|date|month|year|season|tournament|ipl|match|guideline|policy|regulation|study|trial|paper|review|india|WHO|FDA|EMA|NICE|best|top|under|recommend|recommendation|pick|picks|laptop|mobile|phone|graphics|card|rtx|gtx|2050|gaming)\b|under\s*₹?|₹/i.test(message)
    );
    
    // Removed verbose logging
    const lang = languageStore.get();
    const languageNote = `LANGUAGE PREFERENCE: ${lang?.label || 'English'} (${lang?.code || 'en'}). Respond ONLY in ${lang?.label || 'English'}. Do not code-switch unless explicitly asked.`;
    
    // Inject user memory context (like ChatGPT/Gemini do)
    const memoryContext = options?.memoryContext || '';
    
    const styleNote = this.enforceProductStyleNote(message);
    const config: Record<string, any> = { 
      systemInstruction: `${OJAS_LITE_SYSTEM}\n\n${this.getCurrentTimeContext()}\n\n${languageNote}${memoryContext}${styleNote}`,
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
      // Add Google Search tool
      tools.push({ googleSearch: {} });
      // Enforce thinking mode for search/URL analysis
      if (!config.thinkingConfig) {
        config.thinkingConfig = { thinkingBudget: -1 }; // unlimited thinking for better analysis
      }
    }
    
    if (tools.length > 0) {
      config.tools = tools;
      if (!config.thinkingConfig) {
        config.thinkingConfig = { thinkingBudget: -1 };
      }
    }
    
    // Request grounding metadata explicitly
    config.generationConfig.responseSchema = undefined;
    config.generationConfig.candidateCount = 1;

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
          const cand = (chunk as any).candidates?.[0];
          if ((chunk as any).groundingMetadata) {
            groundingMetadata = (chunk as any).groundingMetadata;
          }
          if (cand?.groundingMetadata) {
            groundingMetadata = cand.groundingMetadata;
          }
          // Function calls are disabled; nothing to capture
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
        // Fallback to non-streaming request when streaming yields empty text; avoid throwing and return a safe message instead
        try {
          const nonStream = await this.withRetry(() => this.ai.models.generateContent({ model: this.model, config, contents }));
          const t: any = (nonStream as any).text;
          full = typeof t === 'function' ? t.call(nonStream) || '' : (t ?? '');
        } catch (e) {
          console.warn('GeminiLite fallback non-stream failed:', e);
        }
      }
      if (!full || full.trim().length === 0) {
        return { content: 'I could not generate a response this time.', isHealthRelated: isHealth };
      }
    }
    // Extract sources from grounding metadata
    let sources = this.extractSources(groundingMetadata);
    console.log('📋 [GeminiLite] Extracted sources:', sources.length);
    // Post-process for paragraph-first shopping style
    let finalOut = this.flattenProductBullets(full || '');
    // Inject inline citations based on grounding segments
    finalOut = this.injectCitations(finalOut, groundingMetadata);
    const hasCitations = /\[\d+\]/.test(finalOut);
    console.log('📝 [GeminiLite] Inline citations present:', hasCitations);
    return {
      content: finalOut,
      isHealthRelated: isHealth,
      sources: sources.length > 0 ? sources : undefined,
    };
  }

  // Stream response with real-time chunks. Calls onChunk for each delta and returns controller + finished promise.
  public streamResponse(
    message: string,
    options?: {
      historyParts?: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }>;
      forceSearch?: boolean;
      thinkingBudget?: number;
      files?: File[];
      memoryContext?: string;
      maxTokens?: number;
      chatId?: string;
      messageId?: string;
    } | undefined,
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
        /\b(latest|recent|news|today|yesterday|tomorrow|this week|this month|this year|next week|next month|next year|202[4-9]|update|changed|price|cost|mrp|compare|comparison|availability|stock|buy|where to|market|launch|release|schedule|fixture|fixtures|when|start|date|month|year|season|tournament|ipl|match|guideline|policy|regulation|study|trial|paper|review|india|WHO|FDA|EMA|NICE|best|top|under|recommend|recommendation|pick|picks|laptop|mobile|phone|graphics|card|rtx|gtx|2050|gaming)\b|under\s*₹?|₹/i.test(message)
      );
      const lang = languageStore.get();
      const languageNote = `LANGUAGE PREFERENCE: ${lang?.label || 'English'} (${lang?.code || 'en'}). Respond ONLY in ${lang?.label || 'English'}. Do not code-switch unless explicitly asked.`;
      
      // Inject user memory context (like ChatGPT/Gemini do)
      const memoryContext = (options as any)?.memoryContext || '';
      
      const styleNote = this.enforceProductStyleNote(message);
      const config: Record<string, any> = {
        systemInstruction: `${OJAS_LITE_SYSTEM}\n\n${this.getCurrentTimeContext()}\n\n${languageNote}${memoryContext}${styleNote}`,
        generationConfig: { temperature: 0.7, maxOutputTokens: options?.maxTokens ?? 8192 },
        // CRITICAL: Always enable thinking/thoughts for extended mode visibility
        thinkingConfig: { 
          thinkingBudget: options?.thinkingBudget !== undefined ? options.thinkingBudget : -1, 
          includeThoughts: true 
        }
      };
      const tools: any[] = [];
      // Offer only web tools; function calling fully disabled
      if (hasUrl) tools.push({ urlContext: {} });
      if (doSearch || hasUrl) tools.push({ googleSearch: {} });
      if (tools.length > 0) {
        (config as any).tools = tools;
        (config as any).generationConfig.responseSchema = undefined;
        (config as any).generationConfig.candidateCount = 1;
      }

      let full = '';
      let groundingMetadata: any = null;
      const streamedFunctionCalls: any[] = [];
      const seenQueries = new Set<string>();
      const emitEvents = (chunk: any) => {
        try {
          const cand = (chunk as any)?.candidates?.[0];
          const th = (cand as any)?.thought ?? (chunk as any)?.thought;
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

        // Read stream with a timeout guard to avoid hanging UI
        const reader = (async () => {
          for await (const chunk of response) {
            if (stopped) break;
            const cand = (chunk as any).candidates?.[0];
            if ((chunk as any).groundingMetadata) groundingMetadata = (chunk as any).groundingMetadata;
            if (cand?.groundingMetadata) groundingMetadata = cand.groundingMetadata;
            try {
              const parts = cand?.content?.parts || [];
              for (const p of parts) {
                if (p?.functionCall?.name) streamedFunctionCalls.push({ name: p.functionCall.name, args: p.functionCall.args || {} });
              }
            } catch {}
            emitEvents(chunk);
            if (chunk.text) {
              full += chunk.text;
              // Stream immediately - token stripping happens at the end
              onChunk?.(chunk.text);
            }
          }
        })();

        const timeout = new Promise<void>((_, reject) => setTimeout(() => {
          try { (stopped as any) = true; } catch {}
          reject(new Error('STREAM_TIMEOUT: generateContentStream exceeded 25s'));
        }, 25000));

        await Promise.race([reader, timeout]);
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
      // CRITICAL: Strip [[ESCALATE_HEALTH]] tokens from final response only
      // This happens when lite model tries to escalate but fast classifier missed it (rare edge case)
      let sanitized = full.replace(/\[\[ESCALATE_HEALTH\]\][^\n]*/g, '').trim();
      // Also strip any leaked tool/function annotations like [[function_call:...]] or [[tool_use:...]]
      sanitized = sanitized
        .replace(/\[\[(function_call|tool_use)[:\s][^\]]*\]\]/gi, '')
        .replace(/```(?:json)?\s*\[\[(function_call|tool_use)[\s\S]*?\]\]\s*```/gi, '')
        .trim();
      
      // Only use fallback message if there's truly no output at all
      if (!sanitized || sanitized.length === 0) {
        return { content: 'I could not generate a response this time.', isHealthRelated: false };
      }
      
      // Try to extract sources from streamed grounding metadata. If empty but we performed search/URL analysis,
      // do a quick non-stream call to retrieve grounding metadata for citations.
      let sources = this.extractSources(groundingMetadata);
      if ((!sources || sources.length === 0) && (hasUrl || doSearch)) {
        try {
          const nonStream = await this.withRetry(() => this.ai.models.generateContent({ model: this.model, config, contents }));
          const cand2 = (nonStream as any)?.candidates?.[0];
          const gm2 = (nonStream as any).groundingMetadata || cand2?.groundingMetadata;
          const s2 = this.extractSources(gm2);
          if (s2.length > 0) sources = s2;
        } catch {}
      }
      // Post-process for paragraph-first shopping style
      let finalOut = this.flattenProductBullets(sanitized);
      // Inject inline citations based on grounding segments
      finalOut = this.injectCitations(finalOut, groundingMetadata);
      const hasCitations = /\[\d+\]/.test(finalOut);
      console.log('📋 [GeminiLite Stream] Sources:', sources?.length || 0, '| Inline citations:', hasCitations);
      return { content: finalOut, isHealthRelated: false, sources };
    })();
    return { stop: () => { stopped = true; }, finished };
  }
}

// Helper methods
// Note: Keep lightweight and resilient to SDK shape changes
class _GeminiLiteHelpers {
  static extractFunctionCallsFromResp(resp: any): Array<{ name: string; args: any }> {
    try {
      if (resp?.functionCalls && Array.isArray(resp.functionCalls)) {
        return resp.functionCalls.map((fc: any) => ({ name: fc?.name, args: fc?.args || {} })).filter(x => !!x.name);
      }
      const out: Array<{ name: string; args: any }> = [];
      const cands = resp?.candidates || [];
      for (const c of cands) {
        const parts = c?.content?.parts || [];
        for (const p of parts) {
          const fc = p?.functionCall;
          if (fc?.name) out.push({ name: fc.name, args: fc.args || {} });
        }
      }
      return out;
    } catch {
      return [];
    }
  }
}

export const geminiLiteService = new GeminiLiteService();
