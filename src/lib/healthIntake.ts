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
        ? `
⚠️ CRITICAL LANGUAGE INSTRUCTION: The user has selected ${lang.label} (${lang.code}).
YOU MUST GENERATE ALL QUESTIONS AND OPTIONS ENTIRELY IN ${lang.label.toUpperCase()}.
Generate ALL content (questions, option labels, text) directly in ${lang.label}.
DO NOT write in English. Think and respond natively in ${lang.label}.
`
        : '';
      const stream = await this.ai.models.generateContentStream({
        model: this.model,
        config: { systemInstruction: `${OJAS_HEALTH_INTAKE_SYSTEM}${languageNote ? `\n\n${languageNote}` : ''}` },
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
      if (!parsed.questions || !Array.isArray(parsed.questions)) {
        console.log('❌ Health intake: No valid questions array in response');
        return null;
      }
      parsed.questions = parsed.questions.filter((q, i) => q && typeof q.id === 'string' && typeof q.text === 'string').slice(0, 10);
      console.log('📋 Health intake parsed:', { 
        originalCount: parsed.questions.length,
        afterFilter: parsed.questions.length 
      });
      // Reduce minimum required questions from 5 to 3 to make it more likely to trigger
      if (parsed.questions.length < 3) {
        console.log('❌ Health intake: Not enough questions generated (need 3+, got ' + parsed.questions.length + ')');
        return null;
      }
      return parsed;
    } catch (e) {
      console.error('HealthIntake generation failed', e);
      return null;
    }
  }
  
  async streamQuestions(userMessage: string, onPartial?: (questions: HealthIntakeQuestion[]) => void): Promise<HealthIntakePayload | null> {
    try {
      const lang = languageStore.get();
      const languageNote = lang && lang.code !== 'en'
        ? `
⚠️ CRITICAL LANGUAGE INSTRUCTION: The user has selected ${lang.label} (${lang.code}).
YOU MUST GENERATE ALL QUESTIONS AND OPTIONS ENTIRELY IN ${lang.label.toUpperCase()}.
Generate ALL content (questions, option labels, text) directly in ${lang.label}.
DO NOT write in English. Think and respond natively in ${lang.label}.
`
        : '';
      const stream = await this.ai.models.generateContentStream({
        model: this.model,
        config: { systemInstruction: `${OJAS_HEALTH_INTAKE_SYSTEM}${languageNote ? `\n\n${languageNote}` : ''}` },
        contents: [
          { role: 'user', parts: [{ text: `USER_MESSAGE:\n${userMessage}` }] }
        ]
      });
      
      let full = '';
      let lastValidJson: HealthIntakePayload | null = null;
      
      for await (const chunk of stream) { 
        if (chunk.text) {
          full += chunk.text;
          
          // Try to parse partial JSON to show questions as they stream
          try {
            // Look for partial JSON
            const jsonMatch = full.match(/\{[\s\S]*/);
            if (jsonMatch) {
              const partialJson = jsonMatch[0];
              // Try to fix incomplete JSON by adding closing brackets
              let fixedJson = partialJson;
              const openBraces = (partialJson.match(/\{/g) || []).length;
              const closeBraces = (partialJson.match(/\}/g) || []).length;
              const openBrackets = (partialJson.match(/\[/g) || []).length;
              const closeBrackets = (partialJson.match(/\]/g) || []).length;
              
              // Add missing closing brackets/braces
              fixedJson += ']'.repeat(Math.max(0, openBrackets - closeBrackets));
              fixedJson += '}'.repeat(Math.max(0, openBraces - closeBraces));
              
              const parsed = JSON.parse(fixedJson) as HealthIntakePayload;
              if (parsed.questions && Array.isArray(parsed.questions) && parsed.questions.length > 0) {
                lastValidJson = parsed;
                onPartial?.(parsed.questions);
              }
            }
          } catch {}
        }
      }
      
      // Try to extract final JSON from markdown code blocks or find JSON anywhere in response
      let raw = '';
      
      // Try to extract from ```json code block first
      const codeBlockMatch = full.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      if (codeBlockMatch) {
        raw = codeBlockMatch[1];
      } else {
        // Try to find JSON object in response
        const jsonMatch = full.match(/\{[\s\S]*?\"questions\"[\s\S]*?\}/);
        if (jsonMatch) {
          raw = jsonMatch[0];
        } else {
          raw = full;
        }
      }
      
      try {
        const payload = JSON.parse(raw) as HealthIntakePayload;
        if (!payload.questions || !Array.isArray(payload.questions) || payload.questions.length === 0) {
          return lastValidJson;
        }
        return payload;
      } catch {
        return lastValidJson;
      }
    } catch (error) {
      console.error('Health intake stream error:', error);
      return null;
    }
  }
}

export const healthIntakeService = new HealthIntakeService();
