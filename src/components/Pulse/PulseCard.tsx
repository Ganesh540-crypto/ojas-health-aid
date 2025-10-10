import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Clock, Layers } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { PulseArticle } from "@/pages/Pulse";
import { useNavigate } from "react-router-dom";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";

interface Props {
  article: PulseArticle;
  compact?: boolean;
}

const PulseCard: React.FC<Props> = ({ article, compact = false }) => {
  const navigate = useNavigate();
  const timeAgo = article.publishedAt
    ? formatDistanceToNow(new Date(article.publishedAt), { addSuffix: true })
    : "";

  // React 19: No useMemo needed - React Compiler optimizes automatically
  let primaryDomain = "";
  try {
    if (article.source) primaryDomain = article.source.replace(/^www\./, "");
    else if (article.url) primaryDomain = new URL(article.url).hostname.replace(/^www\./, "");
  } catch {}

  const faviconUrl = (domain?: string) =>
    domain ? `https://www.google.com/s2/favicons?sz=32&domain=${encodeURIComponent(domain)}` : undefined;

  // React 19: Direct computation - React Compiler handles optimization
  const arr = Array.isArray(article.sources) && article.sources.length > 0
    ? article.sources
    : (primaryDomain ? [primaryDomain] : []);
  const sourceDomains = Array.from(new Set(arr.filter(Boolean))).slice(0, 3);
  const allDomains = Array.from(new Set(arr.filter(Boolean)));

  const body = (
    <>
      {/* Image */}
      <div className="mb-3 overflow-hidden rounded-xl bg-muted/30">
        {article.imageUrl ? (
          <img
            src={article.imageUrl}
            alt={article.title}
            className="w-full h-40 object-cover"
            loading="lazy"
            onError={(e) => {
              // hide broken image
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="w-full h-40 flex items-center justify-center text-xs text-muted-foreground">
            {/* No image available */}
          </div>
        )}
      </div>

      {/* Title */}
      <h3 className={`font-semibold ${compact ? "text-base" : "text-lg"} leading-tight mb-2`}>
        {article.title}
      </h3>

      {/* Summary */}
      {!compact && (
        <p className="text-sm text-muted-foreground mb-3 line-clamp-2 leading-relaxed">
          {article.lede || article.summary}
        </p>
      )}

      {/* Tags */}
      {!compact && article.tags?.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {article.tags.slice(0, 4).map((t) => (
            <Badge key={t} variant="secondary" className="text-[10px]">
              {t.replace(/-/g, " ")}
            </Badge>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-3">
          {article.publishedAt && (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {timeAgo}
            </span>
          )}
          <span className="inline-flex items-center gap-2">
            <Layers className="h-3.5 w-3.5" />
            <span className="flex items-center -space-x-1">
              {sourceDomains.map((d, i) => (
                <img
                  key={`${d}-${i}`}
                  src={faviconUrl(d)}
                  alt={d}
                  className="h-4 w-4 rounded ring-1 ring-white dark:ring-gray-900"
                />
              ))}
            </span>
            {allDomains.length > sourceDomains.length && (
              <Popover>
                <PopoverTrigger asChild>
                  <button className="h-4 w-4 rounded-full bg-muted text-[10px] leading-none ring-1 ring-white dark:ring-gray-900 flex items-center justify-center hover:bg-muted/80">+{allDomains.length - sourceDomains.length}</button>
                </PopoverTrigger>
                <PopoverContent className="w-64" align="start">
                  <div className="text-xs font-medium mb-2">All Sources ({allDomains.length})</div>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {allDomains.map((d, i) => (
                      <div key={`${d}-${i}`} className="flex items-center gap-2 text-sm">
                        <img src={faviconUrl(d)} alt={d} className="h-4 w-4 rounded" />
                        <span className="truncate">{d}</span>
                      </div>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </span>
        </div>
        <button
          type="button"
          onClick={() => navigate(`/pulse/${article.id}`)}
          className="inline-flex items-center gap-1 text-primary hover:underline"
        >
          Details
          <ExternalLink className="h-3.5 w-3.5" />
        </button>
      </div>
    </>
  );

  return (
    <>
      <Card
        className={`p-4 ${compact ? "hover:shadow-sm" : "hover:shadow-md"} transition-shadow cursor-pointer`}
        role="button"
        tabIndex={0}
        onClick={() => navigate(`/pulse/${article.id}`)}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && navigate(`/pulse/${article.id}`)}
      >
        {body}
      </Card>
    </>
  );
};

export default PulseCard;
