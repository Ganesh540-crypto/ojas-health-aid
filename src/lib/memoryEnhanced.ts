/**
 * MemGPT-inspired Hierarchical Memory System for Ojas
 * 
 * Based on "MemGPT: Towards LLMs as Operating Systems" (UC Berkeley, 2023)
 * Implements virtual context management with tiered memory architecture
 */

export type MemoryRole = 'user' | 'assistant';

export interface MemoryMessage {
  role: MemoryRole;
  content: string;
  timestamp: number;
  chatId?: string;
  messageId?: string;
}

export interface CoreMemoryBlock {
  userProfile: {
    name?: string;
    age?: number;
    healthConditions?: string[];
    medications?: string[];
    allergies?: string[];
    preferences?: Record<string, any>;
  };
  conversationContext: {
    currentTopic?: string;
    language?: string;
    lastInteractionDate?: number;
  };
  profileSummary: {
    // AI-generated summary of important user details
    personalDetails?: string; // "32-year-old software engineer, lives in Hyderabad"
    healthSummary?: string; // "Type 2 diabetes, taking metformin, monitoring blood sugar"
    importantPreferences?: string; // "Prefers vegetarian diet, exercises 3x/week"
    communicationStyle?: string; // "Prefers detailed explanations, asks follow-up questions"
    lastUpdated?: number;
  };
}

export interface RecallMemoryItem {
  summary: string;
  timestamp: number;
  importance: 'low' | 'medium' | 'high';
  chatId?: string;
  messageCount: number; // how many messages this summarizes
}

export interface ArchivalMemoryItem {
  content: string;
  timestamp: number;
  type: 'health_data' | 'conversation' | 'user_preference' | 'fact' | 'personal_info' | 'important_fact';
  metadata: Record<string, any>;
  embedding?: number[]; // for semantic search (future enhancement)
}

class EnhancedMemoryStore {
  // TIER 1: Main Context (Active - goes directly to LLM)
  private mainContext: MemoryMessage[] = [];
  
  // TIER 2: Core Memory (Essential user info - always loaded)
  private coreMemory: CoreMemoryBlock = {
    userProfile: {},
    conversationContext: {},
    profileSummary: {},
  };
  
  // TIER 3: Recall Memory (Working memory - recent summaries)
  private recallMemory: RecallMemoryItem[] = [];
  
  // TIER 4: Archival Memory (Long-term storage - retrieved on demand)
  private archivalMemory: ArchivalMemoryItem[] = [];

  // Configuration
  private readonly MAIN_CONTEXT_LIMIT = 15; // messages
  private readonly RECALL_MEMORY_LIMIT = 10; // summaries
  private readonly ARCHIVAL_MEMORY_LIMIT = 100; // items

  constructor() {
    this.coreMemory.profileSummary = {};
    this.loadFromLocalStorage();
  }

  // ============================================
  // TIER 1: MAIN CONTEXT MANAGEMENT
  // ============================================

  addToMainContext(role: MemoryRole, content: string, metadata?: { chatId?: string; messageId?: string }) {
    this.mainContext.push({
      role,
      content,
      timestamp: Date.now(),
      chatId: metadata?.chatId,
      messageId: metadata?.messageId,
    });

    // Auto-manage context window
    this.manageMainContext();
    this.persist();
  }

  private manageMainContext() {
    // If exceeding limit, compress oldest messages into recall memory
    if (this.mainContext.length > this.MAIN_CONTEXT_LIMIT) {
      const toCompress = this.mainContext.slice(0, this.mainContext.length - this.MAIN_CONTEXT_LIMIT);
      
      if (toCompress.length >= 4) {
        // Create summary of compressed messages
        const summary = this.createSummary(toCompress);
        this.addToRecallMemory(summary, toCompress.length);
        
        // Keep only recent messages in main context
        this.mainContext = this.mainContext.slice(-this.MAIN_CONTEXT_LIMIT);
      }
    }
  }

  getMainContext(): MemoryMessage[] {
    return [...this.mainContext];
  }

  clearMainContext() {
    // Archive before clearing
    if (this.mainContext.length > 0) {
      const summary = this.createSummary(this.mainContext);
      this.addToRecallMemory(summary, this.mainContext.length, 'medium');
    }
    this.mainContext = [];
    this.persist();
  }

  // ============================================
  // TIER 2: CORE MEMORY (User Profile)
  // ============================================

