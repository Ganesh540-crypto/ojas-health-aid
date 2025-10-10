import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { firestore } from '@/lib/firebase';
import { Loader2, ArrowLeft, ExternalLink, Layers, Clock } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { GLOBAL_LANGUAGES, INDIAN_LANGUAGES } from '@/lib/languages';
import { languageStore } from '@/lib/languageStore';
import type { PulseArticle } from './Pulse';
import { format } from 'date-fns';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';

export default function PulseArticlePage() {
  const { id } = useParams<{ id: string }>();
  const [article, setArticle] = React.useState<PulseArticle | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const lang = languageStore.get();
  const [langCode, setLangCode] = React.useState(lang.code);

  React.useEffect(() => {
    const unsub = languageStore.subscribe((l) => setLangCode(l.code));
    return () => unsub();
  }, []);

  React.useEffect(() => {
    (async () => {
      try {
        if (!id) throw new Error('missing id');
        const ref = doc(firestore, 'pulse_articles', id);
        const snap = await getDoc(ref);
        if (!snap.exists()) throw new Error('Article not found');
        setArticle({ id: snap.id, ...(snap.data() as any) });
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

  if (loading) {
    return (
      <div className="min-h-screen">
        <div className="sticky top-0 z-10 bg-background/95 border-b">
          <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Link to="/pulse" className="inline-flex items-center gap-1 hover:underline"><ArrowLeft className="h-4 w-4" /> Back</Link>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="h-10 w-10 rounded-full font-semibold shadow-md border border-border bg-background hover:bg-muted"
                  aria-label="Change language"
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
        <div className="flex items-center justify-center min-h-[40vh]"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="min-h-screen">
        <div className="sticky top-0 z-10 bg-background/95 border-b">
          <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Link to="/pulse" className="inline-flex items-center gap-1 hover:underline"><ArrowLeft className="h-4 w-4" /> Back</Link>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="h-10 w-10 rounded-full font-semibold shadow-md border border-border bg-background hover:bg-muted"
                  aria-label="Change language"
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
        <div className="max-w-4xl mx-auto px-4 py-10">
          <p className="text-sm text-destructive">{error || 'Article not found'}</p>
        </div>
      </div>
    );
  }

  const published = article.publishedAt ? format(new Date(article.publishedAt), 'PPpp') : undefined;

  return (
    <>
      {/* React 19: Native document metadata */}
      <title>{article.title} | Ojas Pulse</title>
      <meta name="description" content={article.lede || article.summary || article.title} />
      
      <div className="min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <Link to="/pulse" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:underline">
            <ArrowLeft className="h-4 w-4" /> Back to Pulse
          </Link>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Title */}
        <h1 className="text-3xl font-semibold leading-tight mb-3">{article.title}</h1>
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mb-4">
          {published && (<span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{published}</span>)}
          <span className="inline-flex items-center gap-2">
            <Layers className="h-3.5 w-3.5" />
            <span className="flex -space-x-1">
              {domains.slice(0, 8).map((d, i) => (
                <img key={`${d}-${i}`} src={faviconUrl(d)} alt={d} className="h-5 w-5 rounded ring-1 ring-white dark:ring-gray-900" />
              ))}
            </span>
            <span>{Array.isArray(article.sources) && article.sources.length ? `${article.sources.length} sources` : (article.source || '')}</span>
          </span>
        </div>

        {/* Image */}
        {article.imageUrl && (
          <div className="mb-5 overflow-hidden rounded-xl">
            <img src={article.imageUrl} alt={article.title} className="w-full max-h-[400px] object-cover" onError={(e)=>{(e.currentTarget as HTMLImageElement).style.display='none';}} />
          </div>
        )}

        {/* Lede + Paragraphs */}
        {article.lede && <p className="text-base leading-relaxed mb-4 text-foreground">{article.lede}</p>}
        {Array.isArray(article.paragraphs) && article.paragraphs.length > 0 && (
          <div className="space-y-3 mb-6">
            {article.paragraphs.map((p, i) => (
              <p key={i} className="text-base leading-relaxed text-foreground">{p}</p>
            ))}
          </div>
        )}

        {/* Key points */}
        {Array.isArray(article.keyPoints) && article.keyPoints.length > 0 && (
          <div className="mb-6">
            <div className="text-sm font-medium mb-2">Key points</div>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              {article.keyPoints.map((x, i) => <li key={i}>{x}</li>)}
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

        {/* Sources (popover for full list) */}
        {domains.length > 0 && (
          <div className="mt-4">
            <div className="text-sm font-medium mb-2">Sources</div>
            <div className="flex items-center gap-2">
              <span className="flex -space-x-1">
                {topDomains.map((d, i) => (
                  <img key={`${d}-${i}`} src={faviconUrl(d)} alt={d} className="h-5 w-5 rounded ring-1 ring-white dark:ring-gray-900" />
                ))}
              </span>
              {domains.length > 4 && (
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="h-5 px-2 rounded-full bg-muted text-[11px] ring-1 ring-white dark:ring-gray-900">+{domains.length - 4} more</button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72" align="start">
                    <div className="space-y-1">
                      {(article.urls && article.sources ? article.sources.map((d, i) => ({ domain: d, url: article.urls![i] || article.url })) : [{ domain: article.source, url: article.url }])
                        .filter(x => !!x.url)
                        .map((s, i) => (
                          <a key={i} href={s.url!} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm hover:underline">
                            <img src={faviconUrl(s.domain)} alt={s.domain} className="h-4 w-4 rounded" />
                            <span className="truncate">{s.domain?.replace(/^www\./,'')}</span>
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        ))}
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  );
}
