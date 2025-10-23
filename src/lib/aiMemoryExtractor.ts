/**
 * AI-Driven Memory Extraction
 * 
 * Saves to Firebase Realtime Database in user's memory path
 * Path: users/{userId}/memory/
 */

import { enhancedMemoryStore } from './memoryEnhanced';
import { ref, push, set, update, serverTimestamp } from 'firebase/database';
import { db, auth } from './firebase';

interface ExtractedMemory {
  type: 'health_data' | 'user_preference' | 'personal_info' | 'important_fact';
  content: string;
  importance: 'low' | 'medium' | 'high';
  summary: string; // AI-generated concise summary
}

class AIMemoryExtractor {
  /**
   * AI analyzes conversation and extracts important info
   * This is called by the AI during response generation via function calling
   */
  async extractAndStore(
    userMessage: string,
    aiResponse: string,
    chatId: string,
    messageId: string
  ): Promise<void> {
    // This will be called by AI via function call
    // AI decides what's important, not regex patterns!
    
    console.log('🧠 AI extracting memories from conversation...');
  }

  /**
   * AI generates a summary of important conversation points
   * Called periodically (every 5-10 messages) or when chat ends
   */
  async summarizeConversation(
    chatId: string,
    recentMessages: Array<{ role: 'user' | 'assistant'; content: string }>
  ): Promise<string> {
    // AI will analyze recent messages and create a summary
    // Store this summary for future recall
    
    console.log('📝 AI summarizing conversation...');
    return '';
  }

  /**
   * Update user profile based on AI's understanding
   * AI extracts: name, age, health conditions, preferences, etc.
   */
  async updateProfileFromConversation(
    userMessage: string,
    chatId: string
  ): Promise<void> {
    // AI will call this when it learns something new about the user
    console.log('👤 AI updating user profile...');
  }
}

export const aiMemoryExtractor = new AIMemoryExtractor();

/**
 * Function declarations for AI to call during response generation
 * These run in BACKGROUND while AI is responding
 */
export const memoryExtractionFunctions = {
  extractImportantInfo: {
    name: 'extractImportantInfo',
    description: 'Extract and store important information from the conversation. Call this when user shares: health data (symptoms, medications, measurements), personal details (age, occupation, location), preferences (diet, exercise, communication style), or important facts that should be remembered long-term.',
    parameters: {
      type: 'object',
      properties: {
        content: {
          type: 'string',
          description: 'The important information to remember (e.g., "User has Type 2 diabetes, takes metformin 500mg twice daily")'
        },
        type: {
          type: 'string',
          enum: ['health_data', 'personal_info', 'user_preference', 'important_fact'],
          description: 'Category of information'
        },
        importance: {
          type: 'string',
          enum: ['low', 'medium', 'high'],
          description: 'How critical is this information'
        },
        summary: {
          type: 'string',
          description: 'Brief 1-sentence summary for quick recall (e.g., "User manages diabetes with metformin")'
        }
      },
      required: ['content', 'type', 'summary']
    }
  },

  updateProfileSummary: {
    name: 'updateProfileSummary',
    description: 'Update the user profile summary when learning new information about them. Use for: name, age, occupation, health conditions, medications, allergies, lifestyle, preferences.',
    parameters: {
      type: 'object',
      properties: {
        personalDetails: {
          type: 'string',
          description: 'Personal info summary (e.g., "32-year-old software engineer from Hyderabad")'
        },
        healthSummary: {
          type: 'string',
          description: 'Health status summary (e.g., "Type 2 diabetes, takes metformin, monitors blood sugar daily")'
        },
        preferences: {
          type: 'string',
          description: 'Lifestyle/preferences summary (e.g., "Vegetarian, exercises 3x/week, prefers natural remedies")'
        },
        communicationStyle: {
          type: 'string',
          description: 'How user likes to communicate (e.g., "Prefers detailed explanations with scientific backing")'
        }
      }
    }
  },

  createConversationSummary: {
    name: 'createConversationSummary',
    description: 'Create a summary of the current conversation. Call this every 5-10 messages or when conversation topic changes significantly. Helps remember what was discussed.',
    parameters: {
      type: 'object',
      properties: {
        summary: {
          type: 'string',
          description: 'Concise summary of what was discussed (e.g., "Discussed blood sugar management and dietary changes for diabetes")'
        },
        keyPoints: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of 3-5 key takeaways from the conversation'
        },
        importance: {
          type: 'string',
          enum: ['low', 'medium', 'high'],
          description: 'Overall importance of this conversation'
        }
      },
      required: ['summary', 'keyPoints']
    }
  }
};

