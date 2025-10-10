/*
  Ojas Pulse backend (serverless, TypeScript)
  Functions:
    - fetchHealthNews (Pub/Sub: news-fetch-trigger) → fetch Google Custom Search + RSS; publish raw items to news-process-queue
    - processNews (Pub/Sub: news-process-queue) → dedup/merge; publish unique to news-summarize-queue
    - summarizeNews (Pub/Sub: news-summarize-queue) → Gemini summary + tags; write to Firestore (pulse_raw)

  Env vars expected in Cloud Functions (2nd gen recommended):
    - GEMINI_API_KEY
    - GOOGLE_SEARCH_API_KEY
    - GOOGLE_SEARCH_ENGINE_ID
    - PULSE_SEARCH_DAILY_LIMIT (default 1000)
    - PULSE_QUERIES_PER_RUN (default 3)
*/

import axios from "axios";
import Parser from "rss-parser";
import crypto from "crypto";
import { PubSub } from "@google-cloud/pubsub";
import { Firestore, type Transaction } from "@google-cloud/firestore";
import { google } from "googleapis";
import { GoogleGenAI } from "@google/genai";
import { generateBalancedQueries } from "./queryGenerator";
import { synthesizeArticle } from "./synthesis";
import { searchViaGeminiFunctionCalling, categorizeSources } from "./research";
import { discoverTrendingTopics, discoverTopicsForCategory } from "./topicDiscovery";

const pubsub = new PubSub();
const firestore = new Firestore();
const parser = new Parser();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || "";
const GOOGLE_SEARCH_API_KEY = process.env.GOOGLE_SEARCH_API_KEY || process.env.VITE_GOOGLE_SEARCH_API_KEY || "";
const GOOGLE_SEARCH_ENGINE_ID = process.env.GOOGLE_SEARCH_ENGINE_ID || process.env.VITE_GOOGLE_SEARCH_ENGINE_ID || "";
const DAILY_LIMIT = parseInt(process.env.PULSE_SEARCH_DAILY_LIMIT || "1000", 10);
const QUERIES_PER_RUN = parseInt(process.env.PULSE_QUERIES_PER_RUN || "3", 10);
const DISABLE_CSE = String(process.env.PULSE_DISABLE_CSE || 'true').toLowerCase() === 'true';

const TOPIC_PROCESS = "news-process-queue";
const TOPIC_SUMMARIZE = "news-summarize-queue";

// Note: env validations are performed inside each function to avoid noisy logs at cold start.

// Trusted domains priority list
const TRUSTED_DOMAINS = [
  "who.int",
  "cdc.gov",
  "nih.gov",
  "icmr.gov.in",
  "mohfw.gov.in",
  "thelancet.com",
  "nejm.org",
  "bmj.com",
  "mayoclinic.org",
  "healthline.com",
  "webmd.com"
];

// Search categories
const SEARCH_QUERIES: Record<string, string> = {
  general: "health news OR medical news OR healthcare",
  mental: "mental health OR depression OR anxiety OR wellness",
  fitness: "fitness OR exercise OR physical activity OR workout",
  nutrition: "nutrition OR diet OR healthy eating",
  chronic: "diabetes OR heart disease OR cancer OR chronic illness",
  environment: "air quality OR environmental health OR climate health",
  pandemic: "outbreak OR epidemic OR infectious disease",
  medication: "medication OR drug OR pharmaceutical OR treatment",
};

const RSS_FEEDS = [
  "https://www.who.int/rss-feeds/news-english.xml",
  "https://tools.cdc.gov/api/v2/resources/media/132608.rss",
  "https://www.nih.gov/news-events/news-releases/rss",
  "https://feeds.medicalnewstoday.com/rss",
  "https://rss.healthline.com/health-news",
  "https://www.thelancet.com/rssfeed/lancet_current.xml",
];

// Helpers
const todayKey = () => new Date().toISOString().slice(0, 10);
const normalizeTitle = (t: string) => (t || "").toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
const sha1 = (s: string) => crypto.createHash("sha1").update(s).digest("hex");

