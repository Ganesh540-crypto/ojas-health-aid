import { GoogleGenAI, DynamicRetrievalConfigMode } from '@google/genai';
import { googleSearchService } from './googleSearch';

const API_KEY = 'AIzaSyDGlcM72TRk56b-IeGzIqChhYHN3y5gPYw';

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
    this.ai = new GoogleGenAI({
      apiKey: API_KEY,
    });
  }

  private isHealthRelated(message: string): boolean {
    const healthKeywords = [
      'health', 'pain', 'symptom', 'medicine', 'medication', 'doctor', 'hospital',
      'injury', 'hurt', 'sick', 'fever', 'headache', 'stomach', 'chest',
      'breathing', 'blood', 'pressure', 'diabetes', 'cancer', 'treatment',
      'prescription', 'pill', 'drug', 'allergy', 'infection', 'virus',
      'bacteria', 'disease', 'condition', 'diagnosis', 'therapy', 'surgery',
      'emergency', 'urgent', 'serious', 'chronic', 'acute', 'prevention',
      'wellness', 'fitness', 'diet', 'nutrition', 'exercise', 'sleep',
      'mental health', 'anxiety', 'depression', 'stress', 'fatigue'
    ];
    
    const lowerMessage = message.toLowerCase();
    return healthKeywords.some(keyword => lowerMessage.includes(keyword));
  }

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

  private detectTone(message: string): string {
    const casual = /\b(hey|hi|yo|sup|what's up|whatsup|bro|dude|lol|haha|cool|awesome|nice|wassup|howdy)\b/i;
    const romantic = /\b(love|heart|romantic|beautiful|gorgeous|sweetheart|darling|honey)\b/i;
    const angry = /\b(angry|mad|frustrated|annoyed|pissed|hate|stupid|damn|wtf|fuck)\b/i;
    const lazy = /\b(lazy|tired|sleepy|bored|meh|whatever|dunno|idk|can't be bothered)\b/i;
    
    if (angry.test(message)) return 'angry';
    if (romantic.test(message)) return 'romantic';
    if (lazy.test(message)) return 'lazy';
    if (casual.test(message)) return 'casual';
    
    return 'neutral';
  }

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

  async generateResponse(message: string): Promise<{
    content: string;
    isHealthRelated: boolean;
  }> {
    try {
      const isHealthQuery = this.isHealthRelated(message);
      const isImportantHealth = isHealthQuery && this.isImportantHealthQuery(message);
      const tone = this.detectTone(message);
      
      // Enhanced system instructions with context
      let enhancedInstructions = SYSTEM_INSTRUCTIONS;
      
      if (this.conversationMemory.length > 0) {
        enhancedInstructions += `\n\nIMPORTANT CONVERSATION CONTEXT:\n${this.conversationMemory.join('\n')}`;
      }

      if (tone !== 'neutral') {
        enhancedInstructions += `\n\nUSER TONE DETECTED: ${tone.toUpperCase()} - Adapt your response tone to match theirs while maintaining helpfulness. For casual tone like "hey bro", respond warmly and casually like "Hey! What can I help you with?" without being overly professional.`;
      }

      // Perform web search for health-related queries or company information
      let searchContext = '';
      let sourcesMarkdown = '';
      if (this.shouldPerformWebSearch(message)) {
        let searchQuery = '';
        if (isHealthQuery) {
          // Bias toward authoritative/India-relevant sources
          searchQuery = `${message} site:.gov OR site:.org OR site:.edu OR india`;
        } else {
          searchQuery = message; // For company/creator queries
        }
        
        const searchResults = await googleSearchService.search(searchQuery, 3);
        if (searchResults.length > 0) {
          sourcesMarkdown = googleSearchService.formatSearchResults(searchResults);
          searchContext = `RELEVANT SEARCH RESULTS:\n${sourcesMarkdown}`;
        }
      }

      const config = {
        systemInstruction: enhancedInstructions,
        tools: [], // No Gemini tools needed since we're using custom search
        ...(isImportantHealth && {
          thinkingConfig: {
            thinkingBudget: -1,
          }
        })
      };

      // Include conversation history for context
      const contents = [
        ...this.conversationHistory.slice(-6), // Last 3 exchanges
        ...(searchContext ? [{ role: 'user', parts: [{ text: searchContext }] }] : []),
        {
          role: 'user',
          parts: [{ text: message }],
        },
      ];

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
      
      // Append sources for user visibility if available
      const responseWithSources = sourcesMarkdown
        ? `${finalResponse}\n\nSources:\n${sourcesMarkdown}`
        : finalResponse;
      
      // Add to memory
      this.addToMemory(message, responseWithSources, isHealthQuery);

      return {
        content: responseWithSources,
        isHealthRelated: isHealthQuery
      };
    } catch (error) {
      console.error('Gemini API Error:', error);
      return {
        content: 'I apologize, but I encountered an error while processing your request. Please try again.',
        isHealthRelated: false
      };
    }
  }
}

export const geminiService = new GeminiService();