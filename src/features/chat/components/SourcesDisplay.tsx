import React, { useState } from 'react';
import { Globe, ChevronRight, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { db } from '@/lib/firebase';
import { ref, get, set } from 'firebase/database';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

export interface Source {
  title: string;
  url: string;
  snippet?: string;
  displayUrl?: string;
}

// Unified helper to compute resolvedUrl, siteUrl and the exact sourceKey
function computeKeys(source: Source): { resolvedUrl: string; siteUrl: string; sourceKey: string } {
  const resolvedUrl = resolveDestinationFromSource(source);
  const siteUrl = preferredSiteUrl(source, resolvedUrl);
  const sourceKey = resolvedUrl || siteUrl || source.url;
  return { resolvedUrl, siteUrl, sourceKey };
}

// Helpers to unify how we read and write metadata so keys never miss
type Meta = { title?: string; description?: string; image?: string };
function normalizeSetMeta(
  setter: React.Dispatch<React.SetStateAction<Record<string, Meta>>>,
  source: Source,
  keys: { resolvedUrl: string; siteUrl: string },
  meta: Meta
) {
  setter((prev) => ({
    ...prev,
    [keys.resolvedUrl]: meta,
    [keys.siteUrl]: meta,
    [source.url]: meta,
  }));
}
function normalizeGetMeta(
  map: Record<string, Meta>,
  source: Source,
  keys: { resolvedUrl: string; siteUrl: string; sourceKey: string }
): Meta | undefined {
  return (
    map[keys.sourceKey] ||
    map[keys.resolvedUrl] ||
    map[keys.siteUrl] ||
    map[source.url]
  );
}

// Lightweight localStorage helpers for caching
const DECODed_LS_KEY = 'ojas_sources_decoded_v1';
const META_LS_KEY = 'ojas_sources_meta_v1';
function readLS<T>(key: string): T | null { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) as T : null; } catch { return null; } }
function writeLS<T>(key: string, val: T) { try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* ignore */ } }
function getDecodedFromCache(redirectUrl: string): string | null { const m = readLS<Record<string, string>>(DECODed_LS_KEY); return m?.[redirectUrl] || null; }
function setDecodedInCache(redirectUrl: string, decoded: string) { const m = readLS<Record<string, string>>(DECODed_LS_KEY) || {}; m[redirectUrl] = decoded; writeLS(DECODed_LS_KEY, m); }
function getMetaFromCache(url: string): { title?: string; description?: string; image?: string } | null { const m = readLS<Record<string, { title?: string; description?: string; image?: string }>>(META_LS_KEY); return m?.[url] || null; }
function setMetaInCache(url: string, meta: { title?: string; description?: string; image?: string }) { const m = readLS<Record<string, { title?: string; description?: string; image?: string }>>(META_LS_KEY) || {}; m[url] = meta; writeLS(META_LS_KEY, m); }

// Remove concurrency limiting to speed up fetches

