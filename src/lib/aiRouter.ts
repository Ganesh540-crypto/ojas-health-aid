import { GoogleGenAI } from '@google/genai';
import { geminiLiteService } from './geminiLite';
import { geminiSearchService } from './geminiSearch';
import { healthIntakeService, type HealthIntakePayload } from './healthIntake';
import { memoryStore } from './memory';
import { profileStore } from './profileStore';
const API_KEY: string = (import.meta.env?.VITE_GEMINI_API_KEY as string) || '';

type Decision = 'casual' | 'critical';

interface RouteResult {
  content: string; // assistant text
  isHealthRelated: boolean;
  decision: Decision;
  modelUsed: string;
  intake?: HealthIntakePayload; // if present, UI should render intake question cards sequentially
  awaitingIntakeAnswers?: boolean; // indicates next user interactions should fill intake
}

class AIRouter {
  private ai: GoogleGenAI;
  private model: string = 'gemini-2.5-flash-lite';

  constructor() {
    if (!API_KEY) {
      console.warn('Gemini API key missing: set VITE_GEMINI_API_KEY in your .env file');
    }
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
    // Lightweight heuristic only: health queries -> critical, everything else -> casual.
    const lower = message.toLowerCase();
    const healthKeywords = ['symptom','pain','fever','medicine','medication','doctor','hospital','treatment','diet','exercise','injury','headache','diabetes','cancer','allergy','infection','virus','blood pressure','anxiety','depression','stress','fracture','urgent','emergency','serious','chest pain','stroke','heart attack'];
    return healthKeywords.some(k => lower.includes(k)) ? 'critical' : 'casual';
  }

  async route(message: string): Promise<RouteResult> {
    // If user is submitting structured intake answers JSON starting with {"intakeAnswers": ...}
    if (/^\s*\{\s*"intakeAnswers"/i.test(message)) {
      // Pass directly to high fidelity model with forced search and labeled answers
      memoryStore.addUser(message);
      // Build a minimal CONTEXT PACK from intake answers for better grounding
      let contextPack = '';
      try {
        const parsed = JSON.parse(message);
        const answers = parsed?.intakeAnswers ?? parsed;
        if (answers && typeof answers === 'object') {
          const lines: string[] = [];
          for (const [k, v] of Object.entries(answers)) {
            const key = String(k);
            const val = typeof v === 'string' ? v : JSON.stringify(v);
            lines.push(`- ${key}: ${val}`);
          }
          if (lines.length) {
            contextPack = `CONTEXT PACK\nIntake Summary:\n${lines.slice(0, 20).join('\n')}`;
          }
        }
      } catch { /* ignore parse errors */ }
      const profile = profileStore.get();
      const profileSummary = Object.keys(profile).length
        ? `USER PROFILE\nName: ${profile.name ?? ''}\nAge: ${profile.age ?? ''}\nHeight(cm): ${profile.heightCm ?? ''}\nWeight(kg): ${profile.weightKg ?? ''}\nAllergies: ${(profile.allergies || []).join(', ')}\nConditions: ${(profile.preexisting || []).join(', ')}\nMeds: ${(profile.medications || []).join(', ')}`
        : '';
      const rewritten = await geminiLiteService.rephraseForResearch(message, {
        historyText: [profileSummary, memoryStore.getPlainHistory(8)].filter(Boolean).join('\n\n'),
      });
      const resp = await geminiSearchService.generateResponse(rewritten, {
        forceSearch: true,
        historyParts: (
          profileSummary
            ? [
                ...(contextPack ? [{ role: 'user', parts: [{ text: contextPack }] }] : []),
                { role: 'user', parts: [{ text: profileSummary }] },
                ...memoryStore.getHistoryParts()
              ]
            : [
                ...(contextPack ? [{ role: 'user', parts: [{ text: contextPack }] }] : []),
                ...memoryStore.getHistoryParts()
              ]
        ),
        originalMessage: message,
        rewrittenQuery: rewritten,
      });
      memoryStore.addAssistant(resp.content);
      return { ...resp, decision: 'critical', modelUsed: 'gemini-2.5-flash' };
    }
    // Record user message in shared memory
    memoryStore.addUser(message);
    const profile = profileStore.get();
    const profileSummary = Object.keys(profile).length
      ? `USER PROFILE\nName: ${profile.name ?? ''}\nAge: ${profile.age ?? ''}\nHeight(cm): ${profile.heightCm ?? ''}\nWeight(kg): ${profile.weightKg ?? ''}\nAllergies: ${(profile.allergies || []).join(', ')}\nConditions: ${(profile.preexisting || []).join(', ')}\nMeds: ${(profile.medications || []).join(', ')}`
      : '';

    let decision = await this.classify(message);
    // First attempt with lite model to see if it wants escalation (fast path for ambiguous messages)
    let prelimContent: string | null = null;
    if (decision === 'casual') {
      const liteProbe = await geminiLiteService.generateResponse(`(Classification probe) ${message}`);
      if (liteProbe.content.startsWith('[[ESCALATE_HEALTH]]')) {
        decision = 'critical';
        prelimContent = null; // discard lite content beyond marker
      } else {
        prelimContent = liteProbe.content;
      }
    }

    if (decision === 'critical') {
      // Generate intake questions first unless the message seems to already be a follow-up with structured details
      const intake = await healthIntakeService.generateQuestions(message);
      if (intake) {
        // Provide instructions for the UI on how to respond back with answers
        const intakeNotice = `I need a bit more detail to personalize safe guidance. I'll ask up to ${intake.questions.length} quick questions. You can answer by selecting options or typing. When done, send them all together.\n\n(Answer each; or type a combined response manually if preferred.)`;
        memoryStore.addAssistant(intakeNotice);
        return {
          content: intakeNotice,
          isHealthRelated: true,
          decision,
            modelUsed: 'gemini-2.5-flash',
          intake,
          awaitingIntakeAnswers: true
        };
      }
      // Rephrase and enrich the query for better research
      const rewritten = await geminiLiteService.rephraseForResearch(message, {
        historyText: [profileSummary, memoryStore.getPlainHistory(8)].filter(Boolean).join('\n\n'),
      });

      const resp = await geminiSearchService.generateResponse(rewritten, {
        forceSearch: true, // compulsory web search for health
        historyParts: (
          profileSummary
            ? [{ role: 'user', parts: [{ text: profileSummary }] }, ...memoryStore.getHistoryParts()]
            : memoryStore.getHistoryParts()
        ),
        originalMessage: message,
        rewrittenQuery: rewritten,
      });

      // Save assistant reply to memory
      memoryStore.addAssistant(resp.content);
  return { ...resp, decision, modelUsed: 'gemini-2.5-flash' };
    }

    if (prelimContent) {
      memoryStore.addAssistant(prelimContent);
      return { content: prelimContent, isHealthRelated: false, decision, modelUsed: 'gemini-2.5-flash-lite' };
    }
    const resp = await geminiLiteService.generateResponse(message, { historyText: [profileSummary, memoryStore.getPlainHistory(8)].filter(Boolean).join('\n\n') });
    memoryStore.addAssistant(resp.content);
    return { ...resp, decision, modelUsed: 'gemini-2.5-flash-lite' };
  }
}

export const aiRouter = new AIRouter();