// Try to parse Pub/Sub message from both Legacy and CloudEvent shapes
function parsePubSubJson(input: any): any {
  try {
    // CloudEvent (Gen2): input.data.message.data (base64)
    const ceDataB64 = input?.data?.message?.data;
    // Legacy background style: input.data (base64)
    const legacyB64 = input?.data;
    // Other possible wrappers
    const altB64 = input?.message?.data || input?.data?.data;
    const b64 = ceDataB64 || legacyB64 || altB64;
    if (!b64) return input?.json ?? null;
    const jsonStr = Buffer.from(b64, 'base64').toString('utf8');
    return jsonStr ? JSON.parse(jsonStr) : null;
  } catch (e) {
    console.warn('Failed to parse Pub/Sub message', e);
    return null;
  }
}

/**
 * Stage A: Research sources using Gemini function-calling (no built-in grounding)
 * - Proposes multiple queries
 * - Calls our provider-based search via function-calling (Serper/Brave/Bing/Tavily)
 * - Categorizes sources into clusters (claims)
 * - Stores clusters in `pulse_sources` with TTL (expireAt in 3 days)
 */
export async function researchSourcesHttp(req: any, res: any) {
  try {
    if (!GEMINI_API_KEY) {
      res.status(500).json({ ok: false, reason: 'missing_gemini_key' });
      return;
    }

    const topic = String(req.query.topic || 'health India latest').trim();
    const category = String(req.query.category || 'health');
    const region = String(req.query.region || 'IN');
    const maxQueries = Math.min(parseInt(req.query.maxQueries || '5', 10) || 5, 8);
    const perQuery = Math.min(parseInt(req.query.perQuery || '10', 10) || 10, 20);

    // Budget: count of queries we plan to run
    const allowed = await getAndConsumeBudget(maxQueries);
    if (!allowed) {
      res.status(429).json({ ok: false, reason: 'budget_exhausted' });
      return;
    }

    const { queries, sources } = await searchViaGeminiFunctionCalling(topic, region, category, maxQueries, perQuery);
    const clusters = await categorizeSources(sources, topic, region, category);

    const now = new Date();
    const expireAt = new Date(now.getTime() + 3 * 24 * 3600 * 1000).toISOString();

    let wrote = 0;
    for (const c of clusters) {
      const priorityScore = (category === 'health' ? 100 : 50) + (region === 'IN' ? 20 : 0);
      
      // Clean items to remove undefined values (Firestore doesn't accept undefined)
      const cleanItems = c.items.map((item: any) => {
        const cleaned: any = {
          title: item.title || '',
          url: item.url || '',
          snippet: item.snippet || '',
          domain: item.domain || '',
        };
        // Only include publishedAt if it exists
        if (item.publishedAt) {
          cleaned.publishedAt = item.publishedAt;
        }
        return cleaned;
      });
      
      await firestore.collection('pulse_sources').doc(c.id).set({
        claim: c.claim,
        category: c.category || category,
        region: c.region || region,
        items: cleanItems,
        queries: queries,
        createdAt: c.createdAt || now.toISOString(),
        expireAt: c.expireAt || expireAt,
        priorityScore,
        topic,
      }, { merge: true });
      wrote++;
    }

    // Log queries to tracking collection for monitoring
    await firestore.collection('pulse_query_log').add({
      topic,
      category,
      region,
      queries,
      queryCount: queries.length,
      sourceCount: sources.length,
      clusterCount: wrote,
      timestamp: now.toISOString(),
      window: Math.floor(now.getUTCHours() / 6),
    });

    res.json({ ok: true, topic, category, region, queries, queriesExecuted: queries.length, clusters: wrote, sources: sources.length });
  } catch (e: any) {
    console.error('[researchSourcesHttp] ERROR', e);
    res.status(500).json({ ok: false, error: e.message });
  }
}

/**
 * Stage B: Synthesize short articles from clusters using Gemini URL Context (no web search)
 * - Selects recent clusters from `pulse_sources`
 * - For each cluster, reads URLs via URL Context and writes a 4–5 sentence article to `pulse_articles`
 */