// DB-safe key from URL
function keyFromUrl(u: string): string {
  try { return btoa(unescape(encodeURIComponent(u))).replace(/=+$/,'').replace(/\+/g,'-').replace(/\//g,'_'); } catch { return encodeURIComponent(u); }
}

// Build an http(s) URL from the best non-redirect hint: displayUrl > title(domain) > resolved article URL
function preferredSiteUrl(source: Source, resolvedUrl?: string): string {
  const ensureHttp = (v: string) => (/^https?:\/\//i.test(v) ? v : `https://${v}`);

  if (source.displayUrl && source.displayUrl.trim()) {
    return ensureHttp(source.displayUrl.trim());
  }
  // If title looks like a domain (e.g., ajithp.com), prefer that
  if (source.title) {
    const t = source.title.trim();
    if (/^(?:[a-z0-9-]+\.)+[a-z]{2,}$/i.test(t)) {
      return ensureHttp(t);
    }
  }
  // Fall back to resolvedUrl's host (strip path), but avoid redirect hosts
  if (resolvedUrl) {
    try {
      const u = new URL(ensureHttp(unwrapRedirect(resolvedUrl)));
      if (!isRedirectHost(u.hostname)) {
        return `${u.protocol}//${u.hostname}`;
      }
    } catch { /* ignore */ }
  }
  // Last resort: original url
  return ensureHttp(source.url);
}

function extractHost(url: string): string | null {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return null; }
}

function domainFrom(source: Source, resolvedUrl: string): string | null {
  const domainRegex = /([a-z0-9-]+(?:\.[a-z0-9-]+)+)/i;
  const domainLike = (s: string) => /^(?:[a-z0-9-]+\.)+[a-z]{2,}$/i.test(s);
  // 1) Prefer displayUrl if provided
  if (source.displayUrl && source.displayUrl.trim()) {
    const h2 = extractHost(/^https?:\/\//i.test(source.displayUrl) ? source.displayUrl : `https://${source.displayUrl}`);
    if (h2 && !isRedirectHost(h2)) return h2.toLowerCase();
  }
  // 2) Then title if it looks like a domain
  if (source.title) {
    const t = source.title.trim();
    if (domainLike(t) && !isRedirectHost(t)) {
      return t.toLowerCase();
    }
    const m = t.match(domainRegex);
    if (m && m[1] && !isRedirectHost(m[1])) {
      return m[1].toLowerCase();
    }
  }
  // 3) Finally, resolved URL host
  const host = extractHost(resolvedUrl);
  if (host && !isRedirectHost(host)) return host.toLowerCase();
  return null;
}

interface SourcesDisplayProps {
  sources: Source[];
  className?: string;
}

// Lightweight favicon renderer with graceful fallback
// Unwrap common redirector URLs (google, vertex) to fetch the actual site's favicon
function unwrapRedirect(raw: string): string {
  try {
    const ensureHttp = (u: string) => /^https?:\/\//i.test(u) ? u : `https://${u}`;
    let u: URL;
    try { u = new URL(raw); } catch { u = new URL(ensureHttp(raw)); }
    const host = u.hostname;
    const protocol = u.protocol;

    // Helper: base64url -> UTF-8 string
    const b64UrlToUtf8 = (token: string): string | null => {
      try {
        const normalized = token.replace(/-/g, '+').replace(/_/g, '/');
        const padLen = (4 - (normalized.length % 4)) % 4;
        const padded = normalized + '='.repeat(padLen);
        const binary = atob(padded);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const text = new TextDecoder('utf-8').decode(bytes);
        return text;
      } catch {
        return null;
      }
    };

    // Helper: extract an http(s) URL from a blob of text
    const extractUrl = (text: string): string | null => {
      // 1) Clear http(s)
      let m = text.match(/https?:\/\/[\w\-._~:/?#\[\]@!$&'()*+,;=%]+/);
      if (m && m[0]) return m[0];
      // 2) Percent-encoded http(s)
      m = text.match(/https%3A%2F%2F[0-9A-Za-z%._\-~/?#=&+]+/);
      if (m && m[0]) return decodeURIComponent(m[0]);
      // 3) Try decoding once and search again
      try {
        const once = decodeURIComponent(text);
        m = once.match(/https?:\/\/[\w\-._~:/?#\[\]@!$&'()*+,;=%]+/);
        if (m && m[0]) return m[0];
      } catch { /* ignore */ }
      // 4) Try JSON parse and scan values
      try {
        const data = JSON.parse(text);
        const scan = (v: any): string | null => {
          if (typeof v === 'string') {
            const mm = v.match(/https?:\/\/[\w\-._~:/?#\[\]@!$&'()*+,;=%]+/);
            if (mm && mm[0]) return mm[0];
          } else if (v && typeof v === 'object') {
            for (const k of Object.keys(v)) {
              const r = scan(v[k]);
              if (r) return r;
            }
          } else if (Array.isArray(v)) {
            for (const item of v) {
              const r = scan(item); if (r) return r;
            }
          }
          return null;
        };
        const found = scan(data);
        if (found) return found;
      } catch { /* ignore */ }
      return null;
    };

    // Decode Vertex grounding redirect token when present: /grounding-api-redirect/<base64url>
    if (/vertexaisearch\.cloud\.google\.com$/i.test(host) && /\/grounding-api-redirect\//i.test(u.pathname)) {
      const token = u.pathname.split('/').filter(Boolean).pop() || '';
      const decodedText = b64UrlToUtf8(token);
      if (decodedText) {
        const extracted = extractUrl(decodedText);
        if (extracted) return extracted;
      }
    }
    // Handle custom schemes like grounding-api-redirect://host/path -> https://host/path
    if (/^grounding/i.test(protocol) || /^vertex/i.test(protocol) || /^genai/i.test(protocol)) {
      const param = u.searchParams.get('q') || u.searchParams.get('url') || u.searchParams.get('u');
      if (param) {
        try {
          return new URL(ensureHttp(decodeURIComponent(param))).toString();
        } catch { /* ignore and rebuild instead */ }
      }
      if (host) {
        return `https://${host}${u.pathname || ''}${u.search || ''}`;
      }
    }
    const isGoogleUrl = host.endsWith('google.com');
    const isGoogleUser = host.endsWith('googleusercontent.com');
    const isVertex = /vertex|gemini/i.test(host);
    if (isGoogleUrl && u.pathname === '/url') {
      const target = u.searchParams.get('q') || u.searchParams.get('url') || u.searchParams.get('u');
      if (target) return target;
    }
    if (isGoogleUrl || isGoogleUser || isVertex) {
      const target = u.searchParams.get('q') || u.searchParams.get('url') || u.searchParams.get('u');
      if (target) return target;
    }
    return u.toString();
  } catch {
    return raw;
  }
}

function displayFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    return host;
  } catch {
    return url;
  }
}

function isRedirectHost(host: string): boolean {
  const h = host.toLowerCase();
  return (
    h === 'vertexaisearch.cloud.google.com' ||
    h.endsWith('.googleusercontent.com') ||
    h === 'google.com' || h === 'www.google.com' ||
    h === 'gemini.google.com' ||
    h.endsWith('.google.com') // conservative fallback
  );
}

// Detect token-like or random-looking strings (e.g., Vertex redirect tokens)
function looksLikeToken(text?: string | null): boolean {
  if (!text) return false;
  const s = String(text).trim();
  if (s.length < 12) return false;
  const collapsed = s.replace(/\s+/g, '');
  // Very long single run of mostly base64/url-safe chars
  if (/^[A-Za-z0-9+/_=-]{20,}$/.test(collapsed)) return true;
  // Long run of base64url set anywhere
  if (/[A-Za-z0-9_-]{18,}/.test(collapsed)) return true;
  // If almost no spaces and long, consider token-ish
  const spaceCount = (s.match(/\s/g) || []).length;
  if (spaceCount === 0 && collapsed.length >= 20) return true;
  return false;
}

function pickParam(u: URL, keys: string[]): string | null {
  for (const k of keys) {
    const v = u.searchParams.get(k);
    if (v) return v;
  }
  return null;
}

function resolveDestinationFromSource(source: Source): string {
  const ensureHttp = (v: string) => /^https?:\/\//i.test(v) ? v : `https://${v}`;
  // Try to decode to the actual article URL
  const cached = getDecodedFromCache(source.url);
  const decoded = cached ?? unwrapRedirect(source.url);
  try {
    const u = new URL(ensureHttp(decoded));
    if (!isRedirectHost(u.hostname)) {
      if (!cached) setDecodedInCache(source.url, u.toString());
      // Persist decoded mapping to DB asynchronously (fire-and-forget)
      try { set(ref(db, `decoded/${keyFromUrl(source.url)}`), { decoded: u.toString(), ts: Date.now() }); } catch {}
      return u.toString();
    }
  } catch { /* ignore */ }
  // If decoding fails or still a redirect host, return the original link so server-side redirect opens the article
  return source.url;
}

const Favicon: React.FC<{ url: string; className?: string }> = ({ url, className }) => {
  const [fallbackIndex, setFallbackIndex] = useState(0);

  // React 19: No useMemo needed - React Compiler optimizes
  const candidates: string[] = [];
  const tryParse = (raw: string): URL | null => {
    const cleaned = unwrapRedirect(raw);
    try { return new URL(cleaned); } catch {
      try { return new URL(`https://${cleaned}`); } catch { return null; }
    }
  };
  const u = tryParse(url);
  if (u) {
    const host = u.hostname;
    candidates.push(`https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(u.toString())}`);
    if (!isRedirectHost(host)) {
      candidates.push(`${u.origin}/favicon.ico`);
    }
    candidates.push(`https://icons.duckduckgo.com/ip3/${host}.ico`);
  }
  const srcs = candidates;

  if (fallbackIndex >= srcs.length) {
    return <Globe className={className ?? ''} aria-hidden="true" />;
  }

  return (
    <img
      src={srcs[fallbackIndex]}
      alt=""
      width={16}
      height={16}
      className={className}
      referrerPolicy="no-referrer"
      onError={() => setFallbackIndex((i) => i + 1)}
    />
  );
};

// Simple preview fetcher using AllOrigins (matching reference implementation)
const fetchLinkPreview = async (targetUrl: string) => {
  const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`;
  try {
    const response = await fetch(proxyUrl);
    const data = await response.json();
    const html = data?.contents;
    if (!html) {
      return null;
    }
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const getAttr = (sel: string, attr = 'content') => doc.querySelector(sel)?.getAttribute(attr) || '';
    const pickFirst = (sels: string[]): string => {
      for (const s of sels) {
        const v = getAttr(s);
        if (v) return v;
      }
      return '';
    };
    // Try JSON-LD as an additional robust source (headline/name)
    const getJsonLd = (): { headline?: string; name?: string; description?: string; image?: string } => {
      try {
        const scripts = Array.from(doc.querySelectorAll('script[type="application/ld+json"]'));
        const result: { headline?: string; name?: string; description?: string; image?: string } = {};
        const scan = (obj: any) => {
          if (!obj || typeof obj !== 'object') return;
          if (typeof obj.headline === 'string' && !result.headline) result.headline = obj.headline;
          if (typeof obj.name === 'string' && !result.name) result.name = obj.name;
          if (typeof obj.description === 'string' && !result.description) result.description = obj.description;
          if (typeof obj.image === 'string' && !result.image) result.image = obj.image;
          if (Array.isArray(obj)) obj.forEach(scan);
          else Object.values(obj).forEach(scan);
        };
        for (const s of scripts) {
          try {
            const json = JSON.parse(s.textContent || '{}');
            scan(json);
          } catch {}
        }
        return result;
      } catch { return {}; }
    };
    const ld = getJsonLd();
    const title = ((doc.title || '').trim()) || (pickFirst([
      'meta[property="og:title"]',
      'meta[name="twitter:title"]',
      'meta[name="title"]',
      'meta[property="title"]'
    ]) || ld.headline || ld.name || '').trim();
    const description = (pickFirst([
      'meta[property="og:description"]',
      'meta[name="twitter:description"]',
      'meta[name="description"]',
      'meta[property="description"]'
    ]) || ld.description || '').trim();
    let image = pickFirst([
      'meta[property="og:image:secure_url"]',
      'meta[property="og:image"]',
      'meta[name="twitter:image:src"]',
      'meta[name="twitter:image"]',
      'meta[name="image"]',
      'link[rel="image_src"]'
    ]) || ld.image || '';
    // Last-resort: use first H1 if no title
    let h1 = '';
    try { h1 = (doc.querySelector('h1')?.textContent || '').trim(); } catch {}
    const finalTitle = (title || h1 || '').trim();
    if (image && !/^https?:\/\//i.test(image)) {
      try { image = new URL(image, targetUrl).href; } catch {}
    }
    const result = {
      title: finalTitle.substring(0, 100),
      description: description.substring(0, 200),
      image
    };
    return result;
  } catch (error) {
    console.error('[Sources] fetchLinkPreview:error', { targetUrl, error });
    return null;
  }
};

const SourcesDisplay: React.FC<SourcesDisplayProps> = ({ sources, className }) => {
  const [open, setOpen] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [metaMap, setMetaMap] = useState<Record<string, { title?: string; description?: string; image?: string }>>({});
  
  if (!sources || sources.length === 0) return null;

  // Carousel paging: show 3 at a time
  const start = Math.min(currentIdx, Math.max(0, Math.max(0, sources.length - 3)));
  const visible = sources.slice(start, Math.min(start + 3, sources.length));
  const canPrev = start > 0;
  const canNext = start + 3 < sources.length;

  // Batch-fetch metadata for visible cards to ensure title/description render quickly
  React.useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        await Promise.allSettled(
          visible.map(async (src) => {
            const { resolvedUrl, siteUrl, sourceKey } = computeKeys(src);
            if (cancelled) return;
            // Cache first, but only if it has text to avoid image-only partial UI
            const cached = getMetaFromCache(resolvedUrl) || getMetaFromCache(siteUrl) || getMetaFromCache(src.url);
            if (cached && (cached.title || cached.description)) {
              normalizeSetMeta(setMetaMap, src, { resolvedUrl, siteUrl }, { title: cached.title, description: cached.description, image: cached.image });
            }
            if (metaMap[sourceKey]?.title && metaMap[sourceKey]?.description && metaMap[sourceKey]?.image) return;
            const cleaned = (() => { try { return unwrapRedirect(resolvedUrl); } catch { return resolvedUrl; } })();
            const meta = await fetchLinkPreview(cleaned);
            if (cancelled || !meta) return;
            normalizeSetMeta(setMetaMap, src, { resolvedUrl, siteUrl }, { title: meta.title, description: meta.description, image: meta.image });
            // Persist cache under all related keys
            setMetaInCache(resolvedUrl, meta);
            setMetaInCache(siteUrl, meta);
            setMetaInCache(src.url, meta);
          })
        );
      } catch (e) {
        console.error('[Sources] batch_meta:error', e);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [start, visible.map(v => v.url).join('|')]);

  // When the sheet opens, fetch metadata for ALL sources so titles won't be 'Untitled'
  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const run = async () => {
      try {
        await Promise.allSettled(
          sources.map(async (src) => {
            const { resolvedUrl, siteUrl, sourceKey } = computeKeys(src);
            if (cancelled) return;
            if (metaMap[sourceKey]?.title || metaMap[sourceKey]?.description) return;
            const cached = getMetaFromCache(resolvedUrl) || getMetaFromCache(siteUrl) || getMetaFromCache(src.url);
            if (cached && (cached.title || cached.description)) {
              normalizeSetMeta(setMetaMap, src, { resolvedUrl, siteUrl }, { title: cached.title, description: cached.description, image: cached.image });
              return;
            }
            const cleaned = (() => { try { return unwrapRedirect(resolvedUrl); } catch { return resolvedUrl; } })();
            const meta = await fetchLinkPreview(cleaned);
            if (!cancelled && meta) {
              normalizeSetMeta(setMetaMap, src, { resolvedUrl, siteUrl }, { title: meta.title, description: meta.description, image: meta.image });
              setMetaInCache(resolvedUrl, meta);
              setMetaInCache(siteUrl, meta);
              setMetaInCache(src.url, meta);
            }
          })
        );
      } catch (e) {
        console.error('[Sources] sheet_meta:error', e);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [open, sources.map(s => s.url).join('|')]);

  // Prefetch metadata for ALL sources when list changes, so cards can render atomically
  React.useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        await Promise.allSettled(
          sources.map(async (src) => {
            const { resolvedUrl, siteUrl, sourceKey } = computeKeys(src);
            if (cancelled) return;
            if (metaMap[sourceKey]?.title || metaMap[sourceKey]?.description) return;
            const cached = getMetaFromCache(resolvedUrl) || getMetaFromCache(siteUrl) || getMetaFromCache(src.url);
            if (cached && (cached.title || cached.description)) {
              normalizeSetMeta(setMetaMap, src, { resolvedUrl, siteUrl }, { title: cached.title, description: cached.description, image: cached.image });
              return;
            }
            const cleaned = (() => { try { return unwrapRedirect(resolvedUrl); } catch { return resolvedUrl; } })();
            const meta = await fetchLinkPreview(cleaned);
            if (!cancelled && meta) {
              normalizeSetMeta(setMetaMap, src, { resolvedUrl, siteUrl }, { title: meta.title, description: meta.description, image: meta.image });
              setMetaInCache(resolvedUrl, meta);
              setMetaInCache(siteUrl, meta);
              setMetaInCache(src.url, meta);
            }
          })
        );
      } catch (e) {
        console.error('[Sources] prefetch_meta:error', e);
      }
    };
    if (sources && sources.length) run();
    return () => { cancelled = true; };
  }, [sources.map(s => s.url).join('|')]);

  return (
    <div className={className || ''}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Sources • {sources.length}</span>
        </div>
        <div className="flex items-center gap-2">
          {sources.length > 3 && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                disabled={!canPrev}
                onClick={() => setCurrentIdx((i) => Math.max(0, i - 3))}
                aria-label="Previous sources"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                disabled={!canNext}
                onClick={() => setCurrentIdx((i) => Math.min(sources.length - 1, i + 3))}
                aria-label="Next sources"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          )}
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-xs text-muted-foreground hover:text-foreground p-0 h-auto"
            onClick={() => setOpen(true)}
          >
            View All
            <ChevronRight className="ml-1 h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Sources Carousel - show 3 preview cards */}
      <div className={`grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 transition-all duration-300`}>
        {visible.map((source, index) => {
          const { resolvedUrl, siteUrl, sourceKey } = computeKeys(source);
          const domainLabel = domainFrom(source, resolvedUrl) || 'Source';
          const metaNorm = normalizeGetMeta(metaMap, source, { resolvedUrl, siteUrl, sourceKey });
          
          // Extract proper website name from domain
          const getWebsiteName = (domain: string) => {
            // Check if domain looks like random characters (redirect token)
            if (/^[A-Z0-9_-]{10,}$/i.test(domain) || domain === 'Source') {
              // Try to extract from title first
              if (source.title && !source.title.includes('://')) {
                const titleDomain = source.title.match(/([a-z0-9-]+(?:\.[a-z0-9-]+)+)/i);
                if (titleDomain) {
                  domain = titleDomain[1];
                } else if (source.title.length < 50) {
                  // Use title if it's short enough to be a site name
                  return source.title;
                }
              }
              // Still random? Show loading state
              if (/^[A-Z0-9_-]{10,}$/i.test(domain)) {
                return 'Loading...';
              }
            }
            
            const cleanDomain = domain.replace(/^www\./i, '').toLowerCase();
            const nameMap: Record<string, string> = {
              'youtube.com': 'YouTube',
              'google.com': 'Google',
              'facebook.com': 'Facebook',
              'twitter.com': 'Twitter',
              'linkedin.com': 'LinkedIn',
              'github.com': 'GitHub',
              'stackoverflow.com': 'Stack Overflow',
              'medium.com': 'Medium',
              'reddit.com': 'Reddit',
              'wikipedia.org': 'Wikipedia',
              'amazon.com': 'Amazon',
              'smartprix.com': 'Smartprix',
              'simplgadgets.com': 'Simpl Gadgets'
            };
            return nameMap[cleanDomain] || cleanDomain.split('.')[0].charAt(0).toUpperCase() + cleanDomain.split('.')[0].slice(1);
          };
          
          const displayName = getWebsiteName(domainLabel);
          
          return (
            <a
              key={sourceKey}
              href={resolvedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block group"
            >
              <div className={`rounded-2xl overflow-hidden bg-card hover:shadow-md transition-all duration-200 transform hover:scale-[1.02]`}>
                {/* Preview area with gradient placeholder and OG image from metaMap */}
                <div className="h-24 sm:h-32 relative overflow-hidden bg-gradient-to-br from-blue-500/10 to-purple-600/10">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-4xl font-bold text-muted-foreground/20">
                      {displayName.slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                  {metaNorm?.image && (metaNorm?.title || metaNorm?.description) && (
                    <img
                      src={metaNorm!.image as string}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      onError={(e) => { console.warn('[Sources] card_image_error', { sourceKey, url: resolvedUrl, image: metaNorm?.image, error: e }); }}
                    />
                  )}
                </div>
                {/* Content area: only show when meta arrives so image+text appear together */}
                {(() => {
                  const meta = metaNorm;
                  const isLoaded = !!(meta?.title || meta?.description);
                  if (!isLoaded) {
                    return (
                      <div className="p-3 bg-background">
                        <div className="space-y-2">
                          <div className="h-3 bg-muted rounded w-24"></div>
                          <div className="h-3 bg-muted rounded w-40"></div>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div className="p-3 bg-background">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                          <Favicon url={siteUrl} className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-medium text-sm text-foreground">{displayName}</h4>
                          <p className="text-xs text-muted-foreground truncate">
                            {(meta.title && !looksLikeToken(meta.title))
                              ? meta.title.substring(0, 100)
                              : meta.description?.substring(0, 100)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </a>
          );
        })}
      </div>

      {/* Right-side sheet for full list (no images, just favicon + text) */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Sources</SheetTitle>
          </SheetHeader>
          <div className="mt-4 max-h-[80vh] overflow-y-auto pr-2 divide-y divide-border">
            {sources.map((source) => {
              const { resolvedUrl, siteUrl, sourceKey } = computeKeys(source);
              const domainLabel = domainFrom(source, resolvedUrl) || 'Source';
              const metaNorm = normalizeGetMeta(metaMap, source, { resolvedUrl, siteUrl, sourceKey })
                || getMetaFromCache(resolvedUrl)
                || getMetaFromCache(siteUrl)
                || getMetaFromCache(source.url);
              const displayName = (() => {
                const d = domainLabel.replace(/^www\./i, '').toLowerCase();
                const map: Record<string, string> = {
                  'youtube.com': 'YouTube',
                  'google.com': 'Google',
                  'facebook.com': 'Facebook',
                  'twitter.com': 'Twitter',
                  'linkedin.com': 'LinkedIn',
                  'github.com': 'GitHub',
                  'stackoverflow.com': 'Stack Overflow',
                  'medium.com': 'Medium',
                  'reddit.com': 'Reddit',
                  'wikipedia.org': 'Wikipedia',
                  'amazon.com': 'Amazon',
                };
                return map[d] || d.split('.')[0].charAt(0).toUpperCase() + d.split('.')[0].slice(1);
              })();
              // Build title with robust fallbacks similar to the card
              const titleText = (() => {
                const t1 = metaNorm?.title;
                const d1 = metaNorm?.description;
                const t2 = source.title;
                const isDomainLike = (s?: string) => !!s && /^(?:[a-z0-9-]+\.)+[a-z]{2,}$/i.test(String(s).trim());
                if (t1 && !looksLikeToken(t1)) return t1.substring(0, 120);
                if (d1 && !looksLikeToken(d1)) return d1.substring(0, 120);
                if (t2 && !looksLikeToken(t2) && !isDomainLike(t2)) return t2.substring(0, 120);
                try {
                  const u = new URL(resolvedUrl);
                  const last = decodeURIComponent(u.pathname.replace(/^\//,'')).split('/').pop() || '';
                  const nice = last.replace(/[-_]/g,' ').trim();
                  if (nice && !looksLikeToken(nice)) return nice.substring(0, 120);
                } catch {}
                return 'Loading…';
              })();
              const snippetText = (() => {
                const d = metaNorm?.description;
                const s = source.snippet;
                if (d && !looksLikeToken(d)) return d;
                if (s && !looksLikeToken(s)) return s;
                return '';
              })();
              return (
                <a
                  key={sourceKey}
                  href={resolvedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block hover:bg-accent/40 transition-colors p-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                      <Favicon url={siteUrl} className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-foreground leading-tight">{displayName}</div>
                      <div className="text-xs text-muted-foreground">{displayFromUrl(siteUrl)}</div>
                      <div className="text-[15px] font-semibold text-foreground mt-2 leading-snug line-clamp-2">{titleText}</div>
                      {snippetText && (
                        <div className="text-xs text-muted-foreground mt-1 leading-snug line-clamp-2">{snippetText}</div>
                      )}
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default SourcesDisplay;