import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { firestore } from '@/lib/firebase';
import { Loader2, ArrowLeft, ExternalLink, Layers, Clock } from 'lucide-react';
import { languageStore } from '@/lib/languageStore';
import { LanguageSelector } from '@/components/ui/language-selector';
import type { PulseArticle } from './Pulse';
import { format } from 'date-fns';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { SourcesList } from '@/components/Pulse/SourcesList';
import { usePulseTranslations } from '@/hooks/usePulseTranslations';
import { Button } from '@/components/ui/button';
import { useImageFallback } from '@/hooks/useImageFallback';

// Helper function to render article with inline citations
function renderArticleWithCitations(text: string, urls: (string | undefined)[]) {
  // Replace [1], [2], etc. with clickable superscript links
  const parts = text.split(/(\[\d+\])/g);
  
  return (
    <div className="text-base leading-relaxed text-foreground/90 space-y-4">
      {parts.map((part, index) => {
        const match = part.match(/\[(\d+)\]/);
        if (match) {
          const citationNum = parseInt(match[1]);
          const url = urls[citationNum - 1];
          if (url && url !== '#') {
            return (
              <a
                key={index}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-baseline text-primary hover:underline mx-0.5"
                title={`Source ${citationNum}`}
              >
                <sup className="text-xs">[{citationNum}]</sup>
              </a>
            );
          }
          return <sup key={index} className="text-xs text-muted-foreground mx-0.5">[{citationNum}]</sup>;
        }
        // Split by paragraphs
        return part.split('\n\n').map((paragraph, pIndex) => 
          paragraph.trim() ? <p key={`${index}-${pIndex}`}>{paragraph}</p> : null
        );
      })}
    </div>
  );
}

