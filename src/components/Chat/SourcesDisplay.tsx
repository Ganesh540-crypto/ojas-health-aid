import React, { useMemo, useState } from 'react';
import { Globe, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { db } from '@/lib/firebase';
import { ref, get, set } from 'firebase/database';

export interface Source {
  title: string;
  url: string;
  snippet?: string;
  displayUrl?: string;
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

  const srcs = useMemo(() => {
    const candidates: string[] = [];
    const tryParse = (raw: string): URL | null => {
      const cleaned = unwrapRedirect(raw);
      try { return new URL(cleaned); } catch {
        try { return new URL(`https://${cleaned}`); } catch { return null; }
      }
    };
    const u = tryParse(url);
    if (!u) return candidates;
    const host = u.hostname;
    // Prefer Google S2 first (rarely 404s)
    candidates.push(`https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(u.toString())}`);
    // Site's own /favicon.ico (skip for known redirect hosts)
    if (!isRedirectHost(host)) {
      candidates.push(`${u.origin}/favicon.ico`);
    }
    // DuckDuckGo ip3 as tertiary fallback
    candidates.push(`https://icons.duckduckgo.com/ip3/${host}.ico`);
    return candidates;
  }, [url]);

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

// Global cache to avoid re-fetching previews repeatedly across renders
const previewCache = new Map<string, string>();

// Lightweight website preview image using public providers (no API key)
const PreviewImage: React.FC<{ url: string; className?: string; withOverlay?: boolean; onMeta?: (m: { title?: string; description?: string }) => void; allowScreenshots?: boolean }> = ({ url, className, withOverlay = false, onMeta, allowScreenshots = false }) => {
  const [idx, setIdx] = useState(0);
  const [src, setSrc] = useState<string | null>(null);
  const [title, setTitle] = useState<string | null>(null);

  const providers = useMemo(() => {
    try {
      const cleaned = unwrapRedirect(url);
      const u = new URL(/^https?:\/\//i.test(cleaned) ? cleaned : `https://${cleaned}`);
      const full = u.toString();
      return [
        // thum.io screenshot first (usually faster and no overlay)
        `https://image.thum.io/get/width/800/crop/500/noanimate/${encodeURIComponent(full)}`,
        // WordPress mShots as secondary (may show "Generating Preview")
        `https://s.wordpress.com/mshots/v1/${encodeURIComponent(full)}?w=800`,
      ];
    } catch {
      return [] as string[];
    }
  }, [url]);

  // Try Microlink OG image first (usually instant). If it fails or is slow, fall back to screenshots.
  React.useEffect(() => {
    let cancelled = false;
    setSrc(null);
    setIdx(0);

    // Use cache if available
    const cached = previewCache.get(url);
    const metaCached = getMetaFromCache(url);
    if (metaCached?.image) setSrc(metaCached.image);
    if (metaCached?.title) setTitle(metaCached.title);
    if (cached && !metaCached?.image) { setSrc(cached); }
    // Also try DB cache
    if (!metaCached) {
      (async () => {
        try {
          const snap = await get(ref(db, `previews/${keyFromUrl(url)}`));
          const data = snap.exists() ? snap.val() as any : null;
          if (data && !cancelled) {
            if (data.title) setTitle(String(data.title));
            if (data.image && !src) setSrc(String(data.image));
            setMetaInCache(url, { title: data.title, description: data.description, image: data.image });
          }
        } catch {}
      })();
    }

    const ogFetch = async () => {
      try {
        const r = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(url)}&audio=false&video=false&screenshot=false`);
        const j = await r.json();
        const img = j?.data?.image?.url || j?.data?.logo?.url || null;
        const t = j?.data?.title ? String(j.data.title) : null;
        const d = j?.data?.description ? String(j.data.description) : null;
        if (!cancelled) {
          if (t) setTitle(t);
          if (onMeta) onMeta({ title: t || undefined, description: d || undefined });
          if (img) setSrc(img);
          // persist to caches
          setMetaInCache(url, { title: t || undefined, description: d || undefined, image: img || undefined });
          try { set(ref(db, `previews/${keyFromUrl(url)}`), { title: t || null, description: d || null, image: img || null, ts: Date.now() }); } catch {}
        }
      } catch { /* ignore */ }
    };

    // Optionally allow screenshot fallback
    const fallbackTimer = allowScreenshots ? setTimeout(() => {
      if (!cancelled && !src && providers[0]) setSrc(providers[0]);
    }, 800) : undefined as unknown as number;

    ogFetch();
    return () => { cancelled = true; if (fallbackTimer) clearTimeout(fallbackTimer); };
  }, [url, providers]);

  // When current src errors, try next provider (if we were on providers[0], move to providers[1])
  const handleError = () => {
    // If we were using an OG src, jump to first provider; otherwise iterate providers
    if (src && !providers.includes(src)) {
      setSrc(providers[0] || null);
      setIdx(0);
      return;
    }
    const next = idx + 1;
    if (providers[next]) {
      setIdx(next);
      setSrc(providers[next]);
    } else {
      setSrc(null);
    }
  };

  const finalSrc = src ?? providers[idx];
  React.useEffect(() => { if (finalSrc) previewCache.set(url, finalSrc); }, [finalSrc, url]);
  if (!finalSrc) return null;
  return (
    <>
      <img
        src={finalSrc}
        alt=""
        className={className}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={handleError}
      />
      {withOverlay && title && (
        <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/70 via-black/30 to-transparent text-white text-[12px] leading-tight line-clamp-2 pointer-events-none">
          {title}
        </div>
      )}
    </>
  );
};

const SourcesDisplay: React.FC<SourcesDisplayProps> = ({ sources, className }) => {
  const [showAll, setShowAll] = useState(false);
  const [metaMap, setMetaMap] = useState<Record<string, { title?: string; description?: string }>>({});
  
  if (!sources || sources.length === 0) return null;

  const displayCount = showAll ? sources.length : 2;
  const gridCols = showAll ? 'grid-cols-3' : 'grid-cols-2';

  return (
    <div className={className || ''}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-muted-foreground">Sources • {sources.length}</span>
        {sources.length > 2 && (
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-xs text-muted-foreground hover:text-foreground p-0 h-auto"
            onClick={() => setShowAll(!showAll)}
          >
            {showAll ? 'Show Less' : 'View All'}
            <ChevronRight className={`ml-1 h-3 w-3 transition-transform ${showAll ? 'rotate-90' : ''}`} />
          </Button>
        )}
      </div>

      {/* Sources Grid - Rich preview cards */}
      <div className={`grid ${gridCols} gap-2 sm:gap-3 transition-all duration-300`}>
        {sources.slice(0, displayCount).map((source, index) => {
          const resolvedUrl = resolveDestinationFromSource(source);
          const domainLabel = domainFrom(source, resolvedUrl) || 'Source';
          const siteUrl = preferredSiteUrl(source, resolvedUrl);
          const sourceKey = resolvedUrl || siteUrl || source.url;
          
          // Extract proper website name from domain
          const getWebsiteName = (domain: string) => {
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
                {/* Preview area with real screenshot when available */}
                <div className="h-24 sm:h-32 relative overflow-hidden">
                  {/* Subtle gradient base */}
                  <div className="absolute inset-0 bg-gradient-to-br from-muted/20 to-muted/40" />
                  {/* Initials as placeholder behind image */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-4xl font-bold text-muted-foreground/20">
                      {displayName.slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                  {/* Preview image on top (if loads) - use exact article URL */}
                  <PreviewImage
                    url={resolvedUrl}
                    className="absolute inset-0 w-full h-full object-cover"
                    withOverlay={false}
                    allowScreenshots={false}
                    onMeta={(m) => setMetaMap((prev) => (prev[sourceKey]?.title === m.title && prev[sourceKey]?.description === m.description ? prev : { ...prev, [sourceKey]: m }))}
                  />
                  {/* Small info icon in corner */}
                  <div className="absolute bottom-2 right-2 w-6 h-6 rounded-full bg-black/80 dark:bg-white/80 flex items-center justify-center">
                    <span className="text-white dark:text-black text-xs font-bold">i</span>
                  </div>
                </div>
                {/* Content area */}
                <div className="p-3 bg-background">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                      <Favicon url={siteUrl} className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-medium text-sm text-foreground">{displayName}</h4>
                      {(() => {
                        const metaTitle = metaMap[sourceKey]?.title || source.snippet;
                        if (metaTitle) return <p className="text-xs text-muted-foreground truncate">{metaTitle}</p>;
                        try {
                          const u = new URL(resolvedUrl);
                          const path = decodeURIComponent(u.pathname.replace(/^\//, ''));
                          const nice = path ? path.split('/').pop()!.replace(/[-_]/g,' ').slice(0, 120) : '';
                          return nice ? <p className="text-xs text-muted-foreground truncate">{nice}</p> : null;
                        } catch { return null; }
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
};

export default SourcesDisplay;
