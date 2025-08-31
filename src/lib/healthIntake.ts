import { GoogleGenAI } from '@google/genai';

const API_KEY: string = (import.meta.env?.VITE_GEMINI_API_KEY as string) || '';

export interface HealthIntakeQuestion {
  id: string;
  text: string;
  options?: string[]; // optional multiple choice suggested answers
  required?: boolean;
}

export interface HealthIntakePayload {
  questions: HealthIntakeQuestion[];
  reasoningNote?: string;
}

const INTAKE_SYSTEM = `You are Ojas Health Intake Module.
Task: Given a user's initial health related message, produce a structured JSON ONLY (no extra prose) containing 5 to 10 concise follow-up questions that would materially improve a safe, evidence-based general guidance response.

Rules:
- Output ONLY between 5 and 10 questions (inclusive). Prefer 7–9 when uncertainty is high.
- Each question id: q1, q2, ... sequential.
- Phrase questions in plain user-friendly language (avoid medical jargon unless necessary, add lay clarification in parentheses if using a clinical term).
- Include "options" array ONLY when a finite common set covers >70% of typical answers (e.g., duration, severity scale, yes/no, age ranges). Keep 3–6 options; include an "Other" option only if genuinely needed.
- Do NOT ask for personally identifiable information.
- Avoid asking the same concept twice.
- Cover: onset/duration, severity/impact, key symptoms qualifiers, relevant medical history, medications tried, red flag screening, lifestyle/diet or triggers (if relevant).
- If the user message already contains part of the information, you MAY skip re-asking it.

Return strictly this JSON shape:
{
  "questions": [
    {"id":"q1", "text":"...", "options":["...","..."]?},
    ...
  ],
  "reasoningNote": "(short internal note about question selection)"
}

No markdown, no backticks.`;

class HealthIntakeService {
  private ai: GoogleGenAI;
  private model = 'gemini-2.5-flash';
  constructor() {
    if (!API_KEY) console.warn('Gemini API key missing for health intake');
    this.ai = new GoogleGenAI({ apiKey: API_KEY });
  }

  async generateQuestions(userMessage: string): Promise<HealthIntakePayload | null> {
    try {
      const stream = await this.ai.models.generateContentStream({
        model: this.model,
        config: { systemInstruction: INTAKE_SYSTEM },
        contents: [
          { role: 'user', parts: [{ text: `USER_MESSAGE:\n${userMessage}` }] }
        ]
      });
      let full = '';
      for await (const chunk of stream) { if (chunk.text) full += chunk.text; }
      const jsonMatch = full.match(/\{[\s\S]*\}$/);
      const raw = jsonMatch ? jsonMatch[0] : full.trim();
      const parsed = JSON.parse(raw) as HealthIntakePayload;
      if (!parsed.questions || !Array.isArray(parsed.questions)) return null;
      parsed.questions = parsed.questions.filter((q, i) => q && typeof q.id === 'string' && typeof q.text === 'string').slice(0, 10);
      if (parsed.questions.length < 5) return null;
      return parsed;
    } catch (e) {
      console.error('HealthIntake generation failed', e);
      return null;
    }
  }
}

export const healthIntakeService = new HealthIntakeService();
