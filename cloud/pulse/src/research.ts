import { GoogleGenAI, Type } from "@google/genai";
import axios from "axios";
import crypto from "crypto";

export interface RawSourceItem {
  title: string;
  url: string;
  snippet?: string;
  domain: string;
  publishedAt?: string | null;
}

export interface ClusterItem extends RawSourceItem {}

export interface SourceCluster {
  id: string;           // stable cluster id (sha1)
  claim: string;        // concise claim/topic this cluster supports
  category: string;     // health | technology | science | entertainment | other
  region: string;       // e.g., IN, US, GLOBAL
  items: ClusterItem[]; // supporting sources
  createdAt: string;
  expireAt: string;     // TTL (createdAt + 3 days)
  queries: string[];    // queries used to find these sources
}

const sha1 = (s: string) => crypto.createHash("sha1").update(s).digest("hex");
const domainFromUrl = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; } };

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || "";
const GOOGLE_SEARCH_API_KEY = process.env.GOOGLE_SEARCH_API_KEY || process.env.VITE_GOOGLE_SEARCH_API_KEY || "";
const GOOGLE_SEARCH_ENGINE_ID = process.env.GOOGLE_SEARCH_ENGINE_ID || process.env.VITE_GOOGLE_SEARCH_ENGINE_ID || "";

// 1) Ask Gemini to propose 3-5 sub-queries for a topic and region focus (no summarization)
export async function proposeSubqueries(topic: string, region: string = "IN", category: string = "health"): Promise<string[]> {
  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  const year = new Date().getFullYear();
  const prompt = `You are a research planner. Generate 3-5 HUMAN-STYLE, trending discovery queries for: "${topic}".

GOAL: Mimic how people search to find the latest updates and official announcements.

STRICT RULES:
- Use natural phrases like: latest, updates, policy changes, government guidelines, reports, advisories, top stories, today/this week
- Prefer broad, aggregator-style queries that surface many credible sources (not hyper-specific entities)
- Include the current year (${year}) and the region (${region}) where relevant
- Keep queries concise and readable

OUTPUT JSON ONLY as { "queries": ["q1", "q2", ...] } with 3-5 items.

EXAMPLES (illustrative pattern, DO NOT copy words):
- "latest ${category} updates ${region} ${year}"
- "${category} policy changes ${region} ${year}"
- "top ${category} news today ${region}"
- "government ${category} guidelines ${region} ${year}"
- "${category} research reports ${year}"`;

  const resp = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `${prompt}\n\nTOPIC: ${topic}`,
    config: { temperature: 0.5, maxOutputTokens: 512 }
  });

  let text = (resp as any).text || (resp as any).candidates?.[0]?.content?.parts?.[0]?.text || "";
  text = text.replace(/^```json\s*|\s*```$/g, "").trim();
  try {
    const parsed = JSON.parse(text);
    const arr = Array.isArray(parsed?.queries) ? parsed.queries : [];
    return arr.slice(0, 5).filter((q: string) => typeof q === "string" && q.length > 0);
  } catch {
    // Human-style fallback
    const year = new Date().getFullYear();
    return [
      `latest ${topic} updates ${region} ${year}`,
      `${topic} policy changes ${region} ${year}`,
      `top ${topic} news today ${region}`,
      `government ${topic} guidelines ${region} ${year}`,
      `${topic} research reports ${year}`
    ].slice(0, 5);
  }
}

