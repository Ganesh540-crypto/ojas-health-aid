import { GoogleGenAI } from '@google/genai';
import { geminiLiteService } from './geminiLite';
import { geminiSearchService } from './geminiSearch';
import { healthIntakeService, type HealthIntakePayload } from './healthIntake';
import { memoryStore } from './memory';
import { isSubstanceQuery, sanitizeSubstanceContent, needsFreshData } from './textAnalysis';
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
  sources?: Array<{ title: string; url: string; snippet?: string; displayUrl?: string }>; // web search sources
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

  async route(message: string, chatId?: string): Promise<RouteResult> {
    // Handle structured intake answers directly with full model
    if (/^\s*\{\s*"intakeAnswers"/i.test(message)) {
      memoryStore.addUser(message);
      
      // Build context from intake answers
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
      const profileSummary = this.buildProfileSummary(profile);
      const resp = await geminiSearchService.generateResponse(message, {
        historyParts: [
          ...(contextPack ? [{ role: 'user', parts: [{ text: contextPack }] }] : []),
          ...(profileSummary ? [{ role: 'user', parts: [{ text: profileSummary }] }] : []),
          ...memoryStore.getHistoryParts()
        ],
        forceSearch: true // Force web search for intake answer processing
      });
      
      // Inject Safety Notice for substance/danger queries
      const needsSafety = isSubstanceQuery(message);
      const alreadyLabeled = /safety notice|disclaimer/i.test(resp.content);
      const safety = '**Safety notice:** I can\'t help with the use or procurement of illegal or harmful substances. If ingestion, overdose, or poisoning is involved, seek immediate medical care. I can share general risks and support resources.';
      const labeled = needsSafety && !alreadyLabeled ? `${safety}\n\n${resp.content}` : resp.content;
      memoryStore.addAssistant(labeled);
      return { ...resp, content: labeled, decision: 'critical', modelUsed: 'gemini-2.5-flash', sources: resp.sources };
    }

    // Record user message and prepare context
    memoryStore.addUser(message);
    const profile = profileStore.get();
    const profileSummary = this.buildProfileSummary(profile);

    // Use lite model for intelligent routing decision
    console.log('🔍 ROUTER: Using lite model for intelligent routing');
    // Force web search for time-sensitive questions using a generic fresh-data detector
    const forceSearchLite = needsFreshData(message);
    
    // Check if this is a follow-up question about previous responses
    const history = memoryStore.getPlainHistory(15); // Increased history for better context
    const isFollowUp = /^(how|why|what about|tell me more|explain|elaborate|can you clarify|what do you mean)/i.test(message.toLowerCase()) && 
                       history.length > 100; // Generic check - if there's substantial history, it might be a follow-up
    
    const liteResp = await geminiLiteService.generateResponse(message, {
      historyText: [profileSummary, history].filter(Boolean).join('\n\n'),
      forceSearch: forceSearchLite || isFollowUp
    });

    console.log('🔍 LITE MODEL RESPONSE:', {
      isHealthRelated: liteResp.isHealthRelated,
      query: message.substring(0, 80) + '...',
      sources: liteResp.sources?.length || 0
    });

    // Don't escalate to health model for follow-up questions about non-health topics
    const escalateByToken = /\[\[ESCALATE_HEALTH\]\]/.test(liteResp.content);
    const isActualHealthQuery = (liteResp.isHealthRelated || escalateByToken) && 
                                !isFollowUp && 
                                !message.toLowerCase().includes('how do you know') &&
                                !message.toLowerCase().includes('how did you get');
    
    if (isActualHealthQuery) {
      console.log('🚀 ESCALATING: Health query detected, using full model with web search');
      
      // Try to generate intake questions for better personalization
      const intake = await healthIntakeService.generateQuestions(message);
      if (intake) {
        const intakeNotice = `## 🏥 Quick Health Assessment\n\nI need a bit more detail to provide personalized guidance. I'll ask **${intake.questions.length} quick questions**.\n\n> 💡 You can answer by selecting options or typing your own response.\n\nWhen you're done, send them all together and I'll provide comprehensive health guidance tailored to your situation.`;
        memoryStore.addAssistant(intakeNotice);
        return {
          content: intakeNotice,
          isHealthRelated: true,
          decision: 'critical',
          modelUsed: 'gemini-2.5-flash',
          intake,
          awaitingIntakeAnswers: true
        };
      }

      // Use full model for health-related expertise with mandatory web search
      const resp = await geminiSearchService.generateResponse(message, {
        historyParts: [
          ...(profileSummary ? [{ role: 'user', parts: [{ text: profileSummary }] }] : []),
          ...memoryStore.getHistoryParts()
        ],
        forceSearch: true // Always search for health queries
      });

      console.log('✅ HEALTH MODEL response:', {
        contentLength: resp.content.length,
        sources: resp.sources?.length || 0,
        hasGrounding: !!resp.sources
      });
      // Sanitize and label if substance-related
      const needsSafetyH = isSubstanceQuery(message);
      let contentH = resp.content;
      if (needsSafetyH) contentH = sanitizeSubstanceContent(contentH);
      const alreadyLabeledH = /safety notice|disclaimer/i.test(contentH);
      const safetyH = '**Safety notice:** I can\'t help with the use or procurement of illegal or harmful substances. If ingestion, overdose, or poisoning is involved, seek immediate medical care. I can share general risks and support resources.';
      if (needsSafetyH && !alreadyLabeledH) contentH = `${safetyH}\n\n${contentH}`;
      memoryStore.addAssistant(contentH);
      
      // Generate smart chat title if needed
      if (chatId) {
        this.updateChatTitle(chatId, message, contentH);
      }
      
      return { ...resp, content: contentH, decision: 'critical', modelUsed: 'gemini-2.5-flash', sources: resp.sources };
    }

    // For non-health queries, use lite model response directly (strip any stray token)
    let sanitizedLite = liteResp.content.replace(/\s*\[\[ESCALATE_HEALTH\]\][^\n]*\n?/g, '').trim();
    // Sanitize and label for substance/danger queries
    const needsSafety = isSubstanceQuery(message);
    if (needsSafety) sanitizedLite = sanitizeSubstanceContent(sanitizedLite);
    const alreadyLabeled = /safety notice|disclaimer/i.test(sanitizedLite);
    const safety = '**Safety notice:** I can\'t help with the use or procurement of illegal or harmful substances. If ingestion, overdose, or poisoning is involved, seek immediate medical care. I can share general risks and support resources.';
    const labeled = needsSafety && !alreadyLabeled ? `${safety}\n\n${sanitizedLite}` : sanitizedLite;
    memoryStore.addAssistant(labeled);
    
    // Generate smart chat title if needed
    if (chatId) {
      this.updateChatTitle(chatId, message, labeled);
    }
    
    return { 
      content: labeled, 
      isHealthRelated: liteResp.isHealthRelated, 
      decision: 'casual', 
      modelUsed: 'gemini-2.5-flash-lite', 
      sources: liteResp.sources 
    };
  }

  private buildProfileSummary(profile: any): string {
    if (!Object.keys(profile).length) return '';
    
    return `USER PROFILE\nName: ${profile.name ?? ''}\nAge: ${profile.age ?? ''}\nHeight(cm): ${profile.heightCm ?? ''}\nWeight(kg): ${profile.weightKg ?? ''}\nAllergies: ${(profile.allergies || []).join(', ')}\nConditions: ${(profile.preexisting || []).join(', ')}\nMeds: ${(profile.medications || []).join(', ')}`;
  }
  
  private async updateChatTitle(chatId: string, userMessage: string, aiResponse: string): Promise<void> {
    try {
      const { chatStore } = await import('./chatStore');
      const chat = chatStore.get(chatId);
      if (!chat || chat.title !== 'Chat ' + new Date().toLocaleDateString()) return;
      
      // Generate a smart 3-5 word title based on the conversation
      const prompt = `Generate a concise 3-5 word title for this chat based on the user's question and AI response. Focus on the main topic. Do not use quotes or special characters.

User: ${userMessage.slice(0, 200)}

Response summary: ${aiResponse.slice(0, 200)}

Title:`;
      
      const { geminiLiteService } = await import('./geminiLite');
      // Use lite model to generate title
      const titleResponse = await geminiLiteService.generateResponse(prompt, { forceSearch: false });
      const title = titleResponse.content.trim().slice(0, 50);
      
      if (title && title.length > 2) {
        chatStore.updateTitle(chatId, title);
      }
    } catch (error) {
      console.error('Failed to update chat title:', error);
    }
  }
}

export const aiRouter = new AIRouter();
