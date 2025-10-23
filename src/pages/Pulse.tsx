import React, { useEffect, useRef, useState } from "react";
import { collection, getDocs, limit, orderBy, query, startAfter, where, DocumentSnapshot } from "firebase/firestore";
import { firestore } from "@/lib/firebase";
import PulseCard from "@/components/Pulse/PulseCard";
import { WeatherWidget } from "@/components/Pulse/WeatherWidget";
import { useNavigate } from "react-router-dom";
import { languageStore } from "@/lib/languageStore";
import { LanguageSelector } from "@/components/ui/language-selector";
import { usePulseTranslations } from "@/hooks/usePulseTranslations";
import { getPulseCache, isPulseCacheFresh, setPulseCache } from "@/lib/pulseCache";
export interface PulseArticle {
  id: string;
  title: string;
  summary: string;
  
  // New structured format (from autonomous synthesis)
  introduction?: string;
  sections?: Array<{ heading: string; content: string }>;
  
  // Legacy format (backward compatibility)
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
  const cache = getPulseCache();
  const fresh = isPulseCacheFresh(cache);
  // Only show loader if we don't have any cached articles
  const [initialLoading, setInitialLoading] = useState(!cache || cache.articles.length === 0);
  const [filterLoading, setFilterLoading] = useState(false); // True when filtering by category
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [articles, setArticles] = useState<PulseArticle[]>(() => cache?.articles || []);
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>(() => cache?.tags || []);
  const [allTagsFromInitialLoad, setAllTagsFromInitialLoad] = useState<string[]>(() => cache?.tags || []);
  const navigate = useNavigate();
  const { translatedArticles } = usePulseTranslations(articles);

  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Initial load: fetch and store all available tags (skip if cache already has them)
  useEffect(() => {
    if (availableTags.length > 0) return;
    const fetchInitialTags = async () => {
      try {
        const col = collection(firestore, "pulse_articles");
        const q = query(col, orderBy("publishedAt", "desc"), limit(50));
        const snap = await getDocs(q);
        const tagSet = new Set<string>();
        snap.docs.forEach((d) => {
          const data = d.data() as any;
          (data.tags || []).forEach((t: string) => tagSet.add(t));
        });
        const sortedTags = Array.from(tagSet).sort();
        setAllTagsFromInitialLoad(sortedTags);
        setAvailableTags(sortedTags);
      } catch (e) {
        console.error("Failed to fetch tags", e);
      }
    };
    fetchInitialTags();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Initial load on mount (skip fetch if we already have articles from cache)
  useEffect(() => {
    // If we already have cached articles, immediately hide loader and skip fetch
    if (articles.length > 0) {
      setInitialLoading(false);
      return;
    }
    
    // Otherwise fetch
    fetchArticles(true, true); // isInitial=true, isFirstLoad=true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refetch when category changes (but not on the first mount)
  const didMountRef = useRef(false);
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return; // skip first run to avoid flicker when we already have cache
    }
    fetchArticles(true, false); // isInitial=true, isFirstLoad=false
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTags.join(",")]);

  const fetchArticles = async (isInitial = false, isFirstLoad = false) => {
    if (isInitial) {
      if (isFirstLoad) {
        // Only show the large loader if we don't already have cached articles
        setInitialLoading(articles.length === 0);
      } else {
        setFilterLoading(true); // Category filter - don't show full loading screen
      }
      setArticles(isFirstLoad ? articles : []);
      setLastDoc(null);
      setHasMore(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const col = collection(firestore, "pulse_articles");
      
      // Always fetch all articles ordered by date (no array-contains-any to avoid index requirement)
      // We'll filter client-side if tags are selected
      const fetchLimit = selectedTags.length > 0 ? PAGE_SIZE * 3 : PAGE_SIZE; // Fetch more if filtering
      let q = query(col, orderBy("publishedAt", "desc"), limit(fetchLimit));
      
      if (lastDoc && !isInitial) {
        q = query(q, startAfter(lastDoc));
      }

      const snap = await getDocs(q);
      if (snap.empty) {
        setHasMore(false);
        if (isInitial) {
          setArticles([]);
        }
        return;
      }

      let newItems: PulseArticle[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      
      // Client-side filtering by tags if needed
      if (selectedTags.length > 0) {
        newItems = newItems.filter((article) => 
          article.tags && article.tags.some((tag) => selectedTags.includes(tag))
        );
        console.log(`Filtered ${newItems.length} articles matching tags:`, selectedTags);
      }
      
      // Debug: Log first article's tags to see format
      if (newItems.length > 0 && isInitial) {
        console.log('Sample article tags:', newItems[0].tags);
        console.log('Available tags in sidebar:', allTagsFromInitialLoad.slice(0, 5));
      }
      
      if (isInitial) {
        // Replace articles completely on initial load or filter change
        setArticles(newItems);
        // Update cache
        try {
          const tagSet = new Set<string>();
          newItems.forEach(a => (a.tags || []).forEach(t => tagSet.add(t)));
          const tags = Array.from(tagSet).sort();
          setPulseCache({ articles: newItems, tags, fetchedAt: Date.now() });
          if (tags.length) {
            setAvailableTags(tags);
            setAllTagsFromInitialLoad(tags);
          }
        } catch {}
      } else {
        // Append for infinite scroll (avoid duplicates)
        setArticles((prev) => {
          const existingIds = new Set(prev.map(a => a.id));
          const uniqueNew = newItems.filter(item => !existingIds.has(item.id));
          const updated = [...prev, ...uniqueNew];
          try {
            const tagSet = new Set<string>();
            updated.forEach(a => (a.tags || []).forEach(t => tagSet.add(t)));
            const tags = Array.from(tagSet).sort();
            setPulseCache({ articles: updated, tags, fetchedAt: Date.now() });
          } catch {}
          return updated;
        });
      }
      
      setLastDoc(snap.docs[snap.docs.length - 1]);
      setHasMore(snap.docs.length === fetchLimit);
    } catch (e: any) {
      console.error("Pulse fetch error", e);
    } finally {
      setInitialLoading(false);
      setFilterLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    if (!loadMoreRef.current) return;
    observerRef.current?.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !loadingMore) {
          // Add small delay for bounce effect
          setTimeout(() => {
            if (hasMore && !loadingMore) {
              fetchArticles(false);
            }
          }, 300);
        }
      },
      { threshold: 0.8, rootMargin: '100px' }
    );

    observerRef.current.observe(loadMoreRef.current);
    return () => observerRef.current?.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadMoreRef.current, hasMore, loadingMore, lastDoc]);

