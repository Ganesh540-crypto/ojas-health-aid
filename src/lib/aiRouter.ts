import { GoogleGenAI } from '@google/genai';
import { geminiLiteService } from './geminiLite';
import { geminiSearchService } from './geminiSearch';
import { healthIntakeService, type HealthIntakePayload } from './healthIntake';
import { memoryStore } from './memory';
import { isSubstanceQuery, sanitizeSubstanceContent, needsFreshData } from './textAnalysis';
import { profileStore } from './profileStore';
import { languageStore } from './languageStore';
import { azureTranslator } from './azureTranslator';
const API_KEY: string = (import.meta.env?.VITE_GEMINI_API_KEY as string) || '';

type Decision = 'casual' | 'critical';

// Strict type for Gemini content history parts to prevent 'role' from widening to string
type GenAIHistoryPart = { role: 'user' | 'model'; parts: { text: string }[] };

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
  private model: string = 'gemini-2.5-flash-lite-preview-09-2025';

  constructor() {
    if (!API_KEY) {
      console.warn('Gemini API key missing: set VITE_GEMINI_API_KEY in your .env file');
    }
    this.ai = new GoogleGenAI({ apiKey: API_KEY });
  }

  // Streaming variant: prepares routing decision and returns a starter to begin streaming with onChunk
  async routeStream(
    message: string,
    chatId?: string,
    opts?: { files?: File[] }
  ): Promise<
    | { intake: HealthIntakePayload; awaitingIntakeAnswers: true }
    | {
        model: 'lite' | 'health';
        isHealthRelated: boolean;
        start: (onChunk: (delta: string) => void, onEvent?: (evt: any) => void) => { stop: () => void; finished: Promise<RouteResult> };
      }
  > {
    memoryStore.addUser(message);
    // Build context similar to route()
    let profile, historyContext, profileSummary;
    try {
      const [profileResult, historyResult] = await Promise.race([
        Promise.all([profileStore.get(), Promise.resolve(memoryStore.getPlainHistory(8))]),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Context loading timeout')), 10000))
      ]) as [any, string];
      profile = profileResult;
      historyContext = historyResult;
      profileSummary = this.buildProfileSummary(profile);
    } catch {
      profile = {}; historyContext = ''; profileSummary = '';
    }

    // Handle structured intake answers directly with full model
    if (/^\s*\{\s*"intakeAnswers"/i.test(message)) {
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
          if (lines.length) contextPack = `CONTEXT PACK\nIntake Summary:\n${lines.slice(0, 20).join('\n')}`;
        }
      } catch {}
      const hpIntake: GenAIHistoryPart[] = [
        ...(contextPack ? [{ role: 'user' as const, parts: [{ text: contextPack }] }] : []),
        ...(profileSummary ? [{ role: 'user' as const, parts: [{ text: profileSummary }] }] : []),
        ...memoryStore.getHistoryParts(),
      ];
      return {
        model: 'health',
        isHealthRelated: true,
        start: (onChunk: (delta: string) => void, onEvent?: (evt: any) => void) => {
          // Call directly on the service to preserve `this` binding inside the method
          const controller = geminiSearchService.streamResponse(
            message,
            { historyParts: hpIntake, forceSearch: true, thinkingBudget: -1 },
            onChunk,
            onEvent
          );
          return {
            stop: controller.stop,
            finished: controller.finished.then(async (resp: any) => {
              let content = await this.addSafetyNoticeIfNeeded(resp.content || '', message);
              memoryStore.addAssistant(content);
              if (chatId) this.updateChatTitle(chatId, message, content);
              return { content, isHealthRelated: true, decision: 'critical', modelUsed: 'gemini-2.5-flash-preview-09-2025', sources: resp.sources } as RouteResult;
            })
          };
        }
      };
    }

    // Determine lite routing and potential escalation
    const forceSearchLite = needsFreshData(message);
    const previousMessages = memoryStore.getHistory();
    const lastAssistantMessage = previousMessages.filter(m => m.role === 'assistant').slice(-1)[0]?.content || '';
    const isSummarizationRequest = /^(summariz|shorter|brief|concise|tldr|condense)/i.test(message.toLowerCase());
    const hasRecentContext = previousMessages.length > 0;
    const startsWithTransition = /^(and |also |but |however |additionally |furthermore |moreover |convert |change |make it |in |to |as )/i.test(message.toLowerCase());
    const referencesContext = /(this|that|it|these|those|them|previous|above|mentioned)/i.test(message.toLowerCase());
    const isFollowUp = hasRecentContext && (startsWithTransition || referencesContext || /^(elaborate|clarify|tell me more|more details|continue)/i.test(message.toLowerCase()));
    const hasRecentHealthResponse = /health|medical|symptoms|treatment|medicine|🏥 Quick Health Assessment/i.test(lastAssistantMessage);
    const hasRecentIntake = /🏥 Quick Health Assessment/.test(lastAssistantMessage);
    const skipHealthIntake = isSummarizationRequest || (isFollowUp && hasRecentHealthResponse) || hasRecentIntake;
    const historyParts = memoryStore.getHistoryParts(12);

    // Use lite non-stream to decide (capped at 256 tokens for speed)
    const liteResp = await geminiLiteService.generateResponse(message, {
      historyText: [profileSummary, historyContext].filter(Boolean).join('\n\n'),
      historyParts,
      forceSearch: forceSearchLite || isFollowUp,
      thinkingBudget: -1,
      files: opts?.files,
      maxTokens: 256
    } as any);

    const escalateByToken = /\[\[ESCALATE_HEALTH\]\]/.test(liteResp.content);
    const isHealthQuery = (liteResp.isHealthRelated || escalateByToken) &&
      !message.toLowerCase().includes('how do you know') && !message.toLowerCase().includes('how did you get');

    console.log('🔍 Routing decision:', { 
      isHealthRelated: liteResp.isHealthRelated, 
      escalateByToken, 
      isHealthQuery,
      skipHealthIntake,
      contentPreview: liteResp.content.substring(0, 100)
    });

    if (isHealthQuery) {
      // Intake generation unless skipped
      const intake = (!skipHealthIntake) ? await healthIntakeService.generateQuestions(message) : null;
      if (intake && intake.questions && intake.questions.length > 0) {
        return { intake, awaitingIntakeAnswers: true } as any;
      }
      // Health stream starter
      const hpHealth: GenAIHistoryPart[] = [
        ...(profileSummary ? [{ role: 'user' as const, parts: [{ text: profileSummary }] }] : []),
        ...memoryStore.getHistoryParts(),
      ];
      return {
        model: 'health',
        isHealthRelated: true,
        start: (onChunk: (delta: string) => void, onEvent?: (evt: any) => void) => {
          // Call directly on the service to preserve `this` binding inside the method
          const controller = geminiSearchService.streamResponse(
            message,
            { historyParts: hpHealth, forceSearch: true, thinkingBudget: -1, files: opts?.files },
            onChunk,
            onEvent
          );
          return {
            stop: controller.stop,
            finished: controller.finished.then(async (resp: any) => {
              let content = await this.addSafetyNoticeIfNeeded(resp.content || '', message);
              memoryStore.addAssistant(content);
              if (chatId) this.updateChatTitle(chatId, message, content);
              return { content, isHealthRelated: true, decision: 'critical', modelUsed: 'gemini-2.5-flash-preview-09-2025', sources: resp.sources } as RouteResult;
            })
          };
        }
      };
    }

    // Non-health: lite stream starter
    return {
      model: 'lite',
      isHealthRelated: false,
      start: (onChunk: (delta: string) => void, onEvent?: (evt: any) => void) => {
        const controller = geminiLiteService.streamResponse(message, {
          historyText: [profileSummary, historyContext].filter(Boolean).join('\n\n'),
          historyParts,
          forceSearch: forceSearchLite || isFollowUp,
          thinkingBudget: -1,
          files: opts?.files
        } as any, onChunk, onEvent);
        return {
          stop: controller.stop,
          finished: controller.finished.then(async (resp: any) => {
            let content = (resp.content || '').replace(/\s*\[\[ESCALATE_HEALTH\]\][^\n]*\n?/g, '').trim();
            content = await this.addSafetyNoticeIfNeeded(content, message);
            memoryStore.addAssistant(content);
            if (chatId) this.updateChatTitle(chatId, message, content);
            return { content, isHealthRelated: false, decision: 'casual', modelUsed: 'gemini-2.5-flash-lite-preview-09-2025', sources: resp.sources } as RouteResult;
          })
        };
      }
    };
  }
  async route(message: string, chatId?: string, opts?: { files?: File[] }): Promise<RouteResult> {
    // Router started
    
    memoryStore.addUser(message);
    
    // Get user profile and history context with timeout
    let profile, historyContext, profileSummary;
    try {
      const contextPromise = Promise.all([
        profileStore.get(),
        Promise.resolve(memoryStore.getPlainHistory(8)) // Get history directly from memory store
      ]);
      
      // Add 10 second timeout for context loading
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Context loading timeout')), 10000)
      );
      
      const [profileResult, historyResult] = await Promise.race([
        contextPromise,
        timeoutPromise
      ]) as [any, string];
      
      profile = profileResult;
      historyContext = historyResult;
      profileSummary = this.buildProfileSummary(profile);
      
      // Context loaded
    } catch (error) {
      console.error('❌ Context loading failed:', error);
      // Continue with empty context rather than failing completely
      profile = {};
      historyContext = '';
      profileSummary = '';
    }

    // Handle structured intake answers directly with full model
    if (/^\s*\{\s*"intakeAnswers"/i.test(message)) {
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
      const hpIntake: GenAIHistoryPart[] = [
        ...(contextPack ? [{ role: 'user' as const, parts: [{ text: contextPack }] }] : []),
        ...(profileSummary ? [{ role: 'user' as const, parts: [{ text: profileSummary }] }] : []),
        ...memoryStore.getHistoryParts(),
      ];
      const resp = await geminiSearchService.generateResponse(message, {
        historyParts: hpIntake,
        forceSearch: true // Force web search for intake answer processing
      });
      
      // Inject Safety Notice for substance/danger queries
      const labeled = await this.addSafetyNoticeIfNeeded(resp.content, message);
      memoryStore.addAssistant(labeled);
      return { ...resp, content: labeled, isHealthRelated: true, decision: 'critical', modelUsed: 'gemini-2.5-flash-preview-09-2025', sources: resp.sources };
    }

    // Use lite model for intelligent routing decision
    // Using lite model for intelligent routing
    // Force web search for time-sensitive questions using a generic fresh-data detector
    const forceSearchLite = needsFreshData(message);
    
    // Check if this is a follow-up question about previous responses
    const recentHistory = memoryStore.getPlainHistory(15); // Increased history for better context
    const previousMessages = memoryStore.getHistory();
    const lastAssistantMessage = previousMessages.filter(m => m.role === 'assistant').slice(-1)[0]?.content || '';
    
    // Intelligent context detection - let AI understand patterns, not hardcode examples
    const isSummarizationRequest = /^(summariz|shorter|brief|concise|tldr|condense)/i.test(message.toLowerCase());
    
    // Smart follow-up detection based on patterns, not specific examples
    const hasRecentContext = previousMessages.length > 0;
    const startsWithTransition = /^(and |also |but |however |additionally |furthermore |moreover |convert |change |make it |in |to |as )/i.test(message.toLowerCase());
    const referencesContext = /(this|that|it|these|those|them|previous|above|mentioned)/i.test(message.toLowerCase());
    
    // Intelligently determine if this is a follow-up about the SAME topic
    const isFollowUp = hasRecentContext && (
      startsWithTransition || 
      referencesContext ||
      /^(elaborate|clarify|tell me more|more details|continue)/i.test(message.toLowerCase())
    );
    
    // Check if this is a follow-up to a recent health response or intake
    const hasRecentHealthResponse = lastAssistantMessage.includes('health') || 
                                   lastAssistantMessage.includes('medical') || 
                                   lastAssistantMessage.includes('symptoms') ||
                                   lastAssistantMessage.includes('treatment') ||
                                   lastAssistantMessage.includes('medicine') ||
                                   lastAssistantMessage.includes('🏥 Quick Health Assessment');
    
    // Check if we already asked intake questions recently
    const hasRecentIntake = lastAssistantMessage.includes('🏥 Quick Health Assessment');
    
    // Only skip health intake for:
    // 1. Summarization requests
    // 2. Follow-ups to existing health discussions
    // 3. Already asked intake questions
    const skipHealthIntake = isSummarizationRequest || (isFollowUp && hasRecentHealthResponse) || hasRecentIntake;
    
    // Get structured history parts for better context
    const historyParts = memoryStore.getHistoryParts(12);
    
    // Calling Lite model...
    
    let liteResp;
    try {
      const litePromise = geminiLiteService.generateResponse(message, {
        historyText: [profileSummary, recentHistory].filter(Boolean).join('\n\n'),
        historyParts: historyParts, // Pass structured history for full context
        forceSearch: forceSearchLite || isFollowUp,
        thinkingBudget: -1, // Enable thinking mode for better context understanding
        files: opts?.files
      } as any); // Type assertion needed until interface is updated
      
      // Add 30 second timeout for model response
      const liteTimeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Lite model response timeout after 30s')), 30000)
      );
      
      liteResp = await Promise.race([litePromise, liteTimeoutPromise])
      
      // Lite model responded successfully
    } catch (error) {
      console.error('❌ Lite model failed:', error);
      throw new Error(`AI service temporarily unavailable: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Lite model response received

    // Check if this is a health query
    const escalateByToken = /\[\[ESCALATE_HEALTH\]\]/.test(liteResp.content);
    const isHealthQuery = (liteResp.isHealthRelated || escalateByToken) && 
                         !message.toLowerCase().includes('how do you know') &&
                         !message.toLowerCase().includes('how did you get');
    
    if (isHealthQuery) {
      console.log('🚀 ESCALATING: Health query detected, using full model with web search');
      
      // Generate intake questions for NEW health queries (not follow-ups or summarizations)
      const intake = (!skipHealthIntake) ? 
                     await healthIntakeService.generateQuestions(message) : 
                     null;
      console.log('📋 Intake generation result:', { 
        skipHealthIntake, 
        intakeGenerated: !!intake,
        questionsCount: intake?.questions?.length || 0 
      });
      if (intake && intake.questions && intake.questions.length > 0) {
        let intakeNotice = `## 🏥 Quick Health Assessment\n\nI need a bit more detail to provide personalized guidance. I'll ask **${intake.questions.length} quick questions**.\n\n> 💡 You can answer by selecting options or typing your own response.\n\nWhen you're done, send them all together and I'll provide comprehensive health guidance tailored to your situation.`;
        const lang = languageStore.get();
        if (lang.code !== 'en') {
          try { intakeNotice = await azureTranslator.translateText(intakeNotice, { to: lang.code }); } catch {}
        }
        memoryStore.addAssistant(intakeNotice);
        // Ensure chat title is generated even when the first response is an intake notice
        if (chatId) {
          this.updateChatTitle(chatId, message, intakeNotice);
        }
        return {
          content: intakeNotice,
          isHealthRelated: true,
          decision: 'critical',
          modelUsed: 'gemini-2.5-flash-preview-09-2025',
          intake,
          awaitingIntakeAnswers: true
        };
      }

      // Use full model for health-related expertise with mandatory web search
      const hpHealth: GenAIHistoryPart[] = [
        ...(profileSummary ? [{ role: 'user' as const, parts: [{ text: profileSummary }] }] : []),
        ...memoryStore.getHistoryParts(),
      ];
      const resp = await geminiSearchService.generateResponse(message, {
        historyParts: hpHealth,
        forceSearch: true, // Always search for health queries
        thinkingBudget: -1 // Enable full thinking mode for complex health analysis
      });

      console.log('✅ HEALTH MODEL response:', {
        contentLength: resp.content.length,
        sources: resp.sources?.length || 0,
        hasGrounding: !!resp.sources
      });
      // Sanitize and label if substance-related
      const contentH = await this.addSafetyNoticeIfNeeded(resp.content, message);
      memoryStore.addAssistant(contentH);
      
      // Generate smart chat title if needed
      if (chatId) {
        this.updateChatTitle(chatId, message, contentH);
      }
      
      return { ...resp, content: contentH, isHealthRelated: true, decision: 'critical', modelUsed: 'gemini-2.5-flash-preview-09-2025', sources: resp.sources };
    }

    // For non-health queries, use lite model response directly (strip any stray token)
    let sanitizedLite = liteResp.content.replace(/\s*\[\[ESCALATE_HEALTH\]\][^\n]*\n?/g, '').trim();
    // Sanitize and label for substance/danger queries
    const labeled = await this.addSafetyNoticeIfNeeded(sanitizedLite, message);
    memoryStore.addAssistant(labeled);
    
    // Generate smart chat title if needed
    if (chatId) {
      this.updateChatTitle(chatId, message, labeled);
    }
    
    console.log('✅ AIRouter.route() completed successfully', {
      decision: 'casual',
      modelUsed: 'gemini-2.5-flash-lite-preview-09-2025',
      contentLength: labeled.length,
      sourcesCount: liteResp.sources?.length || 0
    });
    
    return { 
      content: labeled, 
      isHealthRelated: liteResp.isHealthRelated, 
      decision: 'casual', 
      modelUsed: 'gemini-2.5-flash-lite-preview-09-2025', 
      sources: liteResp.sources 
    };
  }

  private buildProfileSummary(profile: any): string {
    if (!Object.keys(profile).length) return '';
    
    return `USER PROFILE\nName: ${profile.name ?? ''}\nAge: ${profile.age ?? ''}\nHeight(cm): ${profile.heightCm ?? ''}\nWeight(kg): ${profile.weightKg ?? ''}\nAllergies: ${(profile.allergies || []).join(', ')}\nConditions: ${(profile.preexisting || []).join(', ')}\nMeds: ${(profile.medications || []).join(', ')}`;
  }

  // Helper to add safety notice if needed (consolidates duplicate logic)
  private async addSafetyNoticeIfNeeded(content: string, message: string): Promise<string> {
    const needsSafety = isSubstanceQuery(message);
    if (!needsSafety || /safety notice|disclaimer/i.test(content)) {
      return content;
    }
    
    const lang = languageStore.get();
    let safety = "**Safety notice:** I can't help with the use or procurement of illegal or harmful substances. If ingestion, overdose, or poisoning is involved, seek immediate medical care. I can share general risks and support resources.";
    
    if (lang.code !== 'en') {
      try {
        safety = await azureTranslator.translateText(safety, { to: lang.code });
      } catch {
        // Use English fallback if translation fails
      }
    }
    
    // Sanitize content if needed
    let sanitized = needsSafety ? sanitizeSubstanceContent(content) : content;
    return `${safety}\n\n${sanitized}`;
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