  updateCoreMemory(updates: Partial<CoreMemoryBlock>) {
    if (updates.userProfile) {
      this.coreMemory.userProfile = { ...this.coreMemory.userProfile, ...updates.userProfile };
    }
    if (updates.conversationContext) {
      this.coreMemory.conversationContext = { 
        ...this.coreMemory.conversationContext, 
        ...updates.conversationContext 
      };
    }
    if (updates.profileSummary) {
      this.coreMemory.profileSummary = {
        ...this.coreMemory.profileSummary,
        ...updates.profileSummary,
        lastUpdated: Date.now()
      };
    }
    this.persist();
  }

  getCoreMemory(): CoreMemoryBlock {
    return { ...this.coreMemory };
  }

  getCoreMemoryString(): string {
    const lines: string[] = [];
    
    // Include AI-generated profile summaries first (more concise)
    if (this.coreMemory.profileSummary) {
      const summary = this.coreMemory.profileSummary;
      if (summary.personalDetails) lines.push(`Personal: ${summary.personalDetails}`);
      if (summary.healthSummary) lines.push(`Health: ${summary.healthSummary}`);
      if (summary.importantPreferences) lines.push(`Preferences: ${summary.importantPreferences}`);
      if (summary.communicationStyle) lines.push(`Style: ${summary.communicationStyle}`);
    }
    
    // Fallback to structured data if no summaries
    if (lines.length === 0) {
      if (this.coreMemory.userProfile.name) {
        lines.push(`User: ${this.coreMemory.userProfile.name}`);
      }
      if (this.coreMemory.userProfile.healthConditions && this.coreMemory.userProfile.healthConditions.length > 0) {
        lines.push(`Health Conditions: ${this.coreMemory.userProfile.healthConditions.join(', ')}`);
      }
      if (this.coreMemory.userProfile.medications && this.coreMemory.userProfile.medications.length > 0) {
        lines.push(`Medications: ${this.coreMemory.userProfile.medications.join(', ')}`);
      }
      if (this.coreMemory.userProfile.allergies && this.coreMemory.userProfile.allergies.length > 0) {
        lines.push(`Allergies: ${this.coreMemory.userProfile.allergies.join(', ')}`);
      }
    }
    
    if (this.coreMemory.conversationContext.currentTopic) {
      lines.push(`Current Topic: ${this.coreMemory.conversationContext.currentTopic}`);
    }
    
    return lines.length > 0 ? `CORE MEMORY:\n${lines.join('\n')}` : '';
  }

  // ============================================
  // TIER 3: RECALL MEMORY (Working Memory)
  // ============================================

  addToRecallMemory(summary: string, messageCount: number, importance: 'low' | 'medium' | 'high' = 'low') {
    this.recallMemory.unshift({
      summary,
      timestamp: Date.now(),
      importance,
      messageCount,
    });

    // Keep only most recent/important summaries
    if (this.recallMemory.length > this.RECALL_MEMORY_LIMIT) {
      // Sort by importance and recency, keep top items
      this.recallMemory.sort((a, b) => {
        const importanceWeight = { high: 3, medium: 2, low: 1 };
        const scoreA = importanceWeight[a.importance] * 0.7 + (a.timestamp / 1000000000) * 0.3;
        const scoreB = importanceWeight[b.importance] * 0.7 + (b.timestamp / 1000000000) * 0.3;
        return scoreB - scoreA;
      });
      this.recallMemory = this.recallMemory.slice(0, this.RECALL_MEMORY_LIMIT);
    }
    
    this.persist();
  }

  getRecallMemory(): RecallMemoryItem[] {
    return [...this.recallMemory];
  }

  getRecallMemoryString(): string {
    if (this.recallMemory.length === 0) return '';
    
    const summaries = this.recallMemory
      .slice(0, 5) // top 5 most relevant
      .map((item, idx) => `${idx + 1}. ${item.summary}`)
      .join('\n');
    
    return `RECALL MEMORY (Recent conversation summaries):\n${summaries}`;
  }

  // ============================================
  // TIER 4: ARCHIVAL MEMORY (Long-term Storage)
  // ============================================

  addToArchivalMemory(
    content: string,
    type: ArchivalMemoryItem['type'],
    metadata: Record<string, any> = {}
  ) {
    this.archivalMemory.push({
      content,
      timestamp: Date.now(),
      type,
      metadata,
    });

    // Trim old items if exceeding limit
    if (this.archivalMemory.length > this.ARCHIVAL_MEMORY_LIMIT) {
      // Keep most recent and important items
      this.archivalMemory.sort((a, b) => b.timestamp - a.timestamp);
      this.archivalMemory = this.archivalMemory.slice(0, this.ARCHIVAL_MEMORY_LIMIT);
    }
    
    this.persist();
  }

