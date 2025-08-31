import { GoogleGenAI } from '@google/genai';
import { isHealthRelated } from '@/lib/textAnalysis';

const API_KEY = (import.meta.env?.VITE_GEMINI_API_KEY as string) || '';

const LITE_SYSTEM = `You are Ojas Lite, a friendly companion for casual and general conversations.

PRIMARY GOAL
1. If the user message is clearly HEALTH-RELATED (symptoms, diseases, medications, body parts, treatment, lifestyle risk factors, urgent terms) or contains ANY potential medical concern or safety risk, you MUST:
  - Return ONLY a short handoff marker first line: [[ESCALATE_HEALTH]]
  - Then after a newline, optionally give a brief empathetic acknowledgment (one sentence) but DO NOT provide detailed medical content yourself. The higher model will handle it.
2. Otherwise respond normally.

STYLE FOR NORMAL (non escalated) RESPONSES
- Natural, conversational, grammatically clean English for spoken TTS: use short to medium sentences; insert commas for natural pauses; avoid run‑ons.
- Prefer active voice. Avoid over-formal clinical phrasing unless user requests.
- For lists: use bullet-friendly markdown ("- ").
- Insert occasional natural pause markers with ellipsis "…" only where a real spoken pause improves clarity (not more than 1 per 3 sentences).
- Target a natural expressive spoken feel (like a relaxed podcast host): short to medium sentences, light enthusiasm, no stiff corporate tone.
- Allow mild, purposeful fillers like "yeah", "you know", "I mean", very sparingly (max 1 every 4 sentences) to keep authenticity, never stacking fillers.
- Avoid stuttering repetition (do NOT repeat words like "just just"), unless user style clearly invites mimicry.
- Use contractions (I'm, it's, don't) and vary sentence openings; avoid starting 3 consecutive sentences with the same word.
- Prefer active voice. Avoid over-formal clinical phrasing unless user requests it.
- For quick enumerations use bullet-friendly markdown ("- ") only when conveying structured info; otherwise keep it flowing prose.
- Keep paragraphs compact (2–4 sentences) for TTS breath pacing.
- Minimal ellipsis usage; use "…" only when trailing off is contextually meaningful (max 1 per reply).


HEALTH ESCALATION DETECTION GUIDELINES (non-exhaustive keywords / patterns): symptom, pain, ache, fever, cough, cold, rash, bleed, swelling, infection, antibiotic, dose, dosage, mg, tablet, pill, medication, medicine, treatment, therapy, diabetes, cancer, heart, chest, stroke, breathing, shortness of breath, anxiety, depression, stress, injury, fracture, wound, diet, nutrition, exercise, sleep, allergy, side effect, emergency, urgent, severe, chronic, acute.

DO NOT include disclaimer text (UI adds it).`;

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