// Use Google Custom Search API via direct HTTP calls (like the Python reference)
async function searchWithGoogleCSE(query: string, maxResults: number, region: string, language: string): Promise<RawSourceItem[]> {
  if (!GOOGLE_SEARCH_API_KEY || !GOOGLE_SEARCH_ENGINE_ID) {
    console.warn('[searchWithGoogleCSE] Missing API key or Engine ID');
    return [];
  }
  
  const url = 'https://www.googleapis.com/customsearch/v1';
  const params = {
    key: GOOGLE_SEARCH_API_KEY,
    cx: GOOGLE_SEARCH_ENGINE_ID,
    q: query,
    num: Math.min(maxResults, 10), // Google API max is 10
    gl: region.toLowerCase(), // geolocation (e.g., "in" for India)
    lr: `lang_${language}`, // language restriction
    safe: 'active',
  };

  try {
    console.log(`[searchWithGoogleCSE] Searching for: "${query}" (region: ${region})`);
    
    const response = await axios.get(url, { params, timeout: 10000 });
    
    if (response.status === 200) {
      const items = response.data.items || [];
      console.log(`[searchWithGoogleCSE] Found ${items.length} results`);
      
      return items.map((item: any) => {
        const result: RawSourceItem = {
          title: item.title || '',
          url: item.link || '',
          snippet: item.snippet || '',
          domain: domainFromUrl(item.link || ''),
          publishedAt: item.pagemap?.metatags?.[0]?.['article:published_time'] || 
                       item.pagemap?.metatags?.[0]?.['date'] ||
                       undefined,
        };
        console.log(`[searchWithGoogleCSE]   - ${result.title.substring(0, 60)}... (${result.domain})`);
        return result;
      });
    } else {
      console.warn(`[searchWithGoogleCSE] API returned status ${response.status}`);
      return [];
    }
  } catch (e: any) {
    console.error('[searchWithGoogleCSE] Error:', e.message);
    if (e.response) {
      console.error('[searchWithGoogleCSE] Response status:', e.response.status);
      console.error('[searchWithGoogleCSE] Response data:', JSON.stringify(e.response.data));
    }
    return [];
  }
}

// 2) Use Gemini function-calling to issue multiple web_search calls (no built-in grounding)
export async function searchViaGeminiFunctionCalling(topic: string, region: string = "IN", category: string = "health", maxQueries = 5, perQuery = 10): Promise<{ queries: string[], sources: RawSourceItem[] }> {
  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  const webSearchDecl = {
    name: "web_search",
    description: "Execute a web search using Google Custom Search API. Returns credible news articles and sources. Use this to find recent, authoritative information.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING, description: "Precise search query optimized for news. Focus on recent developments, credible sources, region-specific content." },
        maxResults: { type: Type.INTEGER, description: "Number of results (1-10, default 10)" },
        region: { type: Type.STRING, description: "Region code (IN, US, etc.)" },
        language: { type: Type.STRING, description: "Language (en)" },
      },
      required: ["query"],
    },
  };

  const year = new Date().getFullYear();
  const system = `You are an expert research assistant for ${category} in ${region}.

Task: Generate 3-5 HUMAN-STYLE discovery queries for "${topic}" that surface trending coverage and official updates.

GUIDELINES:
1) Use natural aggregator-style phrasing: latest, updates, policy changes, government guidelines, reports, advisories, top stories, today/this week
2) Use the current year (${year}) and the region (${region}) where suitable
3) Keep queries broad enough to return multiple credible sources (avoid naming specific organizations unless the topic itself names them)
4) Ensure queries are meaningfully different (no word reordering)

OUTPUT: For each query you propose, immediately call web_search.`;
  const resp = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [system, `TOPIC: ${topic}`].join("\n\n"),
    config: { tools: [{ functionDeclarations: [webSearchDecl] }], temperature: 0.2, maxOutputTokens: 256 },
  });

  const fns = (resp as any).functionCalls || [];
  let planned: Array<{ q: string; n: number; r: string; lang: string }> = [];
  for (const fn of fns) {
    if (fn.name !== "web_search") continue;
    const q = String(fn.args?.query || "").trim();
    const n = Math.min(parseInt(fn.args?.maxResults || perQuery, 10) || perQuery, 20);
    const r = String(fn.args?.region || region);
    const lang = String(fn.args?.language || "en");
    if (q) planned.push({ q, n, r, lang });
  }

  // If model did not produce function calls, fallback to simple subquery proposal
  if (planned.length === 0) {
    const qs = await proposeSubqueries(topic, region, category);
    planned = qs.slice(0, maxQueries).map(q => ({ q, n: perQuery, r: region, lang: "en" }));
  }
  // Ensure at least 3 distinct queries; top out at maxQueries
  if (planned.length < Math.max(3, Math.min(5, maxQueries))) {
    const need = Math.max(3, Math.min(5, maxQueries)) - planned.length;
    const qs = await proposeSubqueries(topic, region, category);
    const existing = new Set(planned.map(p => p.q));
    for (const q of qs) {
      if (!existing.has(q)) {
        planned.push({ q, n: perQuery, r: region, lang: "en" });
        existing.add(q);
        if (planned.length >= Math.min(maxQueries, 5)) break;
      }
    }
  }
  planned = planned.slice(0, Math.min(maxQueries, 5));

  // Execute searches in parallel (bounded by Google CSE per-request max=10 handled in searchWithGoogleCSE)
  const settled = await Promise.allSettled(planned.map(p => searchWithGoogleCSE(p.q, p.n, p.r, p.lang)));
  const queries: string[] = planned.map(p => p.q);
  const results: RawSourceItem[] = [];
  for (const s of settled) {
    if (s.status === 'fulfilled' && Array.isArray(s.value)) {
      results.push(...s.value);
    }
  }

  // Deduplicate by URL
  const seen = new Set<string>();
  const dedup: RawSourceItem[] = [];
  for (const s of results) {
    if (!seen.has(s.url)) { seen.add(s.url); dedup.push(s); }
  }
  return { queries, sources: dedup };
}

