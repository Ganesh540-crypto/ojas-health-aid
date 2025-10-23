import React from "react";
import { Card } from "@/components/ui/card";
import type { PulseArticle } from "@/pages/Pulse";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { useImageFallback } from "@/hooks/useImageFallback";

interface TranslatedArticle {
  title: string;
  summary: string;
  lede?: string;
}

interface Props {
  article: PulseArticle;
  compact?: boolean;
  translated?: TranslatedArticle;
  size?: 'large' | 'small';
  imagePosition?: 'left' | 'right';
  index?: number;
}

const PulseCard: React.FC<Props> = ({ 
  article, 
  compact = false, 
  translated, 
  size = 'small',
  imagePosition = 'right',
  index = 0
}) => {
  const navigate = useNavigate();
  
  // Use translated content if available
  const displayTitle = translated?.title || article.title;
  // Prefer introduction (clean intro text) over summary for preview
  const displaySummary = translated?.summary || article.introduction || article.summary;
  const isLarge = size === 'large';
  
  // Helper functions
  const faviconUrl = (domain?: string) => domain ? `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(domain)}` : undefined;
  const timeAgo = article.publishedAt ? formatDistanceToNow(new Date(article.publishedAt), { addSuffix: true }) : null;
  const arr = Array.isArray(article.sources) && article.sources.length > 0 ? article.sources : (article.source ? [article.source] : []);
  const domains = Array.from(new Set(arr.filter(Boolean)));
  const sourceCount = domains.length;
  
  // Image fallback handling (try source URLs if main image missing)
  const { imageUrl: displayImage, handleImageError } = useImageFallback(article.imageUrl, article.urls);

  if (isLarge) {
    // Large card with horizontal layout
    return (
      <div
        className="group relative overflow-hidden rounded-lg border bg-card cursor-pointer transition-all duration-300 hover:shadow-lg"
        role="button"
        tabIndex={0}
        onClick={() => navigate(`/pulse/${article.id}`)}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && navigate(`/pulse/${article.id}`)}
      >
        <div className={`flex ${imagePosition === 'right' ? 'flex-row' : 'flex-row-reverse'} h-64`}>
          {/* Image Section */}
          {displayImage && (
            <div className="w-2/5 overflow-hidden relative">
              <img
                src={displayImage}
                alt={article.title}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                loading="lazy"
                onError={handleImageError}
              />
            </div>
          )}
          {/* Content Section */}
          <div className="flex-1 p-6 flex flex-col justify-center">
            <h3 className="text-2xl font-semibold leading-tight mb-2 transition-colors duration-300 group-hover:text-primary">
              {displayTitle}
            </h3>
            {timeAgo && (
              <p className="text-xs text-muted-foreground mb-3">{timeAgo}</p>
            )}
            <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3 transition-colors duration-300 group-hover:text-primary/80 mb-4">
              {displaySummary}
            </p>
            {/* Source icons stacked */}
            {sourceCount > 0 && (
              <div className="flex items-center gap-2 mt-auto">
                <div className="flex -space-x-2">
                  {domains.slice(0, 5).map((d, i) => (
                    <div key={`${d}-${i}`} className="w-5 h-5 rounded-full ring-1 ring-white dark:ring-gray-900 overflow-hidden bg-white">
                      <img src={faviconUrl(d)} alt={d} className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
                <span className="text-[10px] text-muted-foreground font-medium">{sourceCount} sources</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Small card (original style with hover effects)
  return (
    <Card
      className="group overflow-hidden cursor-pointer p-0 transition-all duration-300 hover:shadow-lg flex flex-col"
      role="button"
      tabIndex={0}
      onClick={() => navigate(`/pulse/${article.id}`)}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && navigate(`/pulse/${article.id}`)}
    >
      {/* Image - fills edge to edge, no rounded corners */}
      <div className="overflow-hidden bg-muted/30 aspect-video relative">
        {displayImage ? (
          <img
            src={displayImage}
            alt={article.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
            onError={handleImageError}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground bg-muted/20">
            No image
          </div>
        )}
      </div>

      {/* Title and sources - with hover effect */}
      <div className="p-3 flex flex-col flex-1">
        <h3 className="text-sm font-normal leading-snug transition-colors duration-300 group-hover:text-primary mb-2 line-clamp-3">
          {displayTitle}
        </h3>
        {/* Source count - fixed at bottom */}
        {sourceCount > 0 && (
          <div className="flex items-center gap-2 mt-auto pt-2">
            <div className="flex -space-x-2">
              {domains.slice(0, 3).map((d, i) => (
                <div key={`${d}-${i}`} className="w-5 h-5 rounded-full ring-1 ring-white dark:ring-gray-900 overflow-hidden bg-white">
                  <img src={faviconUrl(d)} alt={d} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
            <span className="text-[10px] text-muted-foreground">{sourceCount} sources</span>
          </div>
        )}
      </div>
    </Card>
  );
};

export default PulseCard;