  // Only show full loading screen on initial mount when there's truly no data yet
  if (initialLoading && articles.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="oj-loader" aria-label="Loading" role="status" />
        <style>{`
          .oj-loader{width:60px;display:flex;align-items:flex-start;aspect-ratio:1}
          .oj-loader:before,.oj-loader:after{content:"";flex:1;aspect-ratio:1;--g:conic-gradient(from -90deg at 10px 10px,hsl(var(--primary)) 90deg,#0000 0);background:var(--g),var(--g),var(--g);filter:drop-shadow(30px 30px 0 hsl(var(--primary)));animation:l20 1s infinite}
          .oj-loader:after{transform:scaleX(-1)}
          @keyframes l20{0%{background-position:0 0,10px 10px,20px 20px}33%{background-position:10px 10px}66%{background-position:0 20px,10px 10px,20px 0}100%{background-position:0 0,10px 10px,20px 20px}}
        `}</style>
      </div>
    );
  }

  return (
    <>
      {/* React 19: Native document metadata */}
      <title>Pulse - Latest Health & Tech News | Ojas</title>
      <meta name="description" content="Stay updated with the latest health, technology, science, and business news. Autonomous AI-powered news discovery with comprehensive articles." />
      
      <div className="flex flex-col h-screen bg-background">
      {/* Header - Minimal */}
      <div className="sticky top-0 z-50 bg-background border-b">
        <div className="pl-4 py-2">
          <h1 className="text-base font-normal text-muted-foreground">Ojas Pulse</h1>
        </div>
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto">
        {/* Language Selector */}
        <LanguageSelector />

        {/* Main Content with Sidebar */}
        <div className="max-w-7xl mx-auto px-6 pt-8 pb-10">
        <div className="flex gap-8">
          {/* Left: Articles */}
          <div className="flex-1 min-w-0">
            {/* All articles in alternating layout */}
            {filterLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Skeleton loading cards */}
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="rounded-lg border bg-card p-4 animate-pulse">
                    <div className="h-4 bg-muted rounded w-3/4 mb-3"></div>
                    <div className="h-3 bg-muted rounded w-full mb-2"></div>
                    <div className="h-3 bg-muted rounded w-5/6"></div>
                  </div>
                ))}
              </div>
            ) : articles.length === 0 && !initialLoading ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-2">No articles found</p>
                {selectedTags.length > 0 && (
                  <button
                    onClick={() => setSelectedTags([])}
                    className="text-sm text-primary hover:underline"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                {(() => {
                  const elements: JSX.Element[] = [];
                  let i = 0;
                  let largeCardCount = 0;
                  
                  while (i < articles.length) {
                    // Add large card
                    if (i < articles.length) {
                      const imagePosition = largeCardCount % 2 === 0 ? 'right' : 'left';
                      elements.push(
                        <PulseCard 
                          key={articles[i].id} 
                          article={articles[i]} 
                          translated={translatedArticles[articles[i].id]}
                          size="large"
                          imagePosition={imagePosition}
                          index={i}
                        />
                      );
                      i++;
                      largeCardCount++;
                    }
                    
                    // Add row of 3 small cards
                    const smallCardsInRow = articles.slice(i, i + 3);
                    if (smallCardsInRow.length > 0) {
                      elements.push(
                        <div key={`small-row-${i}`} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {smallCardsInRow.map((a, localIndex) => (
                            <PulseCard 
                              key={a.id} 
                              article={a} 
                              translated={translatedArticles[a.id]}
                              size="small"
                              index={i + localIndex}
                            />
                          ))}
                        </div>
                      );
                      i += 3;
                    }
                  }
                  
                  return elements;
                })()}
              </div>
            )}
          </div>

          {/* Right: Sidebar */}
          <div className="hidden lg:block w-80 flex-shrink-0 space-y-4">
            {/* Category Filters */}
            <div className="bg-card border rounded-lg p-4">
              <h3 className="text-sm font-medium mb-3">Customize your feed</h3>
              <div className="flex flex-wrap gap-2">
                {initialLoading ? (
                  <div className="text-xs text-muted-foreground">Loading categories...</div>
                ) : availableTags.length > 0 ? (
                  availableTags.slice(0, 10).map((tag) => (
                    <button
                      key={tag}
                      onClick={() => {
                        if (selectedTags.includes(tag)) {
                          setSelectedTags(selectedTags.filter((t) => t !== tag));
                        } else {
                          setSelectedTags([...selectedTags, tag]);
                        }
                      }}
                      className={`px-3 py-1.5 rounded-full text-xs transition-colors ${
                        selectedTags.includes(tag)
                          ? 'bg-primary text-white'
                          : 'bg-muted hover:bg-muted/80'
                      }`}
                    >
                      {tag.replace(/-/g, ' ')}
                    </button>
                  ))
                ) : (
                  <div className="text-xs text-muted-foreground">No categories available</div>
                )}
              </div>
            </div>

            {/* Weather Widget */}
            <WeatherWidget />
          </div>
        </div>

        {/* Load more trigger - Hidden */}
        <div ref={loadMoreRef} className="py-8 flex justify-center">
          {!hasMore && articles.length > 0 && (
            <p className="text-sm text-muted-foreground">You're all caught up! ✨</p>
          )}
        </div>
      </div>
    </div>
    </div>
    </>
  );
};

export default Pulse;