// 3) Ask Gemini to categorize sources into clusters (no summarization), JSON-only output
export async function categorizeSources(sources: RawSourceItem[], topic: string, region: string, category: string): Promise<SourceCluster[]> {
  if (!sources.length) return [];
  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  const now = new Date();
  const expireAt = new Date(now.getTime() + 3 * 24 * 3600 * 1000).toISOString();

  const prompt = `You are a research organizer. Group these sources into distinct news-worthy clusters.

Rules:
- Each cluster represents a SPECIFIC story, research finding, policy, or development (NOT broad themes)
- Cluster title must be concrete and specific (e.g., "ICMR launches diabetes screening in 100 districts", NOT "diabetes awareness")
- Group sources that discuss the SAME specific event, study, or development
- Aim for 3-7 clusters; merge similar stories, separate distinct ones
- Output JSON strictly as { "clusters": [ { "claim": string (specific, <=120 chars), "items": [ {"title":, "url":, "domain":, "publishedAt":} ] } ] }`;

  const payload = {
    topic,
    region,
    category,
    sources: sources.map(s => ({ title: s.title, url: s.url, domain: s.domain, publishedAt: s.publishedAt }))
  };

  const resp = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `${prompt}\n\nINPUT:\n${JSON.stringify(payload, null, 2)}`,
    config: { temperature: 0.2, maxOutputTokens: 2048 }
  });

  let text = (resp as any).text || (resp as any).candidates?.[0]?.content?.parts?.[0]?.text || "";
  text = text.replace(/^```json\s*|\s*```$/g, "").trim();
  text = text.replace(/[\u0000-\u001F\u007F-\u009F]/g, "");
  const out: SourceCluster[] = [];
  try {
    const parsed = JSON.parse(text);
    const clusters = Array.isArray(parsed?.clusters) ? parsed.clusters : [];
    for (const c of clusters) {
      const claim = String(c.claim || "").trim();
      const items = Array.isArray(c.items) ? c.items : [];
      const id = sha1(`${claim}|${topic}|${region}|${items.slice(0,3).map((x:any)=>x.url).join(',')}`).slice(0, 20);
      out.push({
        id,
        claim,
        category,
        region,
        createdAt: now.toISOString(),
        expireAt,
        items: items.map((it: any) => ({
          title: String(it.title || ""),
          url: String(it.url || ""),
          domain: domainFromUrl(String(it.url || it.domain || "")),
          publishedAt: it.publishedAt || undefined,
        })),
        queries: [],
      });
    }
  } catch (e) {
    // Return a single cluster fallback
    const id = sha1(`${topic}|${region}|fallback`).slice(0, 20);
    out.push({ id, claim: topic, category, region, createdAt: now.toISOString(), expireAt, items: sources.slice(0, 10), queries: [] });
  }
  return out;
}
