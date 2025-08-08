import { GoogleGenAI } from '@google/genai';

const API_KEY = 'AIzaSyDGlcM72TRk56b-IeGzIqChhYHN3y5gPYw';

const LITE_SYSTEM = `You are Ojas Lite, a friendly companion for casual and general conversations.
- Be warm, concise, and helpful.
- For health-related topics: provide general, evidence-based information without diagnosing or prescribing.
- Do NOT include medical disclaimers in the text (the UI handles warnings).
- Use plain language and optional bullets when helpful.`;

class GeminiLiteService {
  private ai: GoogleGenAI;
  private model: string = 'gemini-2.5-flash-lite';

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: API_KEY });
  }

  private isHealthRelated(message: string): boolean {
    const healthKeywords = [
      'health','pain','symptom','medicine','medication','doctor','hospital',
      'injury','hurt','sick','fever','headache','stomach','chest','breathing','blood',
      'pressure','diabetes','cancer','treatment','prescription','pill','drug','allergy',
      'infection','virus','bacteria','disease','condition','diagnosis','therapy','surgery',
      'emergency','urgent','serious','chronic','acute','prevention','wellness','fitness',
      'diet','nutrition','exercise','sleep','mental health','anxiety','depression','stress','fatigue'
    ];
    const lower = message.toLowerCase();
    return healthKeywords.some(k => lower.includes(k));
  }

  async generateResponse(message: string): Promise<{ content: string; isHealthRelated: boolean }>{
    const isHealth = this.isHealthRelated(message);

    const contents = [
      { role: 'user' as const, parts: [{ text: message }] },
    ];

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
}

export const geminiLiteService = new GeminiLiteService();
