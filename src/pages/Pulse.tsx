import React, { useEffect, useRef, useState } from "react";
import { collection, getDocs, limit, orderBy, query, startAfter, where, DocumentSnapshot } from "firebase/firestore";
import { firestore } from "@/lib/firebase";
import { Loader2 } from "lucide-react";
import PulseCard from "@/components/Pulse/PulseCard";
import PulseFilters from "@/components/Pulse/PulseFilters";
import { useNavigate } from "react-router-dom";
import { languageStore } from "@/lib/languageStore";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { GLOBAL_LANGUAGES, INDIAN_LANGUAGES } from "@/lib/languages";
export interface PulseArticle {
  id: string;
  title: string;
  summary: string;
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

const PAGE_SIZE = 20;

const Pulse: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [articles, setArticles] = useState<PulseArticle[]>([]);
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const navigate = useNavigate();
  const lang = languageStore.get();
  const [langCode, setLangCode] = React.useState(lang.code);

  React.useEffect(() => {
    const unsub = languageStore.subscribe((l) => setLangCode(l.code));
    return () => unsub();
  }, []);

  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    fetchArticles(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTags.join(",")]);

  const fetchArticles = async (isInitial = false) => {
    if (isInitial) {
      setLoading(true);
      setArticles([]);
      setLastDoc(null);
      setHasMore(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const col = collection(firestore, "pulse_articles");
      
      // Build query: if filtering by tags, use array-contains-any (up to 10 tags); otherwise simple orderBy
      let q;
      if (selectedTags.length > 0) {
        // Firestore array-contains-any supports max 10 values
        const tagsToQuery = selectedTags.slice(0, 10);
        q = query(col, where("tags", "array-contains-any", tagsToQuery), orderBy("publishedAt", "desc"), limit(PAGE_SIZE));
      } else {
        q = query(col, orderBy("publishedAt", "desc"), limit(PAGE_SIZE));
      }
      
      if (lastDoc && !isInitial) {
        q = query(q, startAfter(lastDoc));
      }

      const snap = await getDocs(q);
      if (snap.empty) {
        setHasMore(false);
        if (isInitial) setArticles([]);
        return;
      }

      const newItems: PulseArticle[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      setArticles((prev) => (isInitial ? newItems : [...prev, ...newItems]));
      setLastDoc(snap.docs[snap.docs.length - 1]);
      setHasMore(snap.docs.length === PAGE_SIZE);
      // Update available tags dynamically from loaded items
      const tagSet = new Set<string>(isInitial ? [] : availableTags);
      for (const a of newItems) {
        (a.tags || []).forEach(t => tagSet.add(t));
      }
      setAvailableTags(Array.from(tagSet));
    } catch (e: any) {
      console.error("Pulse fetch error", e);
      // If Firestore index missing, show helpful message
      if (e?.code === 'failed-precondition' || e?.message?.includes('index')) {
        console.warn('Firestore index required. Create index for collection: pulse_articles, fields: tags (array-contains-any), publishedAt (desc)');
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    if (!loadMoreRef.current) return;
    observerRef.current?.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !loadingMore) {
          fetchArticles(false);
        }
      },
      { threshold: 0.6 }
    );

    observerRef.current.observe(loadMoreRef.current);
    return () => observerRef.current?.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadMoreRef.current, hasMore, loadingMore, lastDoc]);

  // React 19: No useMemo needed - React Compiler optimizes automatically
  const hero = articles[0];
  const rest = articles.slice(1);
  const arr = Array.isArray(hero?.sources) && hero.sources!.length > 0 ? hero!.sources! : (hero?.source ? [hero.source] : []);
  const heroDomains = Array.from(new Set(arr.filter(Boolean))).slice(0, 6);
  const faviconUrl = (domain?: string) => domain ? `https://www.google.com/s2/favicons?sz=32&domain=${encodeURIComponent(domain)}` : undefined;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      {/* React 19: Native document metadata */}
      <title>Pulse - Latest Health & Tech News | Ojas</title>
      <meta name="description" content="Stay updated with the latest health, technology, science, and business news. Autonomous AI-powered news discovery with comprehensive articles." />
      
      <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Ojas Pulse</h1>
            <p className="text-sm text-muted-foreground mt-1">Trusted health news, personalized for you</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="h-10 w-10 rounded-full font-semibold shadow-md border border-border bg-background hover:bg-muted"
                aria-label={`Change language`}
              >
                {([...GLOBAL_LANGUAGES, ...INDIAN_LANGUAGES].find(l => l.code === langCode)?.label || 'EN').charAt(0)}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 max-h-56 overflow-y-auto bg-background">
              {[...GLOBAL_LANGUAGES, ...INDIAN_LANGUAGES].filter((l, i, arr) => arr.findIndex(x => x.code === l.code) === i).map((l) => (
                <DropdownMenuItem key={l.code} onClick={() => languageStore.set(l.code)}>
                  <span className="mr-2 w-4 inline-block text-primary">{langCode === l.code ? '✓' : ''}</span>
                  <span>{l.label}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Hero + Side rail */}
      {hero && (
        <div className="max-w-4xl mx-auto px-4 pt-6">
          <div className="rounded-2xl border bg-card p-6 shadow-sm cursor-pointer" onClick={() => navigate(`/pulse/${hero.id}`)}>
            <div className="text-xs text-muted-foreground mb-2">Popular Story</div>
            <h2 className="text-2xl md:text-3xl font-semibold leading-tight mb-3">{hero.title}</h2>
            <p className="text-muted-foreground mb-4 leading-relaxed line-clamp-4">{hero.summary}</p>
            <div className="flex items-center justify-between">
              <a href={hero.url} target="_blank" rel="noopener noreferrer" className="text-primary font-medium hover:underline" onClick={(e)=> e.stopPropagation()}>
                Read original
              </a>
              <div className="text-xs text-muted-foreground inline-flex items-center gap-2">
                <span className="flex -space-x-1">
                  {heroDomains.map((d, i) => (
                    <img key={`${d}-${i}`} src={faviconUrl(d)} alt={d} className="h-4 w-4 rounded ring-1 ring-white dark:ring-gray-900" />
                  ))}
                </span>
                <span>{Array.isArray(hero.sources) && hero.sources.length ? `${hero.sources.length} sources` : (hero.source || '')}</span>
              </div>
            </div>
          </div>
          {/* Side rail top picks */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {rest.slice(0, 3).map((a) => (
              <PulseCard key={a.id} article={a} />
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="max-w-4xl mx-auto px-4 py-4">
        <PulseFilters selectedTags={selectedTags} onTagsChange={setSelectedTags} tags={availableTags} />
      </div>

      {/* Feed */}
      <div className="max-w-4xl mx-auto px-4 pb-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {rest.slice(3).map((a) => (
          <PulseCard key={a.id} article={a} />
        ))}
      </div>

      {/* Load more trigger */}
      <div ref={loadMoreRef} className="py-8 flex justify-center">
        {loadingMore && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
        {!hasMore && articles.length > 0 && (
          <p className="text-sm text-muted-foreground">You're up to date.</p>
        )}
      </div>
    </div>
    </>
  );
};

export default Pulse;
