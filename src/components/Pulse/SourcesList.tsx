import React from 'react';
import { ExternalLink } from 'lucide-react';

interface SourcesListProps {
  sources: Array<{ domain: string; url: string; title?: string; description?: string }>;
  getSiteName: (domain: string) => string;
  faviconUrl: (domain?: string) => string | undefined;
}

export const SourcesList: React.FC<SourcesListProps> = ({ sources, getSiteName, faviconUrl }) => {
  return (
    <div className="space-y-0 divide-y divide-border">
      {sources.map((s, i) => (
        <a
          key={i}
          href={s.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block hover:bg-accent/40 transition-colors p-3"
        >
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
              <img src={faviconUrl(s.domain)} alt={s.domain} className="h-4 w-4 rounded" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-foreground leading-tight flex items-center justify-between">
                <span>{getSiteName(s.domain || '')}</span>
                <ExternalLink className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
              </div>
              {s.title && (
                <div className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                  {s.title}
                </div>
              )}
            </div>
          </div>
        </a>
      ))}
    </div>
  );
};
