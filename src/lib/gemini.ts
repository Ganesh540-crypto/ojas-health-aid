import { GoogleGenAI } from '@google/genai';

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
      'emergency', 'urgent', 'serious', 'chronic', 'acute', 'prevention'
    ];
    
    const lowerMessage = message.toLowerCase();
    return healthKeywords.some(keyword => lowerMessage.includes(keyword));
  }

  async generateResponse(message: string): Promise<{
    content: string;
    isHealthRelated: boolean;
  }> {
    try {
      const isHealthQuery = this.isHealthRelated(message);
      
      const tools = isHealthQuery ? [
        {
          googleSearch: {}
        }
      ] : [];

      const config = {
        systemInstruction: SYSTEM_INSTRUCTIONS,
        tools,
        ...(isHealthQuery && {
          thinkingConfig: {
            thinkingBudget: -1,
          }
        })
      };

      const contents = [
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

      return {
        content: fullResponse || 'I apologize, but I was unable to generate a response. Please try again.',
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