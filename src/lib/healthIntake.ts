import { GoogleGenAI } from '@google/genai';
import { OJAS_HEALTH_INTAKE_SYSTEM } from './systemPrompts';
import { languageStore } from './languageStore';

const API_KEY: string = (import.meta.env?.VITE_GEMINI_API_KEY as string) || '';

export interface HealthIntakeQuestion {
  id: string;
  text: string;
  options?: string[]; // optional multiple choice suggested answers
  required?: boolean;
  multiSelect?: boolean; // true = checkboxes (multi-select), false/undefined = radio buttons (single-select)
}

export interface HealthIntakePayload {
  questions: HealthIntakeQuestion[];
  reasoningNote?: string;
}

class HealthIntakeService {
  private ai: GoogleGenAI;
  private model = 'gemini-2.5-flash-preview-09-2025';
  constructor() {
    if (!API_KEY) console.warn('Gemini API key missing for health intake');
    this.ai = new GoogleGenAI({ apiKey: API_KEY });
  }

  async generateQuestions(userMessage: string): Promise<HealthIntakePayload | null> {
    try {
      const lang = languageStore.get();
      const languageNote = lang && lang.code !== 'en'
        ? `\n\n⚠️ CRITICAL: Generate ALL questions and options in ${lang.label} (${lang.code}), not English.`
        : '';
      
      // Use JSON schema enforcement to guarantee valid JSON output
      const jsonSchema = {
        type: 'object',
        properties: {
          questions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                text: { type: 'string' },
                options: { type: 'array', items: { type: 'string' } },
                required: { type: 'boolean' },
                multiSelect: { type: 'boolean' }
              },
              required: ['id', 'text']
            },
            minItems: 3,
            maxItems: 8
          },
          reasoningNote: { type: 'string' }
        },
        required: ['questions']
      };
      
      const response = await this.ai.models.generateContent({
        model: this.model,
        config: { 
          systemInstruction: `${OJAS_HEALTH_INTAKE_SYSTEM}${languageNote}`,
          responseSchema: jsonSchema,
          responseMimeType: 'application/json'
        } as any,
        contents: [
          { role: 'user', parts: [{ text: `USER_MESSAGE:\n${userMessage}` }] }
        ]
      });
      
      // Access text as property (it's a getter, not a function)
      const text = (response as any).text || JSON.stringify(response);
      const parsed = JSON.parse(text) as HealthIntakePayload;
      
      if (!parsed.questions || !Array.isArray(parsed.questions)) {
        console.log('❌ Health intake: No valid questions array in response');
        return null;
      }
      
      // Filter and validate questions
      parsed.questions = parsed.questions
        .filter(q => q && typeof q.id === 'string' && typeof q.text === 'string')
        .slice(0, 8);
      
      console.log('✅ Health intake generated:', { 
        questionsCount: parsed.questions.length
      });
      
      if (parsed.questions.length < 3) {
        console.log('❌ Health intake: Not enough questions (need 3+, got ' + parsed.questions.length + ')');
        return null;
      }
      
      return parsed;
    } catch (e) {
      console.error('❌ HealthIntake generation failed:', e);
      return null;
    }
  }
  
  async streamQuestions(userMessage: string, onPartial?: (questions: HealthIntakeQuestion[]) => void): Promise<HealthIntakePayload | null> {
    try {
      const lang = languageStore.get();
      const languageNote = lang && lang.code !== 'en'
        ? `\n\n⚠️ CRITICAL: Generate ALL questions and options in ${lang.label} (${lang.code}), not English.`
        : '';
      
      // Use JSON schema for structured output
      const jsonSchema = {
        type: 'object',
        properties: {
          questions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                text: { type: 'string' },
                options: { type: 'array', items: { type: 'string' } },
                required: { type: 'boolean' },
                multiSelect: { type: 'boolean' }
              },
              required: ['id', 'text']
            },
            minItems: 3,
            maxItems: 8
          },
          reasoningNote: { type: 'string' }
        },
        required: ['questions']
      };
      
      const stream = await this.ai.models.generateContentStream({
        model: this.model,
        config: { 
          systemInstruction: `${OJAS_HEALTH_INTAKE_SYSTEM}${languageNote}`,
          responseSchema: jsonSchema,
          responseMimeType: 'application/json'
        } as any,
        contents: [
          { role: 'user', parts: [{ text: `USER_MESSAGE:\n${userMessage}` }] }
        ]
      });
      
      let full = '';
      
      for await (const chunk of stream) { 
        if (chunk.text) {
          full += chunk.text;
          
          // Try to parse partial JSON for progressive display
          try {
            // Try to fix incomplete JSON by adding closing brackets
            let fixedJson = full;
            const openBraces = (full.match(/\{/g) || []).length;
            const closeBraces = (full.match(/\}/g) || []).length;
            const openBrackets = (full.match(/\[/g) || []).length;
            const closeBrackets = (full.match(/\]/g) || []).length;
            
            fixedJson += ']'.repeat(Math.max(0, openBrackets - closeBrackets));
            fixedJson += '}'.repeat(Math.max(0, openBraces - closeBraces));
            
            const parsed = JSON.parse(fixedJson) as HealthIntakePayload;
            if (parsed.questions && Array.isArray(parsed.questions) && parsed.questions.length > 0) {
              onPartial?.(parsed.questions);
            }
          } catch {}
        }
      }
      
      // Parse final complete JSON (guaranteed valid by schema)
      const parsed = JSON.parse(full) as HealthIntakePayload;
      
      if (!parsed.questions || !Array.isArray(parsed.questions)) {
        console.log('❌ Health intake stream: No valid questions array');
        return null;
      }
      
      parsed.questions = parsed.questions
        .filter(q => q && typeof q.id === 'string' && typeof q.text === 'string')
        .slice(0, 8);
      
      if (parsed.questions.length < 3) {
        console.log('❌ Health intake stream: Not enough questions');
        return null;
      }
      
      return parsed;
    } catch (error) {
      console.error('❌ Health intake stream error:', error);
      return null;
    }
  }
}

export const healthIntakeService = new HealthIntakeService();