export async function synthesizeClustersHttp(req: any, res: any) {
  try {
    if (!GEMINI_API_KEY) {
      res.status(500).json({ ok: false, reason: 'missing_gemini_key' });
      return;
    }

    const limit = Math.min(parseInt(req.query.limit || '10', 10) || 10, 25);
    const category = String(req.query.category || 'health');
    const region = String(req.query.region || 'IN');

    // Fetch latest clusters (prefer requested category/region)
    let q = firestore.collection('pulse_sources')
      .orderBy('createdAt', 'desc')
      .limit(limit);
    // Note: Firestore requires composite index for multiple where+orderBy; keep minimal here
    const snap = await q.get();
    if (snap.empty) {
      res.json({ ok: true, synthesized: 0, reason: 'no_clusters' });
      return;
    }

    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    let success = 0, fail = 0;
    const docs = snap.docs;
    const BATCH_SIZE = 5;
    for (let i = 0; i < docs.length; i += BATCH_SIZE) {
      const batch = docs.slice(i, i + BATCH_SIZE);
      const settled = await Promise.allSettled(batch.map(async (doc) => {
        const c = doc.data() as any;
        if (!Array.isArray(c.items) || c.items.length === 0) return null;
        const urls: string[] = c.items.map((x: any) => x.url).filter(Boolean).slice(0, 15);
        const domains: string[] = c.items.map((x: any) => x.domain).filter(Boolean);
        const textUrls = urls.join('\n');

        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [
            `You are a professional news writer. Write a COMPREHENSIVE, IN-DEPTH article from the sources provided.\n\n` +
            `Output JSON only: {"title":string,"lede":string,"paragraphs":string[],"key_points":string[],"tags":string[]}\n\n` +
            `CRITICAL REQUIREMENTS:\n` +
            `1. title: Compelling, specific headline (8-15 words)\n` +
            `2. lede: Strong opening paragraph (3-4 sentences) covering WHO, WHAT, WHEN, WHERE, WHY, HOW\n` +
            `3. paragraphs: 8-15 SUBSTANTIAL body paragraphs (each 4-6 sentences)\n` +
            `   - Include background, context, expert perspectives, data, implications\n` +
            `   - Write like a professional news magazine (The Atlantic, Wired, etc.)\n` +
            `   - Natural prose, NO bullet points in paragraphs\n` +
            `   - Aim for 1500-2500 words total\n` +
            `4. key_points: 6-10 distinct insights that EXPAND on the article (not repeat lede)\n` +
            `5. tags: 6-12 relevant topics (use hyphens: "artificial-intelligence", "climate-change")\n` +
            `6. Be neutral, factual, engaging, and comprehensive\n` +
            `7. NO citations like [1], NO markdown formatting, NO repetition\n\n` +
            `TOPIC: ${c.claim}\n\nSOURCES:\n${textUrls}`
          ],
          config: { tools: [{ urlContext: {} }], temperature: 0.4, maxOutputTokens: 8192 },
        });

        // Parse model output robustly
        let raw = (response as any).text || (response as any).candidates?.[0]?.content?.parts?.[0]?.text || '';
        raw = raw.replace(/^```json\s*|\s*```$/g, '').trim();
        raw = raw.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');

        let parsed: any;
        try {
          parsed = JSON.parse(raw);
        } catch {
          parsed = { title: c.claim, lede: raw, paragraphs: [], key_points: [], tags: [category] };
        }

        const title: string = String(parsed.title || c.claim);
        const lede: string = String(parsed.lede || '');
        const paragraphs: string[] = Array.isArray(parsed.paragraphs) ? parsed.paragraphs.map((p: any) => String(p)).slice(0, 4) : [];
        const keyPoints: string[] = Array.isArray(parsed.key_points) ? parsed.key_points.map((p: any) => String(p)).slice(0, 5) : [];
        const tags: string[] = Array.isArray(parsed.tags) ? parsed.tags.map((t: any) => String(t)).slice(0, 8) : [category];

        const createdAt = new Date().toISOString();
        const expireAt = c.expireAt || new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString();
        const id = sha1(`${title}|${doc.id}`).slice(0, 20);

        // Best-effort meta for image/publish date from first URL
        let meta: { imageUrl?: string; publishedAt?: string } = {};
        try { if (urls[0]) meta = await extractMeta(urls[0]); } catch {}

        const data: any = {
          clusterId: doc.id,
          title,
          lede,
          paragraphs,
          keyPoints,
          summary: lede || paragraphs[0] || '',
          category: c.category || category,
          region: c.region || region,
          tags,
          sources: Array.from(new Set(domains)),
          urls: urls,
          createdAt,
          publishedAt: meta.publishedAt || createdAt,
          expireAt,
          priorityScore: (c.category === 'health' ? 100 : 50) + (c.region === 'IN' ? 20 : 0),
        };
        if (domains[0]) data.source = domains[0];
        if (urls[0]) data.url = urls[0];
        if (meta.imageUrl) data.imageUrl = meta.imageUrl;

        await firestore.collection('pulse_articles').doc(id).set(data, { merge: true });
        return id;
      }));

      for (const r of settled) {
        if (r.status === 'fulfilled' && r.value) success++; else fail++;
      }
    }

    res.json({ ok: true, synthesized: success, failed: fail });
  } catch (e: any) {
    console.error('[synthesizeClustersHttp] ERROR', e);
    res.status(500).json({ ok: false, error: e.message });
  }
}

