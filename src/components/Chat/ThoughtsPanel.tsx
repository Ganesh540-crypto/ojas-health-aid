import { useEffect, useRef } from 'react';
import { Globe, Search } from 'lucide-react';

export type MetaItem = { type: 'step' | 'thought' | 'search_query'; text?: string; query?: string; ts?: number };

function renderThoughtText(text: string) {
  try {
    const processed = text
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code class="px-1 py-0.5 rounded bg-muted text-xs">$1</code>');
    return <span dangerouslySetInnerHTML={{ __html: processed }} />;
  } catch {
    return <span>{text}</span>;
  }
}

interface ThoughtsPanelProps {
  metaItems?: MetaItem[];
  show: boolean;
  isThinking?: boolean;
  manualOpen?: boolean; // true if user toggled manually
}

export default function ThoughtsPanel({ metaItems, show, isThinking, manualOpen }: ThoughtsPanelProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);

  // While streaming and auto-opened, pin to bottom so latest chunks are visible
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    if (show && isThinking && !manualOpen && Array.isArray(metaItems) && metaItems.length > 0) {
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight;
      });
    }
  }, [metaItems, isThinking, show, manualOpen]);

  // When user manually opens, start from top
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    if (show && manualOpen) {
      el.scrollTop = 0;
    }
  }, [show, manualOpen]);

  return (
    <div className={`overflow-hidden transition-all duration-300 ${show ? 'max-h-40 opacity-100 mb-4' : 'max-h-0 opacity-0'}`}>
      {Array.isArray(metaItems) && metaItems.length > 0 && (
        <div ref={viewportRef} className="rounded-lg bg-muted/30 border border-border/50 p-4 space-y-3 max-h-40 overflow-y-auto pr-1">
          {(() => {
            const thoughts = metaItems.filter(it => it.type === 'thought');
            const queries = metaItems.filter(it => it.type === 'search_query');
            const steps = metaItems.filter(it => it.type === 'step');

            return (
              <>
                {steps.length > 0 && (
                  <div className="text-sm text-muted-foreground mb-2">
                    {steps[steps.length - 1].text}
                  </div>
                )}
                {thoughts.length > 0 && (
                  <div className="space-y-2.5">
                    {thoughts.map((thought, idx) => (
                      <div key={idx} className="flex gap-3 text-sm text-foreground/90">
                        <div className="flex-shrink-0 mt-1.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-foreground/40" />
                        </div>
                        <div className="flex-1 leading-relaxed">
                          {renderThoughtText(thought.text || '')}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {queries.length > 0 && (
                  <div className="space-y-2.5 mt-4">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                      <Globe className="h-3.5 w-3.5" />
                      <span>Searching</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {queries.slice(-3).map((q, idx) => (
                        <span key={idx} className="inline-flex items-center gap-1.5 rounded-md bg-background/50 border border-border/60 px-2.5 py-1.5 text-xs text-foreground/80">
                          <Search className="h-3 w-3" />
                          {q.query}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
