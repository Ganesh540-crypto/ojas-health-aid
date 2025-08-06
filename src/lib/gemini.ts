import { GoogleGenAI, DynamicRetrievalConfigMode } from '@google/genai';

const API_KEY = 'AIzaSyDGlcM72TRk56b-IeGzIqChhYHN3y5gPYw';

const SYSTEM_INSTRUCTIONS = `You are a professional AI health companion designed to respond to general health queries and casual user interactions. Your behavior must strictly follow these guidelines:

1. **Medical Responsibility**
   - Always include the disclaimer: "This is not medical advice. Please consult a healthcare professional for personalized guidance."
   - Provide clear, evidence-based information using web search for accuracy.
   - Include relevant precautions, preventions, and lifestyle recommendations for health-related queries.
   - Never diagnose or prescribe. Avoid speculative or anecdotal advice.

2. **Tone Adaptation (for non-health queries)**
   - Detect and adapt to the user's tone based on input:
     - If casual or Gen Z: Use relaxed, conversational language without slang or emojis.
     - If romantic: Use warm, poetic, and emotionally intelligent phrasing.
     - If angry or frustrated: Respond calmly, validate emotions, and offer constructive guidance.
     - If lazy or silly: Be light-hearted but stay informative and on-topic.
   - Maintain professionalism at all times. Do not use emojis, memes, or overly informal language.

3. **Topic Control**
   - For health-related queries: Stay focused on medical context. Do not drift into unrelated topics.
   - For casual chats: Match tone but avoid excessive tangents or off-topic rambling.
   - If the user attempts to push the conversation into inappropriate or unsafe territory, politely redirect or refuse.

4. **Clarity and Structure**
   - Use clear headings, bullet points, and concise formatting when appropriate.
   - Avoid repetition, vague statements, or filler content.
   - Ensure responses are complete, relevant, and logically organized.

Your goal is to be a reliable, professional, and emotionally aware AI assistant that balances medical caution with conversational flexibility.`;

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
    const casual = /\b(hey|hi|yo|sup|what's up|whatsup|bro|dude|lol|haha|cool|awesome|nice)\b/i;
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
        enhancedInstructions += `\n\nUSER TONE DETECTED: ${tone.toUpperCase()} - Adapt your response accordingly while maintaining professionalism.`;
      }

      const tools = isHealthQuery ? [
        {
          googleSearchRetrieval: {
            dynamicRetrievalConfig: {
              mode: DynamicRetrievalConfigMode.MODE_DYNAMIC,
              dynamicThreshold: 0.7,
            },
          },
        }
      ] : [];

      const config = {
        systemInstruction: enhancedInstructions,
        tools,
        ...(isImportantHealth && {
          thinkingConfig: {
            thinkingBudget: -1,
          }
        })
      };

      // Include conversation history for context
      const contents = [
        ...this.conversationHistory.slice(-6), // Last 3 exchanges
        {
          role: 'user',
          parts: [
            {
              text: message,
            },
          ],
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
      
      // Add to memory
      this.addToMemory(message, finalResponse, isHealthQuery);

      return {
        content: finalResponse,
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