  searchArchivalMemory(query: string, limit: number = 5): ArchivalMemoryItem[] {
    // Simple keyword-based search (can be enhanced with embeddings)
    const queryLower = query.toLowerCase();
    const matches = this.archivalMemory
      .filter(item => item.content.toLowerCase().includes(queryLower))
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
    
    return matches;
  }

  getArchivalMemoryByType(type: ArchivalMemoryItem['type'], limit: number = 10): ArchivalMemoryItem[] {
    return this.archivalMemory
      .filter(item => item.type === type)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  private createSummary(messages: MemoryMessage[]): string {
    // Simple summarization - in production, use LLM to generate better summaries
    if (messages.length === 0) return '';
    
    const userMessages = messages.filter(m => m.role === 'user').map(m => m.content);
    const topics = this.extractTopics(userMessages);
    
    return `Discussed ${topics.join(', ')} (${messages.length} messages)`;
  }

  private extractTopics(messages: string[]): string[] {
    // Simple topic extraction - can be enhanced
    const topics = new Set<string>();
    const commonWords = ['the', 'is', 'are', 'was', 'were', 'what', 'how', 'why', 'can', 'could'];
    
    messages.forEach(msg => {
      const words = msg.toLowerCase().split(/\s+/);
      words.forEach(word => {
        if (word.length > 4 && !commonWords.includes(word)) {
          topics.add(word);
        }
      });
    });
    
    return Array.from(topics).slice(0, 3);
  }

  // ============================================
  // CONTEXT BUILDING FOR LLM
  // ============================================

  /**
   * Build complete context package for LLM
   * Combines all memory tiers into a coherent context
   */
  buildContextForLLM(): string {
    const parts: string[] = [];
    
    // 1. Core Memory (always included)
    const coreMemoryStr = this.getCoreMemoryString();
    if (coreMemoryStr) parts.push(coreMemoryStr);
    
    // 2. Recall Memory (recent summaries)
    const recallMemoryStr = this.getRecallMemoryString();
    if (recallMemoryStr) parts.push(recallMemoryStr);
    
    // 3. Main Context (current conversation)
    if (this.mainContext.length > 0) {
      const contextStr = this.mainContext
        .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
        .join('\n');
      parts.push(`RECENT CONVERSATION:\n${contextStr}`);
    }
    
    return parts.join('\n\n');
  }

  /**
   * Get history in Gemini format
   */
  getHistoryParts(maxItems = 12): Array<{ role: 'user' | 'model'; parts: { text: string }[] }> {
    const items = this.mainContext.slice(-maxItems);
    return items.map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    }));
  }

  // ============================================
  // PERSISTENCE
  // ============================================

  private persist() {
    try {
      localStorage.setItem('ojas_main_context', JSON.stringify(this.mainContext));
      localStorage.setItem('ojas_core_memory', JSON.stringify(this.coreMemory));
      localStorage.setItem('ojas_recall_memory', JSON.stringify(this.recallMemory));
      localStorage.setItem('ojas_archival_memory', JSON.stringify(this.archivalMemory));
    } catch (err) {
      console.warn('Failed to persist memory:', err);
    }
  }

  private loadFromLocalStorage() {
    try {
      const mainContext = localStorage.getItem('ojas_main_context');
      const coreMemory = localStorage.getItem('ojas_core_memory');
      const recallMemory = localStorage.getItem('ojas_recall_memory');
      const archivalMemory = localStorage.getItem('ojas_archival_memory');
      
      if (mainContext) this.mainContext = JSON.parse(mainContext);
      if (coreMemory) this.coreMemory = JSON.parse(coreMemory);
      if (recallMemory) this.recallMemory = JSON.parse(recallMemory);
      if (archivalMemory) this.archivalMemory = JSON.parse(archivalMemory);
    } catch (err) {
      console.warn('Failed to load memory from storage:', err);
    }
  }

  // ============================================
  // ADMIN / DEBUG
  // ============================================

  getMemoryStats() {
    return {
      mainContextSize: this.mainContext.length,
      recallMemorySize: this.recallMemory.length,
      archivalMemorySize: this.archivalMemory.length,
      coreMemoryPopulated: Object.keys(this.coreMemory.userProfile).length > 0,
    };
  }

  clearAllMemory() {
    this.mainContext = [];
    this.coreMemory = { userProfile: {}, conversationContext: {}, profileSummary: {} };
    this.recallMemory = [];
    this.archivalMemory = [];
    this.persist();
  }
}

export const enhancedMemoryStore = new EnhancedMemoryStore();
