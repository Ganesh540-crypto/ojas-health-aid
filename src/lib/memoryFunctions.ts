/**
 * MemGPT-Style Memory Management
 * 
 * Core Memory: Small, always-in-context facts (like RAM)
 * Archival Memory: Long-term storage for detailed info (like disk)
 * Conversation Summaries: Periodic summaries for context
 */

import { enhancedMemoryStore, type CoreMemoryBlock } from './memoryEnhanced';
import { ref, update, push, set, serverTimestamp, get } from 'firebase/database';
import { db, auth } from './firebase';

/**
 * Function declarations that can be passed to Gemini
 * These allow the AI to call memory management functions
 */
export const memoryManagementFunctions = {
  updateUserProfile: {
    name: 'updateUserProfile',
    description: 'Update user profile information in core memory. Use this when learning new information about the user (name, age, health conditions, medications, allergies, preferences).',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'User name' },
        age: { type: 'number', description: 'User age' },
        healthConditions: { 
          type: 'array', 
          items: { type: 'string' },
          description: 'List of health conditions (e.g., diabetes, hypertension)'
        },
        medications: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of medications user is taking'
        },
        allergies: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of allergies'
        },
        preferences: {
          type: 'object',
          description: 'User preferences (diet, exercise, communication style, etc.)'
        }
      }
    }
  },

  archiveImportantFact: {
    name: 'archiveImportantFact',
    description: 'Store an important fact or information in long-term archival memory for future retrieval. Use for health data, user goals, important conversations, or factual information that should be remembered long-term.',
    parameters: {
      type: 'object',
      properties: {
        content: { 
          type: 'string', 
          description: 'The fact or information to archive' 
        },
        type: { 
          type: 'string',
          enum: ['health_data', 'user_preference', 'fact', 'conversation'],
          description: 'Type of information being archived'
        },
        importance: {
          type: 'string',
          enum: ['low', 'medium', 'high'],
          description: 'Importance level of this information'
        }
      },
      required: ['content', 'type']
    }
  },

  searchMemory: {
    name: 'searchMemory',
    description: 'Search through long-term archival memory for relevant information. Use when you need to recall past conversations, user preferences, or historical context.',
    parameters: {
      type: 'object',
      properties: {
        query: { 
          type: 'string', 
          description: 'Search query to find relevant memories' 
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return (default: 5)',
          default: 5
        }
      },
      required: ['query']
    }
  },

  updateConversationContext: {
    name: 'updateConversationContext',
    description: 'Update the current conversation context (current topic, user mood, etc.). Use to maintain conversation flow and context.',
    parameters: {
      type: 'object',
      properties: {
        currentTopic: { 
          type: 'string', 
          description: 'Current conversation topic' 
        },
        userMood: {
          type: 'string',
          description: 'Detected user mood or emotional state'
        }
      }
    }
  },

  getHealthHistory: {
    name: 'getHealthHistory',
    description: 'Retrieve user health history from archival memory. Use when discussing health topics to provide personalized context.',
    parameters: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of health records to retrieve (default: 10)',
          default: 10
        }
      }
    }
  },

  updateProfileSummary: {
    name: 'updateProfileSummary',
    description: 'Update AI-generated profile summary section. Use this to maintain a concise, natural language summary of important user information. This helps remember key details across conversations.',
    parameters: {
      type: 'object',
      properties: {
        personalDetails: {
          type: 'string',
          description: 'Summary of personal info (e.g., "32-year-old software engineer from Hyderabad")'
        },
        healthSummary: {
          type: 'string',
          description: 'Summary of health status (e.g., "Type 2 diabetes, takes metformin, monitors blood sugar daily")'
        },
        importantPreferences: {
          type: 'string',
          description: 'Key preferences (e.g., "Vegetarian diet, exercises 3x/week, prefers natural remedies")'
        },
        communicationStyle: {
          type: 'string',
          description: 'How user communicates (e.g., "Asks detailed questions, prefers scientific explanations")'
        }
      }
    }
  },

  searchSemanticMemory: {
    name: 'searchSemanticMemory',
    description: 'Search through long-term memories using semantic understanding (meaning-based, not just keywords). Use when user asks "Do you remember...", "What did I tell you about...", or references past conversations. Works across all chats.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Natural language search query (e.g., "blood sugar readings", "what medication I take")'
        },
        type: {
          type: 'string',
          enum: ['health_data', 'user_preference', 'fact', 'conversation'],
          description: 'Filter by memory type (optional)'
        },
        limit: {
          type: 'number',
          description: 'Maximum results to return (default: 5)',
          default: 5
        }
      },
      required: ['query']
    }
  },

  storeImportantMemory: {
    name: 'storeImportantMemory',
    description: 'Store an important fact or conversation in long-term memory with semantic search capability. Use for health data, personal info, important conversations that user may want to recall later.',
    parameters: {
      type: 'object',
      properties: {
        content: {
          type: 'string',
          description: 'The information to remember (e.g., "Blood sugar was 150 mg/dL on morning of Oct 17")'
        },
        type: {
          type: 'string',
          enum: ['health_data', 'user_preference', 'fact', 'conversation'],
          description: 'Type of memory'
        },
        importance: {
          type: 'string',
          enum: ['low', 'medium', 'high'],
          description: 'How important is this information',
          default: 'medium'
        }
      },
      required: ['content', 'type']
    }
  }
};

