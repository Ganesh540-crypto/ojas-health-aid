import { GoogleGenAI } from '@google/genai';
import { googleSearchService, type GoogleSearchItem } from './googleSearch';
import { detectTone, isHealthRelated } from './textAnalysis';

const API_KEY = (import.meta.env?.VITE_GEMINI_API_KEY as string) || '';

const SYSTEM_INSTRUCTIONS = `You are Ojas, a professional AI health companion and friendly assistant created by MedTrack (https://medtrack.co.in) under VISTORA TRAYANA LLP. You are designed to respond to general health queries and casual user interactions. Your behavior must strictly follow these guidelines:

1. **Medical Responsibility**
   - For health-related queries only: Provide clear, evidence-based information.
   - Include relevant precautions, preventions, and lifestyle recommendations for health-related queries.
   - Never diagnose or prescribe. Avoid speculative or anecdotal advice.
   - DO NOT include medical disclaimers in your response text - the UI will handle warning labels separately.

2. **Tone Adaptation**
   - Detect and adapt to the user's tone based on input.
   - Casual → friendly; angry → de‑escalate & validate; romantic → warm but professional; lazy/silly → light but on-topic.

3. **Topic Control**
   - Health queries: stay focused; general queries: be concise and helpful.
   - If asked about MedTrack / creators: perform web search.

4. **Formatting**
   - Use headings & bullets for health answers: Summary, Key Points, Self‑Care & Lifestyle, Precautions & Red Flags, Follow‑up Question.
   - Ground factual claims in SOURCES with [n] when sources exist.
`;

export class GeminiService {
  private ai: GoogleGenAI;
  private model: string = 'gemini-2.5-flash';
  private conversationHistory: Array<{role: string, parts: Array<{text: string}>}> = [];
  private conversationMemory: string[] = [];

  constructor() {
    if (!API_KEY) console.warn('Gemini API key missing: set VITE_GEMINI_API_KEY in your .env file');
    this.ai = new GoogleGenAI({ apiKey: API_KEY });
  }

  private isHealthRelated(message: string) { return isHealthRelated(message); }

  private shouldPerformWebSearch(message: string): boolean {
    // Always search for health queries; also for organization / creator queries.
    const lower = message.toLowerCase();
    const orgTriggers = ['medtrack','vistora','who created you','who made you','creator'];
    return this.isHealthRelated(message) || orgTriggers.some(t => lower.includes(t));
  }

  private isImportantHealthQuery(message: string): boolean {
    const seriousKeywords = [ 'severe','intense','emergency','urgent','serious','can\'t breathe','chest pain','heart attack','stroke','bleeding','unconscious','poisoning','overdose','allergic reaction','broken','fracture','surgery','prescription','diagnosis','treatment plan' ];
    const lower = message.toLowerCase();
    return seriousKeywords.some(k => lower.includes(k));
  }

  private detectToneLocal(message: string) { return detectTone(message); }

  private addToMemory(userMessage: string, response: string, health: boolean) {
    this.conversationHistory.push({ role: 'user', parts: [{ text: userMessage }] }, { role: 'model', parts: [{ text: response }] });
    if (this.conversationHistory.length > 20) this.conversationHistory = this.conversationHistory.slice(-20);
    if (health && this.isImportantHealthQuery(userMessage)) {
      const summary = `User asked about: ${userMessage.substring(0,100)}... - Health consultation provided`;
      this.conversationMemory.push(summary);
      if (this.conversationMemory.length > 5) this.conversationMemory = this.conversationMemory.slice(-5);
    }
  }

  async generateResponse(message: string, options?: { forceSearch?: boolean; historyParts?: Array<{ role: string; parts: { text: string }[] }>; originalMessage?: string; rewrittenQuery?: string; }): Promise<{ content: string; isHealthRelated: boolean }> {
    try {
      const base = options?.originalMessage ?? message;
      const health = this.isHealthRelated(base);
      const important = health && this.isImportantHealthQuery(base);
      const tone = this.detectToneLocal(base);

      let instructions = SYSTEM_INSTRUCTIONS;
      if (this.conversationMemory.length) instructions += `\n\nRECENT HEALTH CONTEXT:\n${this.conversationMemory.join('\n')}`;
      if (tone !== 'neutral') instructions += `\n\nUSER TONE: ${tone.toUpperCase()} (adapt appropriately).`;
      instructions += `\n\nIf SOURCES provided: ground statements with bracket citations [n]. If none: say sources unavailable briefly then provide cautious generalized guidance and ask ONE clarifying question.`;

      // Decide if we search (health always true)
      const doSearch = options?.forceSearch === true || this.shouldPerformWebSearch(base) || health;
      let sourcesMarkdown = '';
      let searchContext = '';
      if (doSearch) {
        const query = options?.rewrittenQuery ?? base;
        const evidenceDomains = ['site:who.int','site:cdc.gov','site:nih.gov','site:mayoclinic.org','site:pubmed.ncbi.nlm.nih.gov','site:.gov','site:.org','site:.edu'];
        const candidateQueries: string[] = [];
        if (health) {
          for (const d of evidenceDomains.slice(0,6)) candidateQueries.push(`${query} ${d}`);
          candidateQueries.push(`${query} 2025 guidelines`);
        } else {
          candidateQueries.push(`${query} site:.gov`, `${query} site:.org`, `${query} site:.edu`);
        }
        candidateQueries.push(query);

        const aggregated: GoogleSearchItem[] = [];
        const seen = new Set<string>();
        for (const q of candidateQueries) {
          if (aggregated.length >= 6) break;
            const r = await googleSearchService.search(q, 5);
            for (const item of r) {
              if (!seen.has(item.link)) {
                aggregated.push(item);
                seen.add(item.link);
                if (aggregated.length >= 6) break;
              }
            }
        }
        if (aggregated.length) {
          sourcesMarkdown = googleSearchService.formatSearchResults(aggregated);
          searchContext = `SOURCES (numbered):\n${sourcesMarkdown}`;
        } else {
          searchContext = 'NO_WEB_SOURCES_RETRIEVED';
        }
      }

      const history = options?.historyParts && options.historyParts.length ? options.historyParts.slice(-6) : this.conversationHistory.slice(-6);
      const contents: Array<{ role: string; parts: { text: string }[] }> = [...history];
      if (searchContext) contents.push({ role: 'user', parts: [{ text: searchContext }] });
      if (options?.rewrittenQuery || options?.originalMessage) {
        contents.push({ role: 'user', parts: [{ text: `ORIGINAL QUERY:\n${options?.originalMessage ?? message}\n\nREWRITTEN QUERY:\n${options?.rewrittenQuery}` }] });
      }
      contents.push({ role: 'user', parts: [{ text: message }] });

      const config = { systemInstruction: instructions, ...(important && { thinkingConfig: { thinkingBudget: -1 } }) };
      const response = await this.ai.models.generateContentStream({ model: this.model, config, contents });
      let full = '';
      for await (const chunk of response) if (chunk.text) full += chunk.text;
      const finalText = full || 'I could not generate a response this time.';
      const fullWithSources = sourcesMarkdown ? `${finalText}\n\nSources:\n${sourcesMarkdown}` : finalText;
      this.addToMemory(base, fullWithSources, health);
      return { content: fullWithSources, isHealthRelated: health };
    } catch (e) {
      console.error('Gemini API Error:', e);
      return { content: 'I encountered an error processing that. Please retry.', isHealthRelated: false };
    }
  }
}

export const geminiService = new GeminiService();