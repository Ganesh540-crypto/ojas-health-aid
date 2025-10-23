/**
 * Shared Types for Ojas Pulse 3-Stage Pipeline
 */

export interface TrendingQuery {
  query: string;
  category: 'health' | 'technology' | 'science' | 'entertainment' | 'business' | 'sports';
  priority: 'high' | 'medium' | 'low';
  reasoning: string;
  timestamp: string;
}

export interface SourceInfo {
  title: string;
  url: string;
  snippet: string;
  domain: string;
}

export interface QueryWithSources {
  query: string;
  category: string;
  priority: string;
  sources: SourceInfo[];
  collectedAt: string;
}

export interface ArticleSentence {
  text: string;           // Clean sentence (no citations)
  sourceRefs: number[];   // Which source numbers support this [1, 2, 5]
}

export interface ArticleSection {
  heading: string;
  sentences: ArticleSentence[];  // Array of sentences with their sources
}

export interface PulseArticle {
  title: string;
  introduction?: string;    // Introduction paragraph (for preview)
  summary: string;          // Plain text (no markdown ##)
  sections: ArticleSection[];  // Structured sections with subheadings
  category: string;
  tags: string[];
  urgency: 'low' | 'medium' | 'high' | 'critical';
  locationRelevance: string[];
  sources: string[];        // Array of domains
  urls: string[];           // Array of URLs
  imageUrl: string | null;  // Featured image from sources
  query: string;
  publishedAt: string;
  generatedAt: string;
}
