/**
 * Autonomous Topic Discovery
 * Gemini discovers trending topics across categories WITHOUT predefined lists
 */

import { GoogleGenAI } from "@google/genai";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || "";

export interface DiscoveredTopic {
  topic: string;        // e.g., "GPT-5 announcement", "India stock market crash"
  category: string;     // health | technology | science | entertainment | business | sports
  priority: number;     // 1-10 (10 = most urgent/trending)
  reasoning: string;    // Why this topic is trending
}

/**
 * Ask Gemini to discover trending topics across ALL categories
 * NO predefined topic lists - pure autonomous discovery
 */
export async function discoverTrendingTopics(
  region: string = "IN",
  maxTopics: number = 10
): Promise<DiscoveredTopic[]> {
  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  const currentDate = new Date().toISOString().split('T')[0];
  const currentTime = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  const prompt = `You are a news discovery AI. Your job is to identify the MOST TRENDING topics RIGHT NOW (${currentTime}) that people are searching for.

CURRENT DATE: ${currentDate}
REGION: ${region}

TASK: Discover ${maxTopics} trending topics across these categories:
- health (medical breakthroughs, disease outbreaks, health policies)
- technology (AI launches, tech company news, gadgets, software)
- science (research, space, climate, discoveries)
- entertainment (movies, music, celebrities, events)
- business (stocks, markets, economy, companies)
- sports (matches, tournaments, player news)
- politics (elections, policies, international relations)
- other (anything else trending)

CRITICAL RULES:
1. DO NOT use generic topics like "diabetes" or "mental health"
2. Find SPECIFIC, CURRENT events happening NOW or in the past week
3. Think like a news editor: What are people actively searching for TODAY?
4. Examples of GOOD topics:
   - "GPT-5 model launch by OpenAI"
   - "India vs Australia cricket final"
   - "Stock market crash October 2025"
   - "New malaria vaccine approval WHO"
   - "iPhone 17 launch event"
   
5. Examples of BAD topics (too generic):
   - "diabetes"
   - "mental health"
   - "technology news"
   - "sports updates"

6. Prioritize:
   - Breaking news (priority 9-10)
   - Major announcements (priority 7-8)
   - Ongoing important stories (priority 5-6)
   - General interest (priority 3-4)

OUTPUT: JSON only as:
{
  "topics": [
    {
      "topic": "specific event or announcement",
      "category": "health|technology|science|entertainment|business|sports|politics|other",
      "priority": 1-10,
      "reasoning": "brief explanation why this is trending"
    }
  ]
}

Think about:
- What major events happened in the last 7 days?
- What are people talking about on social media?
- What breaking news is happening?
- What product launches or announcements occurred?
- What sports events are happening?
- What political developments are current?

Generate ${maxTopics} diverse topics across different categories.`;

  try {
    const resp = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: { temperature: 0.7, maxOutputTokens: 2048 }
    });

    let text = (resp as any).text || (resp as any).candidates?.[0]?.content?.parts?.[0]?.text || "";
    text = text.replace(/^```json\s*|\s*```$/g, "").trim();

    const parsed = JSON.parse(text);
    const topics = Array.isArray(parsed?.topics) ? parsed.topics : [];

    return topics
      .filter((t: any) => t.topic && t.category && typeof t.priority === 'number')
      .map((t: any) => ({
        topic: String(t.topic).trim(),
        category: String(t.category).toLowerCase(),
        priority: Math.max(1, Math.min(10, parseInt(t.priority, 10))),
        reasoning: String(t.reasoning || "").trim()
      }))
      .sort((a: DiscoveredTopic, b: DiscoveredTopic) => b.priority - a.priority)
      .slice(0, maxTopics);
  } catch (e) {
    console.error("[discoverTrendingTopics] Error:", e);
    // Fallback: return empty array, let caller handle
    return [];
  }
}

/**
 * Discover topics for a specific category only
 */
export async function discoverTopicsForCategory(
  category: string,
  region: string = "IN",
  maxTopics: number = 5
): Promise<DiscoveredTopic[]> {
  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  const currentDate = new Date().toISOString().split('T')[0];
  const currentTime = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  const prompt = `You are a ${category} news discovery AI.

CURRENT DATE: ${currentDate} (${currentTime})
REGION: ${region}
CATEGORY: ${category}

TASK: Discover ${maxTopics} SPECIFIC, TRENDING ${category} topics happening RIGHT NOW.

CRITICAL RULES:
1. NO generic topics - find SPECIFIC events, announcements, or developments
2. Focus on the past 7 days or current/upcoming events
3. Think: What are people actively searching for in ${category} TODAY?

GOOD examples for ${category}:
${category === 'health' ? `
- "New Alzheimer's drug approval FDA October 2025"
- "Dengue outbreak Mumbai 2025"
- "ICMR diabetes screening program launch"
- "WHO declares mpox emergency"
` : category === 'technology' ? `
- "GPT-5 launch OpenAI"
- "iPhone 17 Pro Max announcement"
- "Google Gemini 3.0 release"
- "Tesla Cybertruck India launch"
` : category === 'business' ? `
- "Nifty 50 crosses 25000 milestone"
- "Reliance AGM 2025 announcements"
- "US Fed rate cut October 2025"
- "Adani stock crash investigation"
` : `
- Specific current events in ${category}
- Recent announcements or launches
- Breaking news or developments
- Major ongoing stories
`}

BAD examples (too generic):
- "${category}"
- "${category} news"
- "${category} updates"

OUTPUT JSON only:
{
  "topics": [
    {
      "topic": "specific event",
      "category": "${category}",
      "priority": 1-10,
      "reasoning": "why trending"
    }
  ]
}`;

  try {
    const resp = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: { temperature: 0.7, maxOutputTokens: 1536 }
    });

    let text = (resp as any).text || (resp as any).candidates?.[0]?.content?.parts?.[0]?.text || "";
    text = text.replace(/^```json\s*|\s*```$/g, "").trim();

    const parsed = JSON.parse(text);
    const topics = Array.isArray(parsed?.topics) ? parsed.topics : [];

    return topics
      .filter((t: any) => t.topic && typeof t.priority === 'number')
      .map((t: any) => ({
        topic: String(t.topic).trim(),
        category: category,
        priority: Math.max(1, Math.min(10, parseInt(t.priority, 10))),
        reasoning: String(t.reasoning || "").trim()
      }))
      .sort((a: DiscoveredTopic, b: DiscoveredTopic) => b.priority - a.priority)
      .slice(0, maxTopics);
  } catch (e) {
    console.error(`[discoverTopicsForCategory:${category}] Error:`, e);
    return [];
  }
}
