export interface Source {
  title: string;
  url: string;
  snippet?: string;
  displayUrl?: string;
}

export type ThinkingMode = 'routing' | 'thinking' | 'searching' | 'analyzing';

export interface MetaItem {
  type: 'step' | 'thought' | 'search_query';
  text?: string;
  query?: string;
  ts?: number;
}

export interface ChatMessageAttachment extends File {
  firebaseUrl?: string;
  fileSize?: number;
}

export interface ChatMessageRecord {
  id: string;
  content: string;
  isBot: boolean;
  timestamp: Date;
  healthRelated?: boolean;
  sources?: Source[];
  attachments?: ChatMessageAttachment[];
}
