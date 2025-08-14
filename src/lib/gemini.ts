import { GoogleGenAI, DynamicRetrievalConfigMode } from '@google/genai';
import { googleSearchService, type GoogleSearchItem } from './googleSearch';
import { detectTone, isHealthRelated } from './textAnalysis';

const API_KEY = (import.meta.env?.VITE_GEMINI_API_KEY as string) || '';

const SYSTEM_INSTRUCTIONS = `You are Ojas, a professional AI health companion and friendly assistant created by MedTrack (https://medtrack.co.in) under VISTORA TRAYANA LLP. You are designed to respond to general health queries and casual user interactions. Your behavior must strictly follow these guidelines:

1. **Medical Responsibility**
   - For health-related queries only: Provide clear, evidence-based information.
   - Include relevant precautions, preventions, and lifestyle recommendations for health-related queries.
   - Never diagnose or prescribe. Avoid speculative or anecdotal advice.
   - DO NOT include medical disclaimers in your response text - the UI will handle warning labels separately.

2. **Tone Adaptation**
   - Detect and adapt to the user's tone based on input:
     - If casual (hey, bro, sup): Use relaxed, friendly language like "Hey! What's up?" or "Hello! How can I help?"
     - If romantic: Use warm, poetic, and emotionally intelligent phrasing.
     - If angry or frustrated: Respond calmly, validate emotions, and offer constructive guidance.
     - If lazy or silly: Be light-hearted but stay informative and on-topic.
   - For casual conversations: Be conversational and match their energy level.
   - For serious topics: Maintain appropriate professionalism.

3. **Topic Control**
   - For health-related queries: Stay focused on medical context. Do not drift into unrelated topics.
   - For casual chats: Match tone and be conversational, avoid excessive tangents.
   - If the user attempts to push the conversation into inappropriate territory, politely redirect.
   - If asked about MedTrack, VISTORA TRAYANA LLP, or your creator, perform a web search for current information.

4. **Clarity and Structure**
   - Use clear headings, bullet points, and concise formatting when appropriate.
   - Avoid repetition, vague statements, or filler content.
   - Ensure responses are complete, relevant, and logically organized.

Your goal is to be a reliable, emotionally aware AI assistant that adapts to user tone while providing helpful information.`;

export class GeminiService {
  private ai: GoogleGenAI;
  private model: string = 'gemini-2.5-flash';
  private conversationHistory: Array<{role: string, parts: Array<{text: string}>}> = [];
  private conversationMemory: string[] = [];

  constructor() {
    if (!API_KEY) {
      console.warn('Gemini API key missing: set VITE_GEMINI_API_KEY in your .env file');
    }
    this.ai = new GoogleGenAI({ apiKey: API_KEY });
  }

  private isHealthRelated(message: string): boolean { return isHealthRelated(message); }

  private shouldPerformWebSearch(message: string): boolean {
    const lowerMessage = message.toLowerCase();
    const searchTriggers = [
      'medtrack', 'vistora trayana', 'vistora trayana llp', 'your creator',
      'who created you', 'who made you', 'about medtrack', 'about vistora'
    ];
    
    return this.isHealthRelated(message) || 
           searchTriggers.some(trigger => lowerMessage.includes(trigger));
  }

  private isImportantHealthQuery(message: string): boolean {
    const seriousKeywords = [
      'severe', 'intense', 'emergency', 'urgent', 'serious', 'can\'t breathe',
      'chest pain', 'heart attack', 'stroke', 'bleeding', 'unconscious',
      'poisoning', 'overdose', 'allergic reaction', 'broken', 'fracture',
      'surgery', 'prescription', 'diagnosis', 'treatment plan'
    ];
    
    const lowerMessage = message.toLowerCase();
    return seriousKeywords.some(keyword => lowerMessage.includes(keyword));
  }

  private detectTone(message: string): string { return detectTone(message); }

  private addToMemory(userMessage: string, response: string, isHealthRelated: boolean) {
    this.conversationHistory.push(
      { role: 'user', parts: [{ text: userMessage }] },
      { role: 'model', parts: [{ text: response }] }
    );

    // Keep only last 10 exchanges to manage context length
    if (this.conversationHistory.length > 20) {
      this.conversationHistory = this.conversationHistory.slice(-20);
    }

    // Add important health topics to persistent memory
    if (isHealthRelated && this.isImportantHealthQuery(userMessage)) {
      const summary = `User asked about: ${userMessage.substring(0, 100)}... - Health consultation provided`;
      this.conversationMemory.push(summary);
      
      // Keep only last 5 important health consultations
      if (this.conversationMemory.length > 5) {
        this.conversationMemory = this.conversationMemory.slice(-5);
      }
    }
  }