// Smart quota management: 250 queries per 6-hour window (4 windows per day = 1000 total)
async function getAndConsumeBudget(need: number) {
  const ref = firestore.collection("pulse_config").doc("api_usage");
  const now = new Date();
  const date = todayKey();
  const hour = now.getUTCHours();
  // Determine 6-hour window: 0-5 (morning), 6-11 (afternoon), 12-17 (evening), 18-23 (night)
  const window = Math.floor(hour / 6); // 0, 1, 2, or 3
  const windowKey = `${date}_w${window}`;
  const WINDOW_LIMIT = 250;
  
  let allowed = false;
  let currentCount = 0;
  await firestore.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = (snap.exists ? snap.data() : {}) as any;
    const windows = data.windows || {};
    currentCount = windows[windowKey] || 0;
    
    if (currentCount + need <= WINDOW_LIMIT) {
      allowed = true;
      windows[windowKey] = currentCount + need;
      tx.set(ref, { 
        date,
        windows,
        lastUpdated: now.toISOString(),
        currentWindow: window,
        currentWindowCount: currentCount + need
      }, { merge: true });
    } else {
      allowed = false;
    }
  });
  
  if (!allowed) {
    console.warn(`[Budget] Window ${window} exhausted: ${currentCount}/${WINDOW_LIMIT} queries used`);
  }
  return allowed;
}

