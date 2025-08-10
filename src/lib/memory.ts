export type MemoryRole = 'user' | 'assistant';

export interface MemoryMessage {
  role: MemoryRole;
  content: string;
  timestamp: number;
}

class MemoryStore {
  private history: MemoryMessage[] = [];

  addUser(content: string) {
    this.history.push({ role: 'user', content, timestamp: Date.now() });
    this.trim();
  }

  addAssistant(content: string) {
    this.history.push({ role: 'assistant', content, timestamp: Date.now() });
    this.trim();
  }

  clear() {
    this.history = [];
  }

  // Keep last 10 exchanges (20 messages)
  private trim() {
    const max = 20;
    if (this.history.length > max) {
      this.history = this.history.slice(-max);
    }
  }

  getHistory(): MemoryMessage[] {
    return [...this.history];
  }

  getPlainHistory(maxItems = 8): string {
    const items = this.history.slice(-maxItems);
    return items
      .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n');
  }

  // Maps to Gemini content parts structure
  getHistoryParts(maxItems = 12): Array<{ role: 'user' | 'model'; parts: { text: string }[] }> {
    const items = this.history.slice(-maxItems);
    return items.map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    }));
  }
}

export const memoryStore = new MemoryStore();
