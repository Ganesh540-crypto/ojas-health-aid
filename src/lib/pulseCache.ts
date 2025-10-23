import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import { firestore } from "@/lib/firebase";

export interface PulseArticle {
  id: string;
  title: string;
  summary: string;
  introduction?: string;
  sections?: Array<{ heading: string; content: string }>;
  sentences?: string[];
  lede?: string;
  paragraphs?: string[];
  keyPoints?: string[];
  tags: string[];
  source: string;
  sources?: string[];
  url: string;
  urls?: string[];
  publishedAt: string;
  processedAt?: string;
  locationRelevance?: string;
  urgency?: "low" | "medium" | "high" | "critical";
  keyInsights?: string[];
  imageUrl?: string;
}

interface PulseCacheData {
  articles: PulseArticle[];
  tags: string[];
  fetchedAt: number;
}

const KEY = "ojas.pulse.cache.v1";
export const PULSE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function getPulseCache(): PulseCacheData | null {
  try {
    // Prefer in-memory cache if present (fastest)
    const mem = (window as any).__OJAS_PULSE_CACHE__ as PulseCacheData | undefined;
    if (mem && Array.isArray(mem.articles) && mem.articles.length > 0) return mem;

    // Fallback to sessionStorage
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PulseCacheData;
    // Hydrate in-memory cache for next navigation
    (window as any).__OJAS_PULSE_CACHE__ = parsed;
    return parsed;
  } catch {
    return null;
  }
}

export function setPulseCache(data: PulseCacheData) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(data));
    (window as any).__OJAS_PULSE_CACHE__ = data; // quick in-memory access
  } catch {
    // ignore
  }
}

export function isPulseCacheFresh(cache: PulseCacheData | null, ttlMs: number = PULSE_CACHE_TTL_MS) {
  if (!cache) return false;
  return Date.now() - cache.fetchedAt < ttlMs;
}

export async function prefetchPulse(initialLimit = 30) {
  try {
    const col = collection(firestore, "pulse_articles");
    const q = query(col, orderBy("publishedAt", "desc"), limit(initialLimit));
    const snap = await getDocs(q);
    const articles: PulseArticle[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
    const tagSet = new Set<string>();
    articles.forEach(a => (a.tags || []).forEach(t => tagSet.add(t)));
    const tags = Array.from(tagSet).sort();
    setPulseCache({ articles, tags, fetchedAt: Date.now() });
  } catch (e) {
    // swallow prefetch errors
    console.warn("Pulse prefetch failed", e);
  }
}
