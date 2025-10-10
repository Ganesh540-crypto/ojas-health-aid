/**
 * Article Synthesis System for Ojas Pulse
 * Uses Gemini with Google Search grounding to create comprehensive multi-source articles
 */

import { GoogleGenAI } from '@google/genai';

export interface SourceInfo {
  name: string;
  url: string;
  domain: string;
}

export interface SynthesizedArticle {
  title: string;
  summary: string;
  keyInsights: string[];
  category: string;
  tags: string[];
  urgency: 'low' | 'medium' | 'high' | 'critical';
  locationRelevance: string;
  sources: SourceInfo[];
  query: string;
  generatedAt: string;
}

const SYNTHESIS_PROMPT = `You are an expert health journalist writing for Ojas Pulse, a trusted health news platform.

Your task is to research and write a comprehensive, well-structured health news article.

Requirements:

1. **Deep Research**: Use web search extensively to find 5-15 authoritative sources
   - Prioritize medical journals, health organizations, government health sites
   - Include recent studies, expert opinions, and current statistics
   - Verify information across multiple sources

2. **Article Structure**:
   - Create an engaging, informative headline (10-15 words)
   - Write 3-4 well-structured paragraphs (250-350 words total)
   - Start with context and why this matters
   - Present key findings and evidence
   - Discuss implications and expert perspectives
   - Conclude with future outlook or practical takeaways

3. **Writing Style**:
   - Professional but accessible to general audience
   - Avoid medical jargon, explain technical terms
   - Use clear, direct language
   - Include specific data, statistics, names when available
   - Natural flow between paragraphs

4. **Key Insights**: Extract 5-7 most important takeaways
   - Specific, actionable information
   - Each insight should be concise (1-2 sentences)
   - Mix facts, implications, and recommendations

5. **Categorization**:
   - Assign ONE primary category from: mental-health, fitness, nutrition, chronic-disease, medication, environmental-health, pandemic, preventive-care, women-health, child-health, aging, sleep, stress
   - Add 3-5 relevant tags from the same list
   - Assess urgency: low (general info), medium (important to know), high (urgent health issue), critical (immediate public health concern)
   - Determine location relevance: "global" or "country:XX" (e.g., "country:IN") or "city:Name"

6. **Source Attribution**:
   - List all sources you consulted
   - Include source name and URL
   - Ensure sources are reputable and recent

OUTPUT FORMAT (strict JSON, no markdown):
{
  "title": "Engaging headline here",
  "summary": "Multi-paragraph comprehensive summary (250-350 words)...",
  "keyInsights": [
    "First key insight with specific details",
    "Second key insight...",
    ...5-7 insights total
  ],
  "category": "primary-category",
  "tags": ["tag1", "tag2", "tag3"],
  "urgency": "medium",
  "locationRelevance": "global",
  "sources": [
    {"name": "Source Name", "url": "https://...", "domain": "example.com"},
    ...3-15 sources
  ]
}`;

/**
 * Synthesize article from query using Gemini with Google Search
 */
export async function synthesizeArticle(
  query: string,
  apiKey: string,
  category?: string
): Promise<SynthesizedArticle | null> {
  
  try {
    const ai = new GoogleGenAI({ apiKey });
    
    const userPrompt = `Research and write a comprehensive health news article about: "${query}"
    
${category ? `Expected category: ${category}` : ''}

Use web search to gather information from multiple authoritative sources and synthesize them into a well-structured article following all the guidelines above.`;

    console.log(`[synthesis] Researching: ${query}`);
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: SYNTHESIS_PROMPT + '\n\n' + userPrompt,
      config: {
        temperature: 0.4,
        maxOutputTokens: 2048,
        tools: [{
          googleSearch: {}  // Enable Google Search grounding
        }]
      }
    });
    
    // Extract text from response (try multiple paths for SDK compatibility)
    let text = response.text || 
               response.candidates?.[0]?.content?.parts?.[0]?.text || 
               '';
    
    if (!text) {
      console.warn(`[synthesis] Empty response for query: ${query}`);
      return null;
    }
    
    // Strip markdown code fences if present
    text = text.replace(/^```json\s*|\s*```$/g, '').trim();
    
    // Clean up any control characters that might break JSON parsing
    text = text.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
    
    const parsed = JSON.parse(text);
    
    // Validate required fields
    if (!parsed.title || !parsed.summary || !parsed.keyInsights || !parsed.sources) {
      console.warn(`[synthesis] Missing required fields in response for: ${query}`);
      return null;
    }
    
    // Validate summary length (should be comprehensive)
    const wordCount = parsed.summary.split(/\s+/).length;
    if (wordCount < 150) {
      console.warn(`[synthesis] Summary too short (${wordCount} words) for: ${query}`);
      // Don't reject, but log for monitoring
    }
    
    // Validate sources
    if (!Array.isArray(parsed.sources) || parsed.sources.length < 3) {
      console.warn(`[synthesis] Insufficient sources (${parsed.sources?.length || 0}) for: ${query}`);
    }
    
    // Ensure sources have proper structure
    const sources: SourceInfo[] = parsed.sources.map((src: any) => ({
      name: src.name || 'Unknown Source',
      url: src.url || '',
      domain: src.domain || extractDomain(src.url || ''),
    }));
    
    const article: SynthesizedArticle = {
      title: parsed.title,
      summary: parsed.summary,
      keyInsights: Array.isArray(parsed.keyInsights) ? parsed.keyInsights.slice(0, 7) : [],
      category: parsed.category || category || 'preventive-care',
      tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 5) : [],
      urgency: parsed.urgency || 'medium',
      locationRelevance: parsed.locationRelevance || 'global',
      sources,
      query,
      generatedAt: new Date().toISOString(),
    };
    
    console.log(`[synthesis] ✓ Generated article: "${article.title}" (${wordCount} words, ${sources.length} sources)`);
    
    return article;
    
  } catch (error: any) {
    console.error(`[synthesis] Error for query "${query}":`, error.message);
    
    // Return null instead of fallback - we want quality articles only
    return null;
  }
}

/**
 * Batch synthesize multiple queries
 */
export async function synthesizeArticleBatch(
  queries: string[],
  apiKey: string,
  concurrency: number = 5
): Promise<SynthesizedArticle[]> {
  
  const articles: SynthesizedArticle[] = [];
  
  // Process in batches to avoid rate limits
  for (let i = 0; i < queries.length; i += concurrency) {
    const batch = queries.slice(i, i + concurrency);
    
    console.log(`[synthesis] Processing batch ${Math.floor(i / concurrency) + 1}/${Math.ceil(queries.length / concurrency)}`);
    
    const results = await Promise.allSettled(
      batch.map(query => synthesizeArticle(query, apiKey))
    );
    
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        articles.push(result.value);
      }
    }
    
    // Rate limiting: wait between batches
    if (i + concurrency < queries.length) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  return articles;
}

/**
 * Extract domain from URL
 */
function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return '';
  }
}