  async generateResponse(
    message: string,
    options?: {
      forceSearch?: boolean;
      historyParts?: Array<{ role: string; parts: { text: string }[] }>;
      originalMessage?: string;
      rewrittenQuery?: string;
    }
  ): Promise<{
    content: string;
    isHealthRelated: boolean;
  }> {
    try {
      const baseForHealth = options?.originalMessage ?? message;
      const isHealthQuery = this.isHealthRelated(baseForHealth);
      const isImportantHealth = isHealthQuery && this.isImportantHealthQuery(baseForHealth);
      const tone = this.detectTone(baseForHealth);
      const forceSearch = options?.forceSearch === true;

      // Enhanced system instructions with strict grounding to sources when present
      let enhancedInstructions = SYSTEM_INSTRUCTIONS + `\n\nWhen SOURCES are provided, you MUST ground all factual statements in them and include inline bracket citations like [1], [2] that correspond to the numbered sources. Do not say you lack up-to-date information if sources are provided. Never state that you cannot browse the internet — you are given sources to read when available. If sources are insufficient or missing, say "No relevant sources found" briefly and ask one targeted clarifying question before proceeding.`;

      if (this.conversationMemory.length > 0) {
        enhancedInstructions += `\n\nIMPORTANT CONVERSATION CONTEXT:\n${this.conversationMemory.join('\n')}`;
      }

      if (tone !== 'neutral') {
        enhancedInstructions += `\n\nUSER TONE DETECTED: ${tone.toUpperCase()} - Adapt your response tone accordingly while staying helpful.`;
      }

      // Perform web search when requested or deemed necessary
      let searchContext = '';
      let sourcesMarkdown = '';
      if (forceSearch || this.shouldPerformWebSearch(baseForHealth)) {
        const baseQuery = options?.rewrittenQuery ?? baseForHealth;
        const lowerQ = baseQuery.toLowerCase();
        const productLike = /\b(buy|price|cost|cheap|affordable|low cost|tablet|capsule|supplement|omega|vitamin|protein|multivitamin|fish oil|algal oil)\b/.test(lowerQ);
        const cities = ['hyderabad','mumbai','delhi','new delhi','bangalore','bengaluru','chennai','kolkata','pune','ahmedabad','jaipur','surat','lucknow','indore','bhopal'];
        const foundCity = cities.find(c => lowerQ.includes(c));
        const locationPhrase = foundCity ? ` "${foundCity}"` : '';

        const evidenceFilter = `${baseQuery} site:.gov OR site:.org OR site:.edu OR india${locationPhrase}`;
        const ecommerceFilter = `${baseQuery}${locationPhrase} site:1mg.com OR site:pharmeasy.in OR site:netmeds.com OR site:apollo247.com OR site:amazon.in OR site:flipkart.com`;
        const plainQuery = `${baseQuery}${locationPhrase}`;

        const candidates = productLike ? [ecommerceFilter, plainQuery, evidenceFilter] : [evidenceFilter, plainQuery];

  let searchResults: GoogleSearchItem[] = [];
        for (const q of candidates) {
          const r = await googleSearchService.search(q, 5);
          if (r.length > 0) { searchResults = r; break; }
        }
        if (searchResults.length === 0) {
          const r = await googleSearchService.search(baseQuery, 5);
          if (r.length > 0) searchResults = r;
        }

        if (searchResults.length > 0) {
          sourcesMarkdown = googleSearchService.formatSearchResults(searchResults);
          searchContext = `SOURCES (numbered):\n${sourcesMarkdown}`;
        }
      }

  const config = {
        systemInstruction: enhancedInstructions,
        ...(isImportantHealth && {
          thinkingConfig: {
            thinkingBudget: -1,
          }
        })
      };

      // Build conversation context
      const history = options?.historyParts && options.historyParts.length > 0
        ? options.historyParts.slice(-6)
        : this.conversationHistory.slice(-6);

  const contents: Array<{ role: string; parts: { text: string }[] }> = [
        ...history,
      ];

      if (searchContext) {
        contents.push({ role: 'user', parts: [{ text: `You must answer grounded strictly in the SOURCES below. Use bracket citations like [1], [2] that map to the numbered sources. If information is insufficient, ask a clarifying question.\n\n${searchContext}` }] });
      }

      if (options?.rewrittenQuery || options?.originalMessage) {
        const combo = `ORIGINAL QUERY:\n${options?.originalMessage ?? message}\n\nREWRITTEN FOR RESEARCH:\n${options?.rewrittenQuery ?? ''}`.trim();
        contents.push({ role: 'user', parts: [{ text: combo }] });
      }

      contents.push({ role: 'user', parts: [{ text: message }] });

      const response = await this.ai.models.generateContentStream({
        model: this.model,
        config,
        contents,
      });

      let fullResponse = '';
      for await (const chunk of response) {
        if (chunk.text) {
          fullResponse += chunk.text;
        }
      }

      const finalResponse = fullResponse || 'I apologize, but I was unable to generate a response. Please try again.';

      const responseWithSources = sourcesMarkdown
        ? `${finalResponse}\n\nSources:\n${sourcesMarkdown}`
        : finalResponse;

      // Add to internal memory for continuity
      this.addToMemory(baseForHealth, responseWithSources, isHealthQuery);

      return {
        content: responseWithSources,
        isHealthRelated: isHealthQuery,
      };
    } catch (error) {
      console.error('Gemini API Error:', error);
      return {
        content: 'I apologize, but I encountered an error while processing your request. Please try again.',
        isHealthRelated: false,
      };
    }
  }
}

export const geminiService = new GeminiService();