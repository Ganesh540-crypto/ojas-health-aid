import { GoogleGenAI } from '@google/genai';
import { geminiLiteService } from './geminiLite';
import { geminiSearchService } from './geminiSearch';
import { healthIntakeService, type HealthIntakePayload } from './healthIntake';
import { memoryStore } from './memory';
import { enhancedMemoryStore } from './memoryEnhanced';
import { executeMemoryExtraction } from './aiMemoryExtractor';
import { isSubstanceQuery, sanitizeSubstanceContent, needsFreshData, getHealthConfidence, isHealthRelated } from './textAnalysis';
import { profileStore } from './profileStore';
import { languageStore } from './languageStore';
import { azureTranslator } from './azureTranslator';
import { auth, db } from './firebase';
import { ref, get } from 'firebase/database';
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
  private model: string = 'gemini-flash-lite-latest';

  constructor() {
    if (!API_KEY) {
      console.warn('Gemini API key missing: set VITE_GEMINI_API_KEY in your .env file');
    }
    this.ai = new GoogleGenAI({ apiKey: API_KEY });
  }

  // OPTIMIZED STREAMING ROUTER - Uses fast deterministic classifier to eliminate 30s delay
  // Based on IBM Router research: lightweight classification, not full LLM inference
  async routeStream(
    message: string,
    chatId?: string,
    opts?: { files?: File[]; onStatusChange?: (status: 'routing' | 'preparing_intake' | 'analyzing_health') => void }
  ): Promise<
    | { intake: HealthIntakePayload; awaitingIntakeAnswers: true }
    | {
        model: 'lite' | 'health';
        isHealthRelated: boolean;
        start: (onChunk: (delta: string) => void, onEvent?: (evt: any) => void) => { stop: () => void; finished: Promise<RouteResult> };
      }
  > {
    // Add to both old and new memory systems
    memoryStore.addUser(message);
    enhancedMemoryStore.addToMainContext('user', message, { chatId });
    
    // Load context in parallel with routing decision (non-blocking)
    const contextPromise = (async () => {
      try {
        const [profile, historyContext, coreMemory] = await Promise.race([
          Promise.all([
            profileStore.get(),
            Promise.resolve(memoryStore.getPlainHistory(8)),
            Promise.resolve(enhancedMemoryStore.getCoreMemoryString())
          ]),
          new Promise<[any, string, string]>((_, reject) => setTimeout(() => reject(new Error('Context timeout')), 5000))
        ]);
        return { 
          profile, 
          historyContext, 
          coreMemory,
          profileSummary: this.buildProfileSummary(profile) 
        };
      } catch {
        return { profile: {}, historyContext: '', coreMemory: '', profileSummary: '' };
      }
    })();

    // Handle structured intake answers directly with full model
    if (/^\s*\{\s*"intakeAnswers"/i.test(message)) {
      const { profile, profileSummary } = await contextPromise;
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
      // Load user memories for intake-driven health streaming as well
      const userMemoryContext = await this.getUserMemoryContext(chatId);

      const hpIntake: GenAIHistoryPart[] = [
        ...(contextPack ? [{ role: 'user' as const, parts: [{ text: contextPack }] }] : []),
        ...(profileSummary ? [{ role: 'user' as const, parts: [{ text: profileSummary }] }] : []),
        ...memoryStore.getHistoryParts(),
      ];
      return {
        model: 'health',
        isHealthRelated: true,
        start: (onChunk: (delta: string) => void, onEvent?: (evt: any) => void) => {
          const controller = geminiSearchService.streamResponse(
            message,
            { historyParts: hpIntake, forceSearch: true, thinkingBudget: -1, memoryContext: userMemoryContext },
            onChunk,
            onEvent
          );
          return {
            stop: controller.stop,
            finished: controller.finished.then(async (resp: any) => {
              let content = await this.addSafetyNoticeIfNeeded(resp.content || '', message);
              memoryStore.addAssistant(content);
              if (chatId) this.updateChatTitle(chatId, message, content);
              return { content, isHealthRelated: true, decision: 'critical', modelUsed: 'gemini-flash-latest', sources: resp.sources } as RouteResult;
            })
          };
        }
      };
    }

    // HYBRID ROUTING: Fast classifier + Lite LLM for borderline cases
    // Based on AWS/RouteLLM research: saves time on clear cases, uses LLM for edge cases
    const healthConfidence = getHealthConfidence(message);
    console.log('⚡ Fast health classification:', { confidence: healthConfidence.toFixed(2) });
    
    // Analyze conversation context for intelligent follow-up detection
    const previousMessages = memoryStore.getHistory();
    const lastAssistantMessage = previousMessages.filter(m => m.role === 'assistant').slice(-1)[0]?.content || '';
    const last2UserMessages = previousMessages.filter(m => m.role === 'user').slice(-2).map(m => m.content);
    
    // Check if user is asking about their own preferences/data from memory
    const isAskingAboutOwnData = /\b(my|which food i|what food i|do you (remember|recall|know)|tell me about (my|what i))\b/i.test(message.toLowerCase());
    const hasRecentMemoryRecall = /noted|remember|saved|preference|told me|dislikes?|likes?/i.test(lastAssistantMessage.toLowerCase());
    const isMemoryFollowUp = isAskingAboutOwnData || (hasRecentMemoryRecall && /(with|using|cooked|dishes?|recipe|food|meal)/i.test(message.toLowerCase()));
    
    const isSummarizationRequest = /^(summariz|shorter|brief|concise|tldr|condense)/i.test(message.toLowerCase());
    const hasRecentContext = previousMessages.length > 0;
    const startsWithTransition = /^(and |also |but |however |additionally |furthermore |moreover |convert |change |make it |in |to |as )/i.test(message.toLowerCase());
    const referencesContext = /(this|that|it|these|those|them|previous|above|mentioned)/i.test(message.toLowerCase());
    const isFollowUp = hasRecentContext && (startsWithTransition || referencesContext || /^(elaborate|clarify|tell me more|more details|continue)/i.test(message.toLowerCase()));
    const hasRecentHealthResponse = /health|medical|symptoms|treatment|medicine|🏥 Quick Health Assessment/i.test(lastAssistantMessage);
    const hasRecentIntake = /🏥 Quick Health Assessment/.test(lastAssistantMessage);
    
    // Skip health intake if: summarization, memory follow-up, or health follow-up
    const skipHealthIntake = isSummarizationRequest || isMemoryFollowUp || (isFollowUp && hasRecentHealthResponse) || hasRecentIntake;
    const forceSearchLite = needsFreshData(message);
    const historyParts = memoryStore.getHistoryParts(12);

    // HYBRID ROUTING DECISION (AWS/RouteLLM best practice)
    let isHealthQuery = false;
    let routingMethod = 'fast_classifier';
    
    if (skipHealthIntake || message.toLowerCase().includes('how do you know') || message.toLowerCase().includes('how did you get')) {
      isHealthQuery = false;
      routingMethod = 'context_skip';
    } else if (healthConfidence >= 0.55) {
      // High confidence - trust fast classifier (saves 200-500ms)
      isHealthQuery = true;
      routingMethod = 'fast_high_confidence';
    } else if (healthConfidence < 0.2) {
      // Very low confidence - clearly not health
      isHealthQuery = false;
      routingMethod = 'fast_low_confidence';
    } else {
      // Borderline (0.2-0.55) - ask lite LLM for second opinion
      // Catches: complex medical terms, creative misspellings, edge cases
      routingMethod = 'llm_classifier_check';
      
      // Signal to UI that we're verifying with LLM
      if (opts?.onStatusChange) {
        opts.onStatusChange('routing' as any);
      }
      
      isHealthQuery = await this.askLiteLLMClassifier(message);
    }

    console.log('🎯 Routing decision:', { 
      healthConfidence: healthConfidence.toFixed(2),
      isHealthQuery,
      routingMethod,
      skipHealthIntake,
      isFollowUp
    });

    if (isHealthQuery) {
      // Wait for context before generating intake
      const { profileSummary } = await contextPromise;
      
      // Signal to UI that we're preparing health intake
      if (!skipHealthIntake && opts?.onStatusChange) {
        opts.onStatusChange('preparing_intake');
      }
      
      // Generate intake questions for NEW health queries (not follow-ups)
      const intake = (!skipHealthIntake) ? await healthIntakeService.generateQuestions(message) : null;
      if (intake && intake.questions && intake.questions.length > 0) {
        return { intake, awaitingIntakeAnswers: true } as any;
      }
      
      // If no intake, signal analyzing health context
      if (opts?.onStatusChange) {
        opts.onStatusChange('analyzing_health');
      }
      
      // Load user memories for health model (like ChatGPT/Gemini)
      const userMemoryContext = await this.getUserMemoryContext(chatId);
      
      // Health stream starter (immediate streaming, no blocking)
      const hpHealth: GenAIHistoryPart[] = [
        ...(profileSummary ? [{ role: 'user' as const, parts: [{ text: profileSummary }] }] : []),
        ...memoryStore.getHistoryParts(),
      ];
      
      return {
        model: 'health',
        isHealthRelated: true,
        start: (onChunk: (delta: string) => void, onEvent?: (evt: any) => void) => {
          console.log('🚀 [AIRouter] Starting HEALTH model with chatId:', chatId);
          const controller = geminiSearchService.streamResponse(
            message,
            { 
              historyParts: hpHealth, 
              forceSearch: true, 
              thinkingBudget: -1, 
              files: opts?.files,
              chatId: chatId,
              messageId: undefined,
              memoryContext: userMemoryContext // Inject memories into health model too
            },
            onChunk,
            onEvent
          );
          return {
            stop: controller.stop,
            finished: controller.finished.then(async (resp: any) => {
              let content = await this.addSafetyNoticeIfNeeded(resp.content || '', message);
              memoryStore.addAssistant(content);
              if (chatId) this.updateChatTitle(chatId, message, content);
              this.scheduleBackgroundSummary(chatId, message, content);
              
              return { content, isHealthRelated: true, decision: 'critical', modelUsed: 'gemini-flash-latest', sources: resp.sources } as RouteResult;
            })
          };
        }
      };
    }

    // Non-health: lite stream starter (immediate streaming)
    const { profileSummary, historyContext } = await contextPromise;
    // Load user memories to inject into context (fast, pre-loaded)
    const userMemoryContext = await this.getUserMemoryContext(chatId);
    const needsLiteSearch = needsFreshData(message);
    
    // Non-health path: use lite model with streaming
    return {
      model: 'lite' as const,
      isHealthRelated: false,
      start: (onChunk: (delta: string) => void, onEvent?: (evt: any) => void) => {
        const controller = geminiLiteService.streamResponse(message, {
          historyParts: memoryStore.getHistoryParts(12),
          forceSearch: needsLiteSearch,
          thinkingBudget: -1,
          files: opts?.files,
          chatId: chatId,
          messageId: undefined, // messageId will be generated by ChatContainer
          memoryContext: userMemoryContext // Inject memories into context
        } as any, onChunk, onEvent);
        return {
          stop: controller.stop,
          finished: controller.finished.then(async (resp: any) => {
            let content = resp.content || '';
            console.log('🔍 [AIRouter] Response received:', { hasContent: !!content });
            content = await this.addSafetyNoticeIfNeeded(content, message);
            memoryStore.addAssistant(content);
            if (chatId) this.updateChatTitle(chatId, message, content);
            this.scheduleBackgroundSummary(chatId, message, content);
            return { content, isHealthRelated: false, decision: 'casual', modelUsed: 'gemini-flash-lite-latest', sources: resp.sources } as RouteResult;
          })
        };
      }
    };
  }

  async route(message: string, chatId?: string, opts?: { files?: File[] }): Promise<RouteResult> {
    // Add to both memory systems
    memoryStore.addUser(message);
    enhancedMemoryStore.addToMainContext('user', message, { chatId });
    
    // Get user profile and history context with timeout
    let profile, historyContext, profileSummary;
    try {
      const contextPromise = Promise.all([
        profileStore.get(),
        Promise.resolve(memoryStore.getPlainHistory(8))
      ]);
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Context loading timeout')), 5000)
      );
      
      const [profileResult, historyResult] = await Promise.race([
        contextPromise,
        timeoutPromise
      ]) as [any, string];
      
      profile = profileResult;
      historyContext = historyResult;
      profileSummary = this.buildProfileSummary(profile);
    } catch (error) {
      console.error('❌ Context loading failed:', error);
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
      
      // Load user memories for intake processing too
      const userMemoryContext = await this.getUserMemoryContext(chatId);
      
      const hpIntake: GenAIHistoryPart[] = [
        ...(contextPack ? [{ role: 'user' as const, parts: [{ text: contextPack }] }] : []),
        ...(profileSummary ? [{ role: 'user' as const, parts: [{ text: profileSummary }] }] : []),
        ...memoryStore.getHistoryParts(),
      ];
      const resp = await geminiSearchService.generateResponse(message, {
        historyParts: hpIntake,
        forceSearch: true, // Force web search for intake answer processing
        memoryContext: userMemoryContext
      });
      
      // Inject Safety Notice for substance/danger queries
      const labeled = await this.addSafetyNoticeIfNeeded(resp.content, message);
      memoryStore.addAssistant(labeled);
      return { ...resp, content: labeled, isHealthRelated: true, decision: 'critical', modelUsed: 'gemini-flash-latest', sources: resp.sources };
    }

    // FAST DETERMINISTIC HEALTH CLASSIFICATION (no blocking LLM call)
    const healthConfidence = getHealthConfidence(message);
    const forceSearchLite = needsFreshData(message);
    
    // Check if this is a follow-up question about previous responses
    const previousMessages = memoryStore.getHistory();
    const lastAssistantMessage = previousMessages.filter(m => m.role === 'assistant').slice(-1)[0]?.content || '';
    
    const isSummarizationRequest = /^(summariz|shorter|brief|concise|tldr|condense)/i.test(message.toLowerCase());
    const hasRecentContext = previousMessages.length > 0;
    const startsWithTransition = /^(and |also |but |however |additionally |furthermore |moreover |convert |change |make it |in |to |as )/i.test(message.toLowerCase());
    const referencesContext = /(this|that|it|these|those|them|previous|above|mentioned)/i.test(message.toLowerCase());
    const isFollowUp = hasRecentContext && (
      startsWithTransition || 
      referencesContext ||
      /^(elaborate|clarify|tell me more|more details|continue)/i.test(message.toLowerCase())
    );
    
    const hasRecentHealthResponse = /health|medical|symptoms|treatment|medicine|🏥 Quick Health Assessment/i.test(lastAssistantMessage);
    const hasRecentIntake = /🏥 Quick Health Assessment/.test(lastAssistantMessage);
    const skipHealthIntake = isSummarizationRequest || (isFollowUp && hasRecentHealthResponse) || hasRecentIntake;
    const historyParts = memoryStore.getHistoryParts(12);

    // ROUTING DECISION: Use fast classifier instead of blocking LLM call
    const isHealthQuery = healthConfidence > 0.4 && 
                         !message.toLowerCase().includes('how do you know') &&
                         !message.toLowerCase().includes('how did you get');
    
    console.log('⚡ Fast routing decision:', { 
      healthConfidence: healthConfidence.toFixed(2),
      isHealthQuery,
      skipHealthIntake
    });
    
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
          modelUsed: 'gemini-flash-latest',
          intake,
          awaitingIntakeAnswers: true
        };
      }

      // Load user memories for health model
      const userMemoryContext = await this.getUserMemoryContext(chatId);
      
      // Use full model for health-related expertise with mandatory web search
      const hpHealth: GenAIHistoryPart[] = [
        ...(profileSummary ? [{ role: 'user' as const, parts: [{ text: profileSummary }] }] : []),
        ...memoryStore.getHistoryParts(),
      ];
      const resp = await geminiSearchService.generateResponse(message, {
        historyParts: hpHealth,
        forceSearch: true, // Always search for health queries
        thinkingBudget: -1, // Enable full thinking mode for complex health analysis
        memoryContext: userMemoryContext
      });

      console.log('✅ HEALTH MODEL response:', {
        contentLength: resp.content.length,
        sources: resp.sources?.length || 0,
        hasGrounding: !!resp.sources
      });
      // Sanitize and label if substance-related
      const contentH = await this.addSafetyNoticeIfNeeded(resp.content, message);
      memoryStore.addAssistant(contentH);
      this.scheduleBackgroundSummary(chatId, message, contentH);
      
      // Generate smart chat title if needed
      if (chatId) {
        this.updateChatTitle(chatId, message, contentH);
      }
      
      return { ...resp, content: contentH, isHealthRelated: true, decision: 'critical', modelUsed: 'gemini-flash-latest', sources: resp.sources };
    }

    // Load user memories for lite model
    const userMemoryContext = await this.getUserMemoryContext(chatId);
    
    // For non-health queries, use lite model for response
    const liteResp = await geminiLiteService.generateResponse(message, {
      historyText: [profileSummary, historyContext].filter(Boolean).join('\n\n'),
      historyParts: historyParts,
      forceSearch: forceSearchLite || isFollowUp,
      thinkingBudget: -1,
      files: opts?.files,
      memoryContext: userMemoryContext
    } as any);
    
    const labeled = await this.addSafetyNoticeIfNeeded(liteResp.content, message);
    memoryStore.addAssistant(labeled);
    this.scheduleBackgroundSummary(chatId, message, labeled);
    
    if (chatId) {
      this.updateChatTitle(chatId, message, labeled);
    }
    
    console.log('✅ Non-health route completed', {
      decision: 'casual',
      modelUsed: 'gemini-flash-lite-latest',
      contentLength: labeled.length,
      sourcesCount: liteResp.sources?.length || 0
    });
    
    return { 
      content: labeled, 
      isHealthRelated: false, 
      decision: 'casual', 
      modelUsed: 'gemini-flash-lite-latest', 
      sources: liteResp.sources 
    };
  }

  private buildProfileSummary(profile: any): string {
    if (!Object.keys(profile).length) return '';
    
    return `USER PROFILE\nName: ${profile.name ?? ''}\nAge: ${profile.age ?? ''}\nHeight(cm): ${profile.heightCm ?? ''}\nWeight(kg): ${profile.weightKg ?? ''}\nAllergies: ${(profile.allergies || []).join(', ')}\nConditions: ${(profile.preexisting || []).join(', ')}\nMeds: ${(profile.medications || []).join(', ')}`;
  }

  // Helper to add safety notice if needed (consolidates duplicate logic)
  // Lite LLM Classifier for borderline cases (AWS/RouteLLM hybrid approach)
  // Fast ~200-500ms check to catch medical terms we missed
  private async askLiteLLMClassifier(message: string): Promise<boolean> {
    try {
      const classifierPrompt = `You are a medical query classifier. Analyze this query and respond with ONLY "YES" if it's health/medical related, or "NO" if it's not.

Query: "${message}"

Consider it health-related if it mentions:
- Symptoms (pain, fever, headache, nausea, etc.)
- Medical conditions or diseases
- Medications or treatments
- Body parts in medical context
- Health concerns or questions

Respond with ONLY one word: YES or NO`;

      const response = await this.ai.models.generateContent({
        model: this.model,
        config: {
          temperature: 0, // Deterministic classification
          maxOutputTokens: 10
        },
        contents: [
          { role: 'user', parts: [{ text: classifierPrompt }] }
        ]
      });

      const answer = (response as any).text?.toLowerCase().trim() || '';
      const isHealth = answer.includes('yes');
      
      console.log('🤖 LLM Classifier:', { 
        query: message.slice(0, 50),
        answer: answer.slice(0, 20),
        isHealth 
      });
      
      return isHealth;
    } catch (error) {
      console.error('❌ LLM classifier failed, defaulting to false:', error);
      // On error, default to false (non-health) to avoid blocking general queries
      return false;
    }
  }

  private scheduleBackgroundSummary(chatId: string | undefined, userMessage: string, aiResponse: string) {
    try {
      (async () => {
        try {
          // Throttle summaries per chat to avoid flooding memory (min 2 minutes between saves)
          if (chatId) {
            const guardKey = `ojas_summary_guard_${chatId}`;
            const rawGuard = localStorage.getItem(guardKey);
            let last = 0;
            try { if (rawGuard) last = JSON.parse(rawGuard)?.last || 0; } catch {}
            if (Date.now() - last < 2 * 60 * 1000) return;
            try { localStorage.setItem(guardKey, JSON.stringify({ last: Date.now() })); } catch {}
          }

          const prompt = `Return ONLY a JSON object with fields: summary (one sentence) and keyPoints (array of up to 3 short strings). No markdown, no code fences.\n\nUser: ${userMessage.slice(0, 800)}\nAssistant: ${aiResponse.slice(0, 800)}`;
          const resp = await geminiLiteService.generateResponse(prompt, { forceSearch: false });
          const raw = (resp.content || '').trim();
          const stripFences = (s: string) => s.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
          const tryParse = (s: string) => { try { return JSON.parse(s); } catch { return null; } };

          let parsed: any = tryParse(stripFences(raw));
          if (!parsed) {
            const start = raw.indexOf('{');
            const end = raw.lastIndexOf('}');
            if (start !== -1 && end > start) parsed = tryParse(raw.slice(start, end + 1));
          }

          const summary: string = String(parsed?.summary || raw.slice(0, 200));
          const keyPoints: string[] = Array.isArray(parsed?.keyPoints) ? parsed.keyPoints.slice(0, 3).map(String) : [];

          if (summary && summary.trim().length > 0) {
            await executeMemoryExtraction('createConversationSummary', { summary, keyPoints }, { chatId });
          }
        } catch (err) {
          console.warn('Background summarization failed:', err);
        }
      })();
    } catch {}
  }

  private async getUserMemoryContext(chatId?: string): Promise<string> {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) return '';

      console.log('📥 [AIRouter] Loading user memory context...');

      const [profileSnap, factsSnap] = await Promise.all([
        get(ref(db, `users/${userId}/memory/profile`)),
        get(ref(db, `users/${userId}/memory/archival`)),
      ]);

      const parts: string[] = [];
      if (profileSnap.exists()) {
        const profile = profileSnap.val();
        if (profile.personalDetails) parts.push(`**About You**: ${profile.personalDetails}`);
        if (profile.healthSummary) parts.push(`**Health Info**: ${profile.healthSummary}`);
        if (profile.importantPreferences) parts.push(`**Preferences**: ${profile.importantPreferences}`);
      }

      if (factsSnap.exists()) {
        const facts: any[] = Object.values(factsSnap.val() || {});
        const recent = facts
          .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
          .slice(0, 5)
          .map((f: any) => f?.content)
          .filter(Boolean);
        if (recent.length > 0) parts.push(`**Saved Facts**: ${recent.join(', ')}`);
      }

      if (parts.length === 0) return '';
      const context = `\n\n--- USER MEMORY CONTEXT ---\n${parts.join('\n')}\n--- End Memory Context ---\n`;
      console.log('✅ [AIRouter] Loaded memory context:', parts.length, 'sections');
      return context;
    } catch (err) {
      console.warn('⚠️ Failed to load memory context:', err);
      return '';
    }
  }

  // Function-calling removed: no background execution of model-emitted function calls

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
