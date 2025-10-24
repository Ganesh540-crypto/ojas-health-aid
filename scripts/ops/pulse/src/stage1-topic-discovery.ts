/**
 * STAGE 1: Topic Discovery with Gemini + Grounded Web Search
 * 
 * Process:
 * 1. Ask Gemini to search for today's latest news across categories
 * 2. Gemini uses Google Search grounding to find trending topics
 * 3. Returns categorized queries based on actual trending news
 */

import { GoogleGenAI } from "@google/genai";
import { TrendingQuery } from "./types";

// Hardcoded fallback for API key (in case env vars fail)
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 
                       process.env.VITE_GEMINI_API_KEY || 
                       "AIzaSyCgpMLX4VzKFGpzb12_kvo7cSSiETsMh-4";

const DISCOVERY_PROMPT = `You are a news discovery AI that finds TODAY'S latest trending news across multiple categories.

**Your Task:**
Search the web for TODAY'S most important and trending news in these categories:
1. Health (medical breakthroughs, disease outbreaks, health policies, treatments)
2. Technology (AI, software, hardware, cybersecurity, startups)
3. Science (research, discoveries, space, environment, climate)
4. Entertainment (movies, music, celebrities, streaming, events)
5. Business (markets, economy, companies, regulations, crypto)
6. Sports (tournaments, scores, player news, records, Olympics)

**Requirements:**
- Use web search extensively to find ACTUAL trending topics from TODAY
- Find 15-20 trending topics across all categories
- For each topic, create a specific, searchable query
- Categorize each query appropriately
- Assign priority: high (breaking/critical), medium (important), low (interesting)
- Explain WHY each topic is trending

**Output Format (JSON):**
\`\`\`json
{
  "queries": [
    {
      "query": "Specific searchable query about the trending topic",
      "category": "health|technology|science|entertainment|business|sports",
      "priority": "high|medium|low",
      "reasoning": "Why this is trending today (1 sentence)"
    }
  ]
}
\`\`\`

**Important:**
- Focus on NEWS from the last 24 hours
- Create queries that will find relevant sources
- Be specific (not "health news" but "new diabetes drug FDA approval")
- Mix categories evenly`;

export async function discoverTrendingTopicsForCategory(
  category: string,
  count: number = 25
): Promise<TrendingQuery[]> {
  console.log(`[Stage 1] Discovering ${count} ${category} topics...`);
  
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is required');
  }
  
  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  const currentDate = new Date().toISOString().split('T')[0];
  
  const categoryPrompt = DISCOVERY_PROMPT.replace(
    'across all categories',
    `in the ${category} category only`
  );
  
  try {
    const config = {
      temperature: 0.7,
      maxOutputTokens: 4096,
      tools: [{ googleSearch: {} }]
    };
    
    const userPrompt = `Today is ${currentDate}. Find the ${count} most trending ${category} news topics.`;
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: categoryPrompt + '\n\n' + userPrompt,
      config
    });
    
    let text = response.text || response.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (!text) throw new Error('Empty response');
    
    // Clean JSON - remove markdown, extract JSON object
    text = text.trim();
    text = text.replace(/^```json\s*/gm, '').replace(/\s*```$/gm, '');
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) text = jsonMatch[0];
    
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e: any) {
      console.error(`[Stage 1] JSON parse error for ${category}:`, e.message);
      console.error(`[Stage 1] Response preview:`, text.substring(0, 200));
      throw new Error(`Failed to parse JSON: ${e.message}`);
    }
    
    if (!parsed.queries || !Array.isArray(parsed.queries)) {
      throw new Error('Invalid response format');
    }
    
    const queries: TrendingQuery[] = parsed.queries.map((q: any) => ({
      query: q.query,
      category: category,
      priority: q.priority,
      reasoning: q.reasoning,
      timestamp: new Date().toISOString()
    })).slice(0, count);  // Limit to exact count
    
    console.log(`[Stage 1] ✓ ${category}: ${queries.length} topics`);
    return queries;
    
  } catch (error) {
    console.error(`[Stage 1] Error discovering ${category} topics:`, error);
    return [];  // Return empty on error
  }
}

export async function discoverTrendingTopics(perCategory: number = 25): Promise<TrendingQuery[]> {
  console.log(`[Stage 1] Discovering ${perCategory} topics per category (PARALLEL)...`);
  
  const categories = ['health', 'technology', 'science', 'entertainment', 'business', 'sports'];
  
  // Process all categories in PARALLEL
  const results = await Promise.allSettled(
    categories.map(category => discoverTrendingTopicsForCategory(category, perCategory))
  );
  
  const allQueries: TrendingQuery[] = [];
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      allQueries.push(...result.value);
      console.log(`[Stage 1] ${categories[index]}: ${result.value.length} topics`);
    } else {
      console.error(`[Stage 1] ${categories[index]} failed:`, result.reason);
    }
  });
  
  console.log(`[Stage 1] ✓ Total: ${allQueries.length} topics discovered`);
  return allQueries;
}
