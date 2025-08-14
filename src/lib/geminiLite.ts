import { GoogleGenAI } from '@google/genai';
import { isHealthRelated } from '@/lib/textAnalysis';

const API_KEY = (import.meta.env?.VITE_GEMINI_API_KEY as string) || '';

const LITE_SYSTEM = `You are Ojas Lite, a friendly companion for casual and general conversations.
- Be warm, concise, and helpful.
- For health-related topics: provide general, evidence-based information without diagnosing or prescribing.
- Do NOT include medical disclaimers in the text (the UI handles warnings).
- Use plain language and optional bullets when helpful.`;

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

  async generateResponse(message: string, options?: { historyText?: string }): Promise<{ content: string; isHealthRelated: boolean }>{
    const isHealth = this.isHealthRelated(message);

    const contents: Array<{ role: 'user'; parts: { text: string }[] }> = [];
    if (options?.historyText) {
      contents.push({ role: 'user', parts: [{ text: `CONVERSATION CONTEXT:\n${options.historyText}` }] });
    }
    contents.push({ role: 'user', parts: [{ text: message }] });

    const response = await this.ai.models.generateContentStream({
      model: this.model,
      config: { systemInstruction: LITE_SYSTEM },
      contents,
    });

    let full = '';
    for await (const chunk of response) {
      if (chunk.text) full += chunk.text;
    }

    return {
      content: full || 'Sorry, I could not generate a response. Please try again.',
      isHealthRelated: isHealth,
    };
  }

  async rephraseForResearch(message: string, options?: { historyText?: string }): Promise<string> {
    const system = `You are a world-class query refiner for web research. Given the user's request and optional chat context, rewrite it into a precise, richly-specified research prompt that captures:
- key entities, constraints, and intent
- correct typos and normalize medical/product terms (e.g., tablets vs table, omega-3, DHA, EPA)
- region or market context (include the city/state/country if mentioned; default to India if implied)
- relevant synonyms (e.g., generic vs brand names; fish oil, algal oil)
- measurable details (price ranges, budget words like "low cost", dosage forms, strengths) when applicable
- add likely retailer/pharmacy keywords when searching for availability (e.g., 1mg, PharmEasy, NetMeds, Apollo, Amazon India, Flipkart)
Output only the rewritten prompt with no extra commentary.`;

    const contents: Array<{ role: 'user'; parts: { text: string }[] }> = [];
    if (options?.historyText) {
      contents.push({ role: 'user', parts: [{ text: `CHAT CONTEXT:\n${options.historyText}` }] });
    }
    contents.push({ role: 'user', parts: [{ text: `USER REQUEST:\n${message}` }] });

    const stream = await this.ai.models.generateContentStream({
      model: this.model,
      config: { systemInstruction: system },
      contents,
    });

    let text = '';
    for await (const chunk of stream) {
      if (chunk.text) text += chunk.text;
    }
    return text.trim() || message;
  }
}

export const geminiLiteService = new GeminiLiteService();
