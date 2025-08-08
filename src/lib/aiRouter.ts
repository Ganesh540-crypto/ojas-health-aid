import { GoogleGenAI } from '@google/genai';
import { geminiLiteService } from './geminiLite';
import { geminiSearchService } from './geminiSearch';

const API_KEY = 'AIzaSyDGlcM72TRk56b-IeGzIqChhYHN3y5gPYw';

type Decision = 'casual' | 'critical';

interface RouteResult {
  content: string;
  isHealthRelated: boolean;
  decision: Decision;
  modelUsed: string;
}

class AIRouter {
  private ai: GoogleGenAI;
  private model: string = 'gemini-2.5-flash-lite';

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: API_KEY });
  }

  private heuristicDecision(message: string): Decision {
    const lower = message.toLowerCase();
    const healthTriggers = [
      'severe','intense','emergency','urgent','serious','can\'t breathe','chest pain','heart attack','stroke','bleeding','unconscious','allergic reaction','overdose','poisoning','fracture','broken','surgery','prescription','diagnosis','treatment plan','symptom','medicine','medication','doctor','hospital','headache','fever','infection','virus','diabetes','cancer'
    ];
    const researchTriggers = ['research','sources','cite','evidence','current','today','market','price','best','compare','latest','india'];

    if (healthTriggers.some(k => lower.includes(k))) return 'critical';
    if (researchTriggers.some(k => lower.includes(k))) return 'critical';
    return 'casual';
  }

  private async classify(message: string): Promise<Decision> {
    try {
      const prompt = `Classify the user message strictly as JSON with keys decision and reason.\n- decision must be one of: \"casual\" or \"critical\".\n- Use \"critical\" if the message is health-related, asks for research, sources, prices, comparisons, market info, or seems important/needs careful guidance; otherwise \"casual\".\nReturn JSON only.\nMessage: ${message}`;

      const stream = await this.ai.models.generateContentStream({
        model: this.model,
        config: { systemInstruction: 'You are a strict classifier. Output valid minified JSON only.' },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });

      let text = '';
      for await (const chunk of stream) {
        if (chunk.text) text += chunk.text;
      }

      const jsonStart = text.indexOf('{');
      const jsonEnd = text.lastIndexOf('}');
      const jsonText = jsonStart >= 0 && jsonEnd >= 0 ? text.slice(jsonStart, jsonEnd + 1) : '{}';
      const parsed = JSON.parse(jsonText) as { decision?: Decision };
      if (parsed.decision === 'casual' || parsed.decision === 'critical') {
        return parsed.decision;
      }
      return this.heuristicDecision(message);
    } catch {
      return this.heuristicDecision(message);
    }
  }

  async route(message: string): Promise<RouteResult> {
    const decision = await this.classify(message);

    if (decision === 'critical') {
      const resp = await geminiSearchService.generateResponse(message, { forceSearch: true });
      return { ...resp, decision, modelUsed: 'gemini-2.5-flash' };
    }

    const resp = await geminiLiteService.generateResponse(message);
    return { ...resp, decision, modelUsed: 'gemini-2.5-flash-lite' };
  }
}

export const aiRouter = new AIRouter();
