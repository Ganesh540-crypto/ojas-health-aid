import { GoogleGenAI } from '@google/genai';
import { OJAS_HEALTH_INTAKE_SYSTEM } from './systemPrompts';

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
        config: { systemInstruction: OJAS_HEALTH_INTAKE_SYSTEM },
        contents: [
          { role: 'user', parts: [{ text: `USER_MESSAGE:\n${userMessage}` }] }
        ]
      });
      let full = '';
      for await (const chunk of stream) { if (chunk.text) full += chunk.text; }
      
      // Extract JSON from markdown code blocks or find JSON anywhere in response
      let raw = '';
      
      // Try to extract from ```json code block first
      const codeBlockMatch = full.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      if (codeBlockMatch) {
        raw = codeBlockMatch[1];
      } else {
        // Fallback: find any JSON object in the response
        const jsonMatch = full.match(/\{[\s\S]*?\}/);
        raw = jsonMatch ? jsonMatch[0] : full.trim();
      }
      
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