function domainFromUrl(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

async function extractMeta(url: string) {
  try {
    const res = await axios.get(url, { timeout: 5000, headers: { "User-Agent": "OjasPulseBot/1.0" } });
    const html = res.data as string;
    const ogImage = (html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) || [])[1];
    const published = (html.match(/<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)["']/i) || [])[1]
      || (html.match(/<meta[^>]+name=["']date["'][^>]+content=["']([^"']+)["']/i) || [])[1];
    return { imageUrl: ogImage, publishedAt: published };
  } catch {
    return { imageUrl: undefined, publishedAt: undefined };
  }
}

function mapSearchItem(item: any) {
  const url = item.link;
  const source = domainFromUrl(url);
  const publishedAt = item.pagemap?.metatags?.[0]?.["article:published_time"] || undefined;
  const imageUrl = item.pagemap?.cse_image?.[0]?.src || item.pagemap?.metatags?.[0]?.["og:image"];
  return {
    title: item.title as string,
    url,
    snippet: item.snippet as string,
    source,
    publishedAt,
    imageUrl,
    fetchedAt: new Date().toISOString(),
  };
}

async function fetchFromCustomSearch(categories: string[]) {
  const customsearch = google.customsearch("v1");
  const out: any[] = [];
  for (const category of categories) {
    const q = SEARCH_QUERIES[category] || SEARCH_QUERIES.general;
    // Fully open search (no domain restriction) for broader coverage
    const queryStr = q;
    const resp = await customsearch.cse.list({
      auth: GOOGLE_SEARCH_API_KEY,
      cx: GOOGLE_SEARCH_ENGINE_ID,
      q: queryStr,
      // Allow up to 1 week for better recall but still fresh
      dateRestrict: "w1",
      num: 10,
      safe: "active",
    } as any);
    const items = resp.data.items || [];
    for (const it of items) {
      out.push(mapSearchItem(it));
    }
  }
  // Enrich missing meta in parallel (best effort)
  await Promise.all(out.map(async (a) => {
    if (!a.imageUrl || !a.publishedAt) {
      const meta = await extractMeta(a.url);
      a.imageUrl = a.imageUrl || meta.imageUrl;
      a.publishedAt = a.publishedAt || meta.publishedAt || new Date().toISOString();
    }
  }));
  return out;
}

async function fetchFromRSS() {
  const out: any[] = [];
  for (const feedUrl of RSS_FEEDS) {
    try {
      const feed = await parser.parseURL(feedUrl);
      for (const it of feed.items || []) {
        const pub = it.isoDate || it.pubDate || new Date().toISOString();
        out.push({
          title: it.title,
          url: it.link,
          snippet: it.contentSnippet || (it.content ? String(it.content).slice(0, 200) : ""),
          source: domainFromUrl(feedUrl),
          publishedAt: pub,
          imageUrl: undefined,
          fetchedAt: new Date().toISOString(),
        });
      }
    } catch (e) {
      console.warn("RSS error", feedUrl, e);
    }
  }
  return out;
}

function dedupKey(a: { title: string; url: string }) {
  return sha1(`${normalizeTitle(a.title)}|${domainFromUrl(a.url)}`);
}

async function findExistingByTitleOrUrl(title: string, url: string): Promise<{ id: string; data: any } | null> {
  // TODO: Re-enable dedup after creating Firestore index
  // For now, skip dedup to get pipeline working
  return null;
}

// ========== EXPORT FUNCTIONS ==========

// Internal shared runner used by both EventArc and HTTP debug
async function runFetchOnce() {
  console.log('[runFetchOnce] Starting with env check...');
  if (DISABLE_CSE) {
    console.warn('[runFetchOnce] CSE pipeline is disabled (PULSE_DISABLE_CSE=true). Skipping run.');
    return { ok: false, reason: 'cse_disabled' } as const;
  }
  console.log('[runFetchOnce] GOOGLE_SEARCH_API_KEY length:', GOOGLE_SEARCH_API_KEY?.length || 0);
  console.log('[runFetchOnce] GOOGLE_SEARCH_ENGINE_ID length:', GOOGLE_SEARCH_ENGINE_ID?.length || 0);
  
  if (!GOOGLE_SEARCH_API_KEY || !GOOGLE_SEARCH_ENGINE_ID) {
    console.warn('[runFetchOnce] Missing Google Custom Search env; skipping run');
    return { ok: false, reason: 'missing_search_env' } as const;
  }
  
  console.log('[runFetchOnce] Checking budget...');
  // Enforce daily budget
  const allowed = await getAndConsumeBudget(QUERIES_PER_RUN);
  if (!allowed) {
    console.log('[runFetchOnce] Daily budget exhausted; skipping');
    return { ok: false, reason: 'budget_exhausted' } as const;
  }

  const categories = Object.keys(SEARCH_QUERIES);
  const startIdx = Math.floor(Date.now() / (5 * 60 * 1000)) % categories.length;
  const chosen: string[] = [];
  for (let i = 0; i < QUERIES_PER_RUN; i++) {
    chosen.push(categories[(startIdx + i) % categories.length]);
  }
  console.log('[runFetchOnce] queries', { chosen, QUERIES_PER_RUN });

  console.log('[runFetchOnce] Fetching from Google Custom Search...');
  let searchItems: any[] = [];
  try {
    searchItems = await fetchFromCustomSearch(chosen);
    console.log('[runFetchOnce] Got search items:', searchItems.length);
  } catch (e) {
    console.error('[runFetchOnce] Google Custom Search error:', e);
    console.error('[runFetchOnce] Stack:', (e as Error)?.stack);
  }
  
  console.log('[runFetchOnce] Fetching from RSS...');
  let rssItems: any[] = [];
  try {
    rssItems = await fetchFromRSS();
    console.log('[runFetchOnce] Got RSS items:', rssItems.length);
  } catch (e) {
    console.error('[runFetchOnce] RSS fetch error:', e);
  }
  
  const articles = [...searchItems, ...rssItems];
  console.log(`[runFetchOnce] Fetched ${articles.length} candidate items`);
  if (!articles.length) return { ok: true, published: 0 } as const;

  console.log('[runFetchOnce] Publishing to Pub/Sub topic:', TOPIC_PROCESS);
  const topic = pubsub.topic(TOPIC_PROCESS);
  await Promise.all(articles.map((a) => topic.publishMessage({ json: a })));
  console.log('[runFetchOnce] Published to process queue', { count: articles.length });
  return { ok: true, published: articles.length } as const;
}

// Pub/Sub trigger: news-fetch-trigger
export async function fetchHealthNews(event: any) {
  try {
    console.log('[fetchHealthNews] invoked', { time: new Date().toISOString() });
    await runFetchOnce();
  } catch (e) {
    console.error('[fetchHealthNews] ERROR', e);
  }
}

// HTTP debug helper (authenticated): invoke one fetch run
export async function fetchHealthNewsHttp(req: any, res: any) {
  try {
    // Basic auth guard: require an identity token subject
    if (!req.headers.authorization) {
      res.status(401).json({ ok: false, error: 'missing_auth' });
      return;
    }
    console.log('[fetchHealthNewsHttp] Starting fetch run...');
    const result = await runFetchOnce();
    console.log('[fetchHealthNewsHttp] Result:', result);
    res.json(result);
  } catch (e) {
    console.error('[fetchHealthNewsHttp] ERROR:', e);
    console.error('[fetchHealthNewsHttp] Stack:', (e as Error)?.stack);
    console.error('[fetchHealthNewsHttp] Message:', (e as Error)?.message);
    res.status(500).json({ ok: false, error: (e as Error)?.message || String(e) });
  }
}

// Pub/Sub trigger: news-process-queue
export async function processNews(message: any) {
  try {
    console.log('[processNews] invoked');
    const article = parsePubSubJson(message);
    if (!article) {
      console.warn('[processNews] No article payload');
      return;
    }
    const key = dedupKey(article);

    // try merge into existing pulse_raw
    const existing = await findExistingByTitleOrUrl(article.title, article.url);
    if (existing) {
      const docRef = firestore.collection('pulse_raw').doc(existing.id);
      await docRef.set({
        sources: Array.from(new Set([...(existing.data.sources || [existing.data.source]).filter(Boolean), article.source].filter(Boolean))),
        urls: Array.from(new Set([...(existing.data.urls || [existing.data.url]).filter(Boolean), article.url].filter(Boolean))),
        imageUrl: existing.data.imageUrl || article.imageUrl || null,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      console.log('[processNews] merged', existing.id);
      return;
    }

    // publish to summarization queue (unique)
    await pubsub.topic(TOPIC_SUMMARIZE).publishMessage({ json: article });
    console.log('[processNews] forwarded to summarize');
  } catch (e) {
    console.error('[processNews] ERROR', e);
  }
}

// Pub/Sub trigger: news-summarize-queue
export async function summarizeNews(message: any) {
  try {
    console.log('[summarizeNews] invoked');
    const article = parsePubSubJson(message);
    if (!article) {
      console.warn('[summarizeNews] No article payload');
      return;
    }
    if (!GEMINI_API_KEY) {
      console.warn('[summarizeNews] No GEMINI_API_KEY; skipping');
      return;
    }

    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

  const prompt = `You are a health news summarizer for Ojas Pulse.
Summarize the input into 3-7 sentences focused on key health insights for a general audience.
Output strict JSON (no markdown, no code fences) with keys: summary (string), tags (array of strings chosen from ["mental-health","fitness","nutrition","chronic-disease","medication","environmental-health","pandemic","preventive-care","women-health","child-health","aging","sleep","stress"]), locationRelevance ("global" or "country:XX" or "city:Name"), urgency ("low"|"medium"|"high"|"critical"), keyInsights (array of short strings). Do not include any other keys.

Title: ${article.title}
Source: ${article.source}
URL: ${article.url}
Published: ${article.publishedAt}

Snippet:
${article.snippet || ""}`;

  let parsed: any = null;
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });
    let text = response.text || "";
    if (!text) {
      throw new Error("Empty response from Gemini");
    }
    // Strip markdown code fences if present
    text = text.replace(/^```json\s*|\s*```$/g, '').trim();
    parsed = JSON.parse(text);
  } catch (e) {
    console.warn("Gemini parse failed; falling back to simple summary", e);
    parsed = { summary: article.snippet || article.title, tags: [], locationRelevance: "global", urgency: "low", keyInsights: [] };
  }

  const doc = {
    title: article.title,
    summary: parsed.summary,
    tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 8) : [],
    locationRelevance: parsed.locationRelevance || "global",
    urgency: parsed.urgency || "low",
    keyInsights: Array.isArray(parsed.keyInsights) ? parsed.keyInsights.slice(0, 5) : [],
    source: article.source,
    sources: article.sources ? Array.from(new Set(article.sources)) : [article.source],
    url: article.url,
    urls: article.urls ? Array.from(new Set(article.urls)) : [article.url],
    imageUrl: article.imageUrl || null,
    clusterId: sha1(normalizeTitle(article.title)).slice(0, 12),
    category: null,
    publishedAt: article.publishedAt || new Date().toISOString(),
    processedAt: new Date().toISOString(),
  } as any;

  // Upsert by normalized title hash within 7 days
  const id = sha1(`${normalizeTitle(doc.title)}|${domainFromUrl(doc.url)}`).slice(0, 20);
  await firestore.collection('pulse_raw').doc(id).set(doc, { merge: true });
  console.log('[summarizeNews] wrote', id);
  } catch (e) {
    console.error('[summarizeNews] ERROR', e);
  }
}

/**
 * AUTONOMOUS TOPIC DISCOVERY + RESEARCH
 * Gemini discovers trending topics → generates queries → searches → clusters → synthesizes
 * NO predefined topics!
 */
export async function autonomousResearchHttp(req: any, res: any) {
  try {
    console.log('[autonomousResearch] Starting autonomous discovery...');
    
    if (!GEMINI_API_KEY || !GOOGLE_SEARCH_API_KEY || !GOOGLE_SEARCH_ENGINE_ID) {
      res.status(500).json({ ok: false, reason: 'missing_api_keys' });
      return;
    }
    
    const region = String(req.query.region || 'IN');
    const category = req.query.category ? String(req.query.category) : null;
    const maxTopics = parseInt(req.query.maxTopics || '10', 10);
    
    console.log(`[autonomousResearch] Discovering topics (category: ${category || 'all'}, region: ${region})`);
    
    // Step 1: Discover trending topics autonomously
    const discoveredTopics = category
      ? await discoverTopicsForCategory(category, region, maxTopics)
      : await discoverTrendingTopics(region, maxTopics);
    
    if (!discoveredTopics.length) {
      console.warn('[autonomousResearch] No topics discovered');
      res.json({ ok: true, discovered: 0, clusters: 0, synthesized: 0 });
      return;
    }
    
    console.log(`[autonomousResearch] Discovered ${discoveredTopics.length} topics:`, 
      discoveredTopics.map(t => `${t.topic} (${t.category}, priority ${t.priority})`));
    
    // Step 2: For each discovered topic, generate queries and search
    let totalClusters = 0;
    const clusterIds: string[] = [];
    
    for (const discovered of discoveredTopics) {
      console.log(`[autonomousResearch] Researching: ${discovered.topic}`);
      
      try {
        // Use searchViaGeminiFunctionCalling to generate human-style queries and search
        const { queries, sources } = await searchViaGeminiFunctionCalling(
          discovered.topic,
          region,
          discovered.category,
          4,  // maxQueries per topic
          8   // results per query
        );
        
        console.log(`[autonomousResearch]   Generated ${queries.length} queries, found ${sources.length} sources`);
        
        if (sources.length === 0) {
          console.warn(`[autonomousResearch]   No sources found for: ${discovered.topic}`);
          continue;
        }
        
        // Step 3: Categorize sources into clusters
        const clusters = await categorizeSources(sources, discovered.topic, region, discovered.category);
        console.log(`[autonomousResearch]   Created ${clusters.length} clusters`);
        
        // Step 4: Write clusters to Firestore (clean undefined values)
        for (const cluster of clusters) {
          cluster.queries = queries;  // Attach the queries used
          
          // Clean undefined publishedAt values
          cluster.items = cluster.items.map(item => ({
            ...item,
            publishedAt: item.publishedAt || null
          }));
          
          await firestore.collection('pulse_sources').doc(cluster.id).set(cluster);
          clusterIds.push(cluster.id);
        }
        
        totalClusters += clusters.length;
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (e) {
        console.error(`[autonomousResearch] Error researching ${discovered.topic}:`, e);
      }
    }
    
    console.log(`[autonomousResearch] Complete: ${discoveredTopics.length} topics → ${totalClusters} clusters`);
    
    res.json({
      ok: true,
      discovered: discoveredTopics.length,
      topics: discoveredTopics.map(t => ({ topic: t.topic, category: t.category, priority: t.priority })),
      clusters: totalClusters,
      clusterIds: clusterIds.slice(0, 20)  // Return first 20 IDs
    });
    
  } catch (error: any) {
    console.error('[autonomousResearch] ERROR:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
}

/**
 * Generate comprehensive multi-source articles (NEW PERPLEXITY-STYLE SYSTEM)
 * Triggered via HTTP or Pub/Sub
 * Generates queries → Synthesizes with Google Search → Writes to Firestore
 */
export async function generateArticlesHttp(req: any, res: any) {
  try {
    console.log('[generateArticles] invoked');
    
    if (!GEMINI_API_KEY) {
      console.warn('[generateArticles] No GEMINI_API_KEY');
      res.status(500).json({ ok: false, reason: 'missing_gemini_key' });
      return;
    }
    
    // Get count from query params (default 50 for testing, can scale to 1000+)
    const count = parseInt(req.query.count || '50', 10);
    const category = req.query.category; // Optional: generate for specific category
    
    console.log(`[generateArticles] Generating ${count} queries...`);
    
    // Generate diverse health queries
    const queries = generateBalancedQueries(count);
    console.log(`[generateArticles] Generated ${queries.length} queries`);
    
    let successCount = 0;
    let failCount = 0;
    
    // Process queries in small batches to avoid overwhelming the API
    const BATCH_SIZE = 5;
    for (let i = 0; i < queries.length; i += BATCH_SIZE) {
      const batch = queries.slice(i, i + BATCH_SIZE);
      
      console.log(`[generateArticles] Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(queries.length / BATCH_SIZE)}`);
      
      const results = await Promise.allSettled(
        batch.map(async (queryObj) => {
          const article = await synthesizeArticle(queryObj.query, GEMINI_API_KEY, queryObj.category);
          
          if (article) {
            // Save to Firestore
            const id = sha1(`${normalizeTitle(article.title)}|${article.query}`).slice(0, 20);
            
            const doc = {
              title: article.title,
              summary: article.summary,
              keyInsights: article.keyInsights,
              category: article.category,
              tags: article.tags,
              urgency: article.urgency,
              locationRelevance: article.locationRelevance,
              // Frontend expects separate sources and urls arrays
              sources: article.sources.map(s => s.domain || s.name || 'Unknown Source'),
              urls: article.sources.map(s => s.url),
              source: article.sources[0]?.domain || article.sources[0]?.name || 'AI Generated',
              url: article.sources[0]?.url || '#',
              query: article.query,
              clusterId: sha1(normalizeTitle(article.title)).slice(0, 12),
              generatedAt: article.generatedAt,
              processedAt: new Date().toISOString(),
              publishedAt: new Date().toISOString(), // Generated articles are "published" now
              imageUrl: null, // Can be added later if we extract images from sources
            };
            
            await firestore.collection('pulse_raw').doc(id).set(doc, { merge: false });
            console.log(`[generateArticles] ✓ Wrote: ${article.title.substring(0, 60)}...`);
            return { success: true, id };
          }
          
          return { success: false };
        })
      );
      
      // Count successes
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value.success) {
          successCount++;
        } else {
          failCount++;
        }
      }
      
      // Rate limiting between batches
      if (i + BATCH_SIZE < queries.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    console.log(`[generateArticles] Complete: ${successCount} success, ${failCount} failed`);
    
    res.json({
      ok: true,
      generated: successCount,
      failed: failCount,
      total: queries.length,
    });
    
  } catch (error: any) {
    console.error('[generateArticles] ERROR:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
}