/**
 * Execute memory management functions
 * Called when AI uses a memory function
 */
export async function executeMemoryFunction(
  functionName: string,
  args: Record<string, any>
): Promise<{ success: boolean; message: string; data?: any }> {
  try {
    switch (functionName) {
      case 'updateUserProfile': {
        const updates: Partial<CoreMemoryBlock['userProfile']> = {};
        if (args.name) updates.name = args.name;
        if (args.age) updates.age = args.age;
        if (args.healthConditions) updates.healthConditions = args.healthConditions;
        if (args.medications) updates.medications = args.medications;
        if (args.allergies) updates.allergies = args.allergies;
        if (args.preferences) updates.preferences = args.preferences;

        enhancedMemoryStore.updateCoreMemory({ userProfile: updates });
        return {
          success: true,
          message: 'User profile updated successfully',
          data: updates
        };
      }

      case 'archiveImportantFact': {
        const { content, type, importance = 'medium' } = args;
        // Store locally
        enhancedMemoryStore.addToArchivalMemory(content, type, { importance });
        // Also persist to Realtime Database when logged in (so it shows in Settings > Memory)
        try {
          const uid = auth.currentUser?.uid;
          if (uid) {
            const archivalRef = ref(db, `users/${uid}/memory/archival`);
            const newRef = push(archivalRef);
            await set(newRef, {
              content,
              type,
              importance,
              timestamp: serverTimestamp()
            });
          }
        } catch (err) {
          console.warn('Realtime DB archival save failed (continuing with local only):', err);
        }
        return {
          success: true,
          message: `Archived ${type} with ${importance} importance`,
          data: { content, type, importance }
        };
      }

      case 'searchMemory': {
        const { query, limit = 5 } = args;
        const results = enhancedMemoryStore.searchArchivalMemory(query, limit);
        return {
          success: true,
          message: `Found ${results.length} matching memories`,
          data: results.map(r => ({ content: r.content, type: r.type, timestamp: r.timestamp }))
        };
      }

      case 'updateConversationContext': {
        const updates: Partial<CoreMemoryBlock['conversationContext']> = {};
        if (args.currentTopic) updates.currentTopic = args.currentTopic;
        // Store userMood in metadata for future enhancement
        const metadata = args.userMood ? { userMood: args.userMood } : {};

        enhancedMemoryStore.updateCoreMemory({ conversationContext: updates });
        return {
          success: true,
          message: 'Conversation context updated',
          data: { ...updates, ...metadata }
        };
      }

      case 'getHealthHistory': {
        const { limit = 10 } = args;
        const healthData = enhancedMemoryStore.getArchivalMemoryByType('health_data', limit);
        return {
          success: true,
          message: `Retrieved ${healthData.length} health records`,
          data: healthData.map(h => ({ content: h.content, timestamp: h.timestamp }))
        };
      }

      case 'updateProfileSummary': {
        const updates: Partial<CoreMemoryBlock['profileSummary']> = {};
        if (args.personalDetails) updates.personalDetails = args.personalDetails;
        if (args.healthSummary) updates.healthSummary = args.healthSummary;
        if (args.importantPreferences) updates.importantPreferences = args.importantPreferences;
        if (args.communicationStyle) updates.communicationStyle = args.communicationStyle;

        enhancedMemoryStore.updateCoreMemory({ profileSummary: updates });
        // Also persist to Realtime Database so Settings > Memory shows profile memory
        try {
          const uid = auth.currentUser?.uid;
          if (uid) {
            const profileRef = ref(db, `users/${uid}/memory/profile`);
            await update(profileRef, updates as any);
          }
        } catch (err) {
          console.warn('Realtime DB profile memory update failed (continuing with local only):', err);
        }
        return {
          success: true,
          message: 'Profile summary updated successfully',
          data: updates
        };
      }

      case 'searchSemanticMemory': {
        const { query, limit = 5 } = args;
        console.log('🔍 [Memory] searchSemanticMemory query:', query);
        const uid = auth.currentUser?.uid;
        if (!uid) {
          console.log('⚠️ [Memory] No user logged in, using local search');
          const localResults = enhancedMemoryStore.searchArchivalMemory(query, limit);
          return {
            success: true,
            message: `Found ${localResults.length} memories (local keyword search)`,
            data: localResults.map(r => ({ content: r.content, type: r.type, timestamp: r.timestamp }))
          };
        }

        try {
          const snap = await get(ref(db, `users/${uid}/memory/archival`));
          const items: Array<{ content: string; type: string; timestamp?: any }> = [];
          if (snap.exists()) {
            const queryLower = String(query).toLowerCase();
            
            // Expand query with synonyms for better matching
            const expandedTerms = new Set<string>();
            const words = queryLower.split(/\s+/).filter(t => t.length > 2);
            words.forEach(w => {
              expandedTerms.add(w);
              // Add common synonyms/related terms
              if (w.includes('food') || w.includes('eat')) { expandedTerms.add('dislike'); expandedTerms.add('like'); expandedTerms.add('preference'); }
              if (w.includes('dislike') || w.includes('hate') || w.includes('dont')) { expandedTerms.add('dislike'); expandedTerms.add('preference'); }
              if (w.includes('like') || w.includes('love') || w.includes('prefer')) { expandedTerms.add('like'); expandedTerms.add('preference'); }
            });
            
            const queryTerms = Array.from(expandedTerms);
            console.log('🔍 [Memory] Expanded query terms:', queryTerms);
            
            // If the query is asking about preferences/dislikes/likes, prioritize matching by type
            const isPreferenceQuery = queryLower.match(/\b(food|dislike|like|prefer|hate|love|favorite)\b/);
            
            snap.forEach(child => {
              const v = child.val();
              if (!v || typeof v !== 'object') return;
              const text = (String(v.content || '') + ' ' + String(v.summary || '') + ' ' + String(v.type || '')).toLowerCase();
              
              // For preference queries, match user_preference types even if no keywords match
              if (isPreferenceQuery && v.type === 'user_preference') {
                items.push({ content: String(v.content || v.summary || ''), type: String(v.type || 'fact'), timestamp: v.timestamp });
                console.log('✓ [Memory] Preference type match:', { content: String(v.summary || v.content || '').slice(0, 100), type: v.type });
                return;
              }
              
              // Otherwise match if ANY query term appears in the text
              const matches = queryTerms.some(term => text.includes(term));
              if (matches) {
                items.push({ content: String(v.content || v.summary || ''), type: String(v.type || 'fact'), timestamp: v.timestamp });
                console.log('✓ [Memory] Keyword match:', { content: String(v.summary || v.content || '').slice(0, 100), type: v.type });
              }
            });
          }
          console.log('🔍 [Memory] Total matches:', items.length);
          items.sort((a, b) => (Number(b.timestamp || 0) - Number(a.timestamp || 0)));
          const top = items.slice(0, Math.max(1, Math.min(50, limit)));
          return {
            success: true,
            message: `Found ${top.length} memories (RTDB search)`,
            data: top
          };
        } catch (err) {
          console.error('❌ [Memory] RTDB search failed:', err);
          const localResults = enhancedMemoryStore.searchArchivalMemory(query, limit);
          return {
            success: true,
            message: `Found ${localResults.length} memories (local fallback)`,
            data: localResults.map(r => ({ content: r.content, type: r.type, timestamp: r.timestamp }))
          };
        }
      }

      case 'storeImportantMemory': {
        const { content, type, importance = 'medium' } = args;

        // Store locally first for immediate recall
        enhancedMemoryStore.addToArchivalMemory(content, type, { importance });

        // Also persist to Realtime Database when logged in
        try {
          const uid = auth.currentUser?.uid;
          if (uid) {
            const archivalRef = ref(db, `users/${uid}/memory/archival`);
            const newRef = push(archivalRef);
            await set(newRef, {
              content,
              type,
              importance,
              timestamp: serverTimestamp()
            });
          }
        } catch (err) {
          console.warn('Realtime DB archival save failed (continuing with local only):', err);
        }

        return {
          success: true,
          message: `Stored ${type} memory with ${importance} importance`,
          data: { content, type, importance }
        };
      }

      default:
        return {
          success: false,
          message: `Unknown function: ${functionName}`
        };
    }
  } catch (error) {
    console.error('Memory function execution error:', error);
    return {
      success: false,
      message: `Error executing ${functionName}: ${error}`
    };
  }
}

/**
 * Helper to format function results for inclusion in LLM response
 */
export function formatFunctionResult(result: { success: boolean; message: string; data?: any }): string {
  if (!result.success) {
    return `[Memory Error: ${result.message}]`;
  }

  if (result.data) {
    return `[Memory Updated: ${result.message}]`;
  }

  return `[${result.message}]`;
}