/**
 * Execute memory extraction functions called by AI
 */
export async function executeMemoryExtraction(
  functionName: string,
  args: Record<string, any>,
  context: { chatId?: string; messageId?: string; userId?: string }
): Promise<{ success: boolean; message: string }> {
  console.log('🎯 executeMemoryExtraction called!');
  console.log('Function:', functionName);
  console.log('Args:', args);
  console.log('Context:', context);
  
  try {
    switch (functionName) {
      case 'extractImportantInfo': {
        console.log('📦 Handling extractImportantInfo');
        const { content, type, importance = 'medium', summary } = args;
        
        const userId = auth.currentUser?.uid;
        if (!userId) {
          console.warn('⚠️ No user logged in, storing locally only');
          enhancedMemoryStore.addToArchivalMemory(content, type, { importance, summary });
          return { success: true, message: 'Stored locally (not logged in)' };
        }
        
        // Store in Realtime Database
        try {
          const memoryRef = ref(db, `users/${userId}/memory/archival`);
          const newMemoryRef = push(memoryRef);
          
          await set(newMemoryRef, {
            content,
            type,
            importance,
            summary,
            chatId: context.chatId || null,
            messageId: context.messageId || null,
            timestamp: serverTimestamp()
          });
          
          console.log('✅ Saved to Realtime Database:', newMemoryRef.key);
          
          // Also store locally for immediate access
          enhancedMemoryStore.addToArchivalMemory(content, type, { importance, summary });
          
          return {
            success: true,
            message: `Extracted and stored ${type}: ${summary}`
          };
        } catch (error) {
          console.error('❌ Failed to save to database:', error);
          // Fallback to local storage
          enhancedMemoryStore.addToArchivalMemory(content, type, { importance, summary });
          return { success: false, message: 'Saved locally only' };
        }
      }

      case 'createConversationSummary': {
        const { summary, keyPoints, importance = 'medium' } = args;
        
        const userId = auth.currentUser?.uid;
        if (!userId) {
          enhancedMemoryStore.addToArchivalMemory(summary, 'conversation', { keyPoints, importance });
          return { success: true, message: 'Saved locally only' };
        }
        
        try {
          const summaryRef = ref(db, `users/${userId}/memory/summaries`);
          const newSummaryRef = push(summaryRef);
          
          await set(newSummaryRef, {
            summary,
            keyPoints: keyPoints || [],
            importance,
            chatId: context.chatId || null,
            timestamp: serverTimestamp()
          });
          
          console.log('✅ Conversation summary saved:', newSummaryRef.key);
          enhancedMemoryStore.addToArchivalMemory(summary, 'conversation', { keyPoints, importance });
          
          return {
            success: true,
            message: `Created conversation summary`
          };
        } catch (error) {
          console.error('❌ Failed to save summary:', error);
          enhancedMemoryStore.addToArchivalMemory(summary, 'conversation', { keyPoints, importance });
          return { success: false, message: 'Saved locally only' };
        }
      }

      case 'updateProfileSummary': {
        const updates: any = {};
        if (args.personalDetails) updates.personalDetails = args.personalDetails;
        if (args.healthSummary) updates.healthSummary = args.healthSummary;
        if (args.preferences) updates.importantPreferences = args.preferences;
        if (args.communicationStyle) updates.communicationStyle = args.communicationStyle;

        const userId = auth.currentUser?.uid;
        if (!userId) {
          enhancedMemoryStore.updateCoreMemory({ profileSummary: updates });
          return { success: true, message: 'Saved locally only' };
        }

        try {
          const profileRef = ref(db, `users/${userId}/memory/profile`);
          await update(profileRef, updates);
          
          console.log('✅ Profile summary updated in Realtime Database');
          enhancedMemoryStore.updateCoreMemory({ profileSummary: updates });
          
          return {
            success: true,
            message: 'Profile summary updated',
          };
        } catch (error) {
          console.error('❌ Failed to update profile:', error);
          enhancedMemoryStore.updateCoreMemory({ profileSummary: updates });
          return { success: false, message: 'Saved locally only' };
        }
      }

      default:
        return {
          success: false,
          message: `Unknown function: ${functionName}`,
        };
    }
  } catch (error) {
    console.error('Memory extraction error:', error);
    return {
      success: false,
      message: `Error: ${error}`,
    };
  }
}
