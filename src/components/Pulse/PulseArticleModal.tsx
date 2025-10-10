import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Link as LinkIcon, Clock, Layers } from "lucide-react";
import type { PulseArticle } from "@/pages/Pulse";
import { format } from "date-fns";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  article: PulseArticle;
}

const getDomain = (url?: string) => {
  try {
    if (!url) return "";
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return url || "";
  }
};

const PulseArticleModal: React.FC<Props> = ({ open, onOpenChange, article }) => {
  const published = article.publishedAt ? format(new Date(article.publishedAt), "PPpp") : undefined;
  const sources = article.urls && article.sources ? article.sources.map((s, i) => ({ name: getDomain(s), url: article.urls![i] || article.url })) : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="leading-tight">{article.title}</DialogTitle>
          <DialogDescription>
            <div className="flex flex-wrap items-center gap-3 mt-1 text-xs">
              {published && (
                <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{published}</span>
              )}
              <span className="inline-flex items-center gap-1"><Layers className="h-3.5 w-3.5" />{article.sources?.length ? `${article.sources.length} sources` : getDomain(article.source)}</span>
            </div>
          </DialogDescription>
        </DialogHeader>

        {/* Image */}
        {article.imageUrl && (
          <div className="mb-4 overflow-hidden rounded-lg">
            <img src={article.imageUrl} alt={article.title} className="w-full max-h-[300px] object-cover" />
          </div>
        )}

        {/* Summary */}
        <p className="text-sm leading-relaxed mb-4 text-foreground">{article.summary}</p>

        {/* Key insights */}
        {article.keyInsights && article.keyInsights.length > 0 && (
          <div className="mb-4 p-3 bg-primary/5 rounded-md border-l-2 border-primary">
            <p className="text-sm font-medium mb-1">Key insights</p>
            <ul className="text-sm list-disc list-inside text-muted-foreground space-y-1">
              {article.keyInsights.slice(0, 5).map((x, i) => <li key={i}>{x}</li>)}
            </ul>
          </div>
        )}

        {/* Tags */}
        {article.tags?.length ? (
          <div className="flex flex-wrap gap-2 mb-4">
            {article.tags.map((t) => (
              <Badge key={t} variant="secondary" className="text-[10px]">{t.replace(/-/g, " ")}</Badge>
            ))}
          </div>
        ) : null}

        {/* Sources / Citations */}
        <div className="mt-2">
          <div className="text-sm font-medium mb-2">Sources</div>
          <div className="flex flex-col gap-2">
            {(sources && sources.length > 0 ? sources : [{ name: getDomain(article.url), url: article.url }]).map((s, i) => (
              <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-primary hover:underline">
                <LinkIcon className="h-4 w-4" /> {getDomain(s.url)} <ExternalLink className="h-3.5 w-3.5" />
              </a>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PulseArticleModal;