export default function PulseArticlePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  // Try to load from cache first
  const getCachedArticle = () => {
    try {
      const cached = sessionStorage.getItem(`pulse_article_${id}`);
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  };
  
  const [article, setArticle] = React.useState<PulseArticle | null>(getCachedArticle);
  const [loading, setLoading] = React.useState(!getCachedArticle());
  const [error, setError] = React.useState<string | null>(null);
  const [expandedCitations, setExpandedCitations] = React.useState<Record<number, boolean>>({});
  const [imageDialogOpen, setImageDialogOpen] = React.useState(false);
  const { translatedArticles } = usePulseTranslations(article ? [article] : []);
  
  // Image fallback handling (try source URLs if main image missing)
  const { imageUrl: displayImage, handleImageError } = useImageFallback(article?.imageUrl, article?.urls);

  React.useEffect(() => {
    (async () => {
      try {
        if (!id) throw new Error('missing id');
        const ref = doc(firestore, 'pulse_articles', id);
        const snap = await getDoc(ref);
        if (!snap.exists()) throw new Error('Article not found');
        const articleData = { id: snap.id, ...(snap.data() as any) };
        setArticle(articleData);
        // Cache for instant loading next time
        try {
          sessionStorage.setItem(`pulse_article_${id}`, JSON.stringify(articleData));
        } catch {}
      } catch (e: any) {
        setError(e.message || String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // React 19: No useMemo needed - React Compiler optimizes automatically
  const faviconUrl = (domain?: string) => domain ? `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(domain)}` : undefined;
  const arr = Array.isArray(article?.sources) && article.sources.length > 0 ? article.sources : (article?.source ? [article.source] : []);
  const domains = article ? Array.from(new Set(arr.filter(Boolean))) : [];
  const topDomains = domains.slice(0, 4);
  
  // Helper to convert domain to readable site name
  const getSiteName = (domain: string) => {
    const cleanDomain = domain.replace(/^www\./i, '').toLowerCase();
    const nameMap: Record<string, string> = {
      'theguardian.com': 'The Guardian',
      'bbc.com': 'BBC',
      'bbc.co.uk': 'BBC',
      'cnn.com': 'CNN',
      'nytimes.com': 'The New York Times',
      'reuters.com': 'Reuters',
      'apnews.com': 'AP News',
      'bloomberg.com': 'Bloomberg',
      'wsj.com': 'The Wall Street Journal',
      'forbes.com': 'Forbes',
      'techcrunch.com': 'TechCrunch',
      'theverge.com': 'The Verge',
      'wired.com': 'WIRED',
      'arstechnica.com': 'Ars Technica',
      'mashable.com': 'Mashable',
      'engadget.com': 'Engadget',
      'cnet.com': 'CNET',
      'zdnet.com': 'ZDNet',
      'yahoo.com': 'Yahoo',
      'msn.com': 'MSN',
      'abc.net.au': 'ABC News',
      'usatoday.com': 'USA Today',
      'cbsnews.com': 'CBS News',
      'nbcnews.com': 'NBC News',
      'foxnews.com': 'Fox News',
      'wikipedia.org': 'Wikipedia',
      'medium.com': 'Medium',
      'reddit.com': 'Reddit',
      'youtube.com': 'YouTube',
      'twitter.com': 'Twitter',
      'facebook.com': 'Facebook',
      'linkedin.com': 'LinkedIn',
      'github.com': 'GitHub',
      'stackoverflow.com': 'Stack Overflow',
      'nhm.ac.uk': 'Natural History Museum',
      'scitechdaily.com': 'SciTechDaily',
      'ipcc.ch': 'IPCC',
      'news.mongabay.com': 'Mongabay',
      'timesofindia.indiatimes.com': 'Times of India',
      'indianexpress.com': 'Indian Express',
      'hindustantimes.com': 'Hindustan Times',
      'ndtv.com': 'NDTV',
      'thehindu.com': 'The Hindu'
    };
    return nameMap[cleanDomain] || cleanDomain.split('.')[0].charAt(0).toUpperCase() + cleanDomain.split('.')[0].slice(1);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="oj-loader" aria-label="Loading article" role="status" />
        <style>{`
          .oj-loader{width:60px;display:flex;align-items:flex-start;aspect-ratio:1}
          .oj-loader:before,.oj-loader:after{content:"";flex:1;aspect-ratio:1;--g:conic-gradient(from -90deg at 10px 10px,hsl(var(--primary)) 90deg,#0000 0);background:var(--g),var(--g),var(--g);filter:drop-shadow(30px 30px 0 hsl(var(--primary)));animation:l20 1s infinite}
          .oj-loader:after{transform:scaleX(-1)}
          @keyframes l20{0%{background-position:0 0,10px 10px,20px 20px}33%{background-position:10px 10px}66%{background-position:0 20px,10px 10px,20px 0}100%{background-position:0 0,10px 10px,20px 20px}}
        `}</style>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="min-h-screen">
        <div className="sticky top-0 z-10 bg-background border-b">
          <div className="pl-4 py-2">
            <button
              onClick={() => navigate('/pulse')}
              className="text-base font-normal text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Back to Pulse"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          </div>
        </div>
        <LanguageSelector />
        <div className="max-w-4xl mx-auto px-4 py-10">
          <p className="text-sm text-destructive">{error || 'Article not found'}</p>
        </div>
      </div>
    );
  }

  const published = article.publishedAt ? format(new Date(article.publishedAt), 'PPpp') : undefined;
  
  // Get translated content
  const translated = article ? translatedArticles[article.id] : undefined;
  const displayTitle = translated?.title || article.title;
  const displayIntroduction = (translated as any)?.introduction || (article as any).introduction;
  const displaySections = (translated as any)?.sections || (article as any).sections;
  const displaySummary = translated?.summary || article.summary;
  const displayKeyPoints = (translated as any)?.keyPoints || (article as any).keyPoints;

  return (
    <>
      {/* React 19: Native document metadata */}
      <title>{displayTitle} | Ojas Pulse</title>
      <meta name="description" content={displayIntroduction || article.summary || displayTitle} />
      
      <div className="min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="pl-4 py-2">
          <button
            onClick={() => navigate('/pulse')}
            className="text-base font-normal text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Back to Pulse"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Language Selector */}
      <LanguageSelector />

      {/* Body */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Title */}
        <h1 className="text-2xl font-semibold leading-tight mb-3">{displayTitle}</h1>
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mb-4">
          {published && (<span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{published}</span>)}
        </div>

        {/* Image with subtle zoom and click to enlarge */}
        {displayImage && (
          <div className="mb-5 overflow-hidden rounded-xl relative group cursor-pointer" onClick={() => setImageDialogOpen(true)}>
            <img 
              src={displayImage} 
              alt={article.title} 
              className="w-full max-h-[400px] object-cover transition-transform duration-300 group-hover:scale-[1.01]" 
              onError={handleImageError} 
            />
            {/* Image attribution (bottom-right) */}
            {article.urls && article.urls[0] && (
              <a
                href={article.urls[0]}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="absolute bottom-2 right-2 px-2 py-1 bg-black/70 backdrop-blur-sm text-white text-xs rounded hover:bg-black/90 transition-colors"
              >
                {article.sources?.[0] || 'Source'}
              </a>
            )}
          </div>
        )}
        
        {/* Image Dialog (full view - no border, responsive sizing, custom close button) */}
        <Dialog open={imageDialogOpen} onOpenChange={setImageDialogOpen}>
          <DialogContent className="max-w-[95vw] max-h-[95vh] w-fit h-fit p-0 border-0 shadow-2xl bg-transparent overflow-visible [&>button]:hidden">
            <div className="relative rounded-2xl overflow-hidden bg-background shadow-2xl flex items-center justify-center">
              {/* Custom Close Button - Gray Circle */}
              <button
                onClick={() => setImageDialogOpen(false)}
                className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-sm flex items-center justify-center transition-colors text-white"
                aria-label="Close"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
              {/* Image with proper constraints - shows full image */}
              <img 
                src={displayImage!} 
                alt={article.title} 
                className="max-w-[92vw] max-h-[92vh] w-auto h-auto rounded-2xl block"
                style={{ objectFit: 'contain' }}
                onError={handleImageError}
              />
            </div>
          </DialogContent>
        </Dialog>

        {/* Introduction */}
        {displayIntroduction && (
          <p className="text-lg leading-relaxed mb-6 text-foreground/90 font-light">{displayIntroduction}</p>
        )}

        {/* Article Content with Citations */}
        {displaySummary && (
          <div className="prose prose-base max-w-none mb-8">
            {renderArticleWithCitations(displaySummary, article.urls || [article.url])}
          </div>
        )}
        
        {/* Sections with Citations */}
        {Array.isArray(displaySections) && displaySections.length > 0 && (
          <div className="space-y-6 mb-8">
            {displaySections.map((section: any, i: number) => (
              <div key={i}>
                {section.heading && (
                  <h2 className="text-lg font-semibold mb-3 text-foreground">{section.heading}</h2>
                )}
                {/* New structure: sentences array with sourceRefs */}
                {section.sentences && Array.isArray(section.sentences) && section.sentences.length > 0 && (
                  <div className="text-base leading-relaxed text-foreground/90 space-y-3">
                    {section.sentences.map((sentence: any, j: number) => {
                      const sentenceKey = `${i}-${j}`;
                      return (
                        <p key={j} className="leading-relaxed relative inline-block">
                          {sentence.text}
                          {sentence.sourceRefs && sentence.sourceRefs.length > 0 && (
                            <span className="ml-1 relative group/citation inline-block">
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-muted text-muted-foreground text-xs font-medium cursor-pointer transition-colors group-hover/citation:bg-primary group-hover/citation:text-primary-foreground">
                                {getSiteName(article.sources?.[sentence.sourceRefs[0] - 1] || '')}
                                {sentence.sourceRefs.length > 1 && ` +${sentence.sourceRefs.length - 1}`}
                              </span>
                              {/* Hover Popup with delay - solid background */}
                              <div className="invisible group-hover/citation:visible opacity-0 group-hover/citation:opacity-100 transition-all duration-200 group-hover/citation:delay-0 delay-300 absolute bottom-full left-0 mb-2 z-50 hover:!visible hover:!opacity-100">
                                <div className="bg-background border border-border rounded-lg shadow-xl p-2 min-w-[200px] max-w-[300px]">
                                  <div className="text-xs font-medium mb-1 text-muted-foreground">Sources • {sentence.sourceRefs.length}</div>
                                  <div className="space-y-1">
                                    {sentence.sourceRefs.map((refIdx: number, idx: number) => (
                                      <a
                                        key={idx}
                                        href={article.urls?.[refIdx - 1]}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 text-sm hover:bg-accent/80 p-1.5 rounded transition-colors block"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <div className="h-4 w-4 rounded-full overflow-hidden bg-white flex-shrink-0">
                                          <img src={faviconUrl(article.sources?.[refIdx - 1])} alt="" className="w-full h-full object-cover" />
                                        </div>
                                        <span className="truncate flex-1">{getSiteName(article.sources?.[refIdx - 1] || '')}</span>
                                      </a>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </span>
                          )}
                        </p>
                      );
                    })}
                  </div>
                )}
                {/* Legacy: Old structure with content string */}
                {!section.sentences && section.content && (
                  <div className="text-base leading-relaxed text-foreground/80 space-y-3">
                    {section.content.split('\n\n').map((paragraph: string, j: number) => (
                      <p key={j}>{paragraph}</p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Legacy: Only show if no summary (old articles) */}
        {!displaySummary && Array.isArray(displayKeyPoints) && displayKeyPoints.length > 0 && (
          <div className="mb-6">
            <div className="text-sm font-medium mb-2">Key points</div>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              {displayKeyPoints.map((x, i) => <li key={i}>{x}</li>)}
            </ul>
          </div>
        )}

        {/* Tags */}
        {article.tags?.length ? (
          <div className="flex flex-wrap gap-2 mb-6">
            {article.tags.map((t) => (
              <span key={t} className="px-2.5 py-1 rounded-full bg-muted text-xs">{t.replace(/-/g, ' ')}</span>
            ))}
          </div>
        ) : null}

        {/* Sources (Sheet with preview cards like SourcesDisplay) */}
        {domains.length > 0 && (
          <div className="mt-4">
            <div className="text-sm font-medium mb-2">Sources</div>
            <Sheet>
              <SheetTrigger asChild>
                <button className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                  <span className="flex -space-x-1">
                    {topDomains.map((d, i) => (
                      <div key={`${d}-${i}`} className="h-5 w-5 rounded-full ring-1 ring-white dark:ring-gray-900 overflow-hidden bg-white">
                        <img src={faviconUrl(d)} alt={d} className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </span>
                  <span className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                    View all {domains.length} sources
                  </span>
                </button>
              </SheetTrigger>
              <SheetContent side="right" className="sm:max-w-md">
                <SheetHeader>
                  <SheetTitle>All Sources</SheetTitle>
                </SheetHeader>
                <div className="mt-4 max-h-[80vh] overflow-y-auto pr-2">
                  <SourcesList
                    sources={(article.urls && article.sources ? article.sources.map((d, i) => ({ domain: d, url: article.urls![i] || article.url, title: article.title })) : [{ domain: article.source, url: article.url, title: article.title }]).filter(x => !!x.url)}
                    getSiteName={getSiteName}
                    faviconUrl={faviconUrl}
                  />
                </div>
              </SheetContent>
            </Sheet>
          </div>
        )}
      </div>
    </div>
    </>
  );
}
