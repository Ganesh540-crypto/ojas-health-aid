import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from "@/lib/utils";
import { User, Edit3, ExternalLink, Volume2 } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import ThinkingLoader from '@/components/Chat/ThinkingLoader';
import SourcesDisplay from '@/components/Chat/SourcesDisplay';

interface ChatMessageProps {
  message: string;
  isBot: boolean;
  timestamp: Date;
  isThinking?: boolean;
  healthRelated?: boolean;
  onEdit?: (message: string) => void;
  userAvatar?: string;
  className?: string; // for parent-controlled scaling
  // Loader customization when isThinking is true
  thinkingMode?: 'thinking' | 'searching';
  thinkingLabel?: string;
  sources?: Array<{ title: string; url: string; snippet?: string; displayUrl?: string }>;
}

import { synthesizeSpeech, speakSmart } from '@/lib/tts';
import { useState } from 'react';

// --- Helpers to keep links short and direct ---
function unwrapRedirect(raw: string): string {
  try {
    const u = new URL(raw);
    const host = u.hostname;
    // Common redirectors: Google / Vertex / Googleusercontent
    const isGoogleUrl = host.endsWith('google.com');
    const isGoogleUser = host.endsWith('googleusercontent.com');
    const isVertex = /vertex/i.test(host) || /gemini/i.test(host);
    if (isGoogleUrl && u.pathname === '/url') {
      const target = u.searchParams.get('q') || u.searchParams.get('url') || u.searchParams.get('u');
      if (target) return target;
    }
    if (isGoogleUrl || isGoogleUser || isVertex) {
      const target = u.searchParams.get('q') || u.searchParams.get('url') || u.searchParams.get('u');
      if (target) return target;
    }
    return raw;
  } catch {
    return raw;
  }
}

function getChildText(fallback: any): string {
  if (typeof fallback === 'string') return fallback.trim();
  if (Array.isArray(fallback)) {
    return fallback.map((c) => (typeof c === 'string' ? c : '')).join('').trim();
  }
  return '';
}

function looksLikeUrl(text: string): boolean {
  return /^(https?:\/\/|www\.)/i.test(text) || /\.[a-z]{2,}(\/|$)/i.test(text);
}

function shortLabelFor(href?: string, fallback?: any): any {
  const childText = getChildText(fallback);
  // If author provided a short label (not a raw URL), keep it.
  if (childText && childText.length <= 48 && !looksLikeUrl(childText)) {
    return fallback;
  }
  if (!href) return fallback;
  try {
    const u = new URL(href);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return fallback;
  }
}

// --- Fallback: generic autolink for "Sources" bullets ---
// Converts domain-like mentions in Sources list items into Markdown links.
function preprocessMessageForSources(text: string): string {
  try {
    const lines = text.split('\n');
    let inSources = false;
    const domainRegex = /(?:https?:\/\/)?(?:www\.)?([a-z0-9-]+(?:\.[a-z0-9-]+)+)(?:[\/\?#]\S*)?/i;
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (/^#{1,6}\s*Sources\b/i.test(trimmed) || /^Sources:?\s*$/i.test(trimmed)) {
        inSources = true;
        continue;
      }
      if (!inSources) continue;
      // Continue within sources block; empty lines are allowed
      if (trimmed === '') continue;
      // End of sources block if a new heading appears.
      if (!/^[*-]\s+/.test(trimmed)) {
        if (/^#{1,6}\s+/.test(trimmed)) inSources = false;
        continue;
      }
      // Already a markdown link or raw URL -> keep (renderer shortens labels).
      if (/\]\(https?:\/\/[^)]+\)/i.test(trimmed) || /(https?:\/\/|www\.)\S+/i.test(trimmed)) {
        continue;
      }
      // Try to extract a domain mention and link to its HTTPS root.
      const m = trimmed.match(domainRegex);
      if (!m) continue;
      let url = m[0];
      if (!/^https?:\/\//i.test(url)) {
        url = `https://${url.replace(/^www\./i, '')}`;
      }
      let domainLabel = '';
      try { domainLabel = new URL(url).hostname.replace(/^www\./, ''); } catch { domainLabel = url; }
      lines[i] = lines[i].replace(/^([*-]\s+).*/, `$1[${domainLabel}](${url})`);
    }
    return lines.join('\n');
  } catch {
    return text;
  }
}

const ChatMessage = ({ message, isBot, timestamp, isThinking, healthRelated, onEdit, userAvatar, className, thinkingMode, thinkingLabel, sources }: ChatMessageProps) => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [usedFallback, setUsedFallback] = useState(false);

  const handleSpeak = async () => {
    if (isSpeaking) return;
    setIsSpeaking(true);
    try {
      if (!audioUrl) {
        const url = await synthesizeSpeech(message, { speakingRate: 1, pitch: 0 });
        if (url) {
          setAudioUrl(url);
          const audio = new Audio(url);
          audio.onended = () => setIsSpeaking(false);
          await audio.play();
          return;
        }
      }
      // Fallback
      const ok = await speakSmart(message);
      if (!ok) setUsedFallback(true);
      setTimeout(() => setIsSpeaking(false), 500); // approximate end for web speech
    } catch {
      setIsSpeaking(false);
    }
  };

  return (
    <div className={cn("w-full", className)}>
      {isBot && (
        <div className="w-full">
          <div className="mb-3">
            <span className="text-sm font-medium text-foreground">Answer</span>
          </div>
          <div className="w-full">
            {isThinking ? (
                <ThinkingLoader mode={thinkingMode ?? 'thinking'} labelOverride={thinkingLabel} className="px-2 py-1" />
              ) : (
                <div className={cn(
                  "prose prose-sm dark:prose-invert max-w-none",
                  // Paragraphs - good spacing
                  "prose-p:leading-relaxed prose-p:mb-4 prose-p:text-[15px]",
                  // Headers - less bold, more spacing between sections
                  "prose-h1:mt-8 prose-h1:mb-4 prose-h1:text-xl prose-h1:font-medium",
                  "prose-h2:mt-7 prose-h2:mb-3 prose-h2:text-lg prose-h2:font-medium",
                  "prose-h3:mt-6 prose-h3:mb-2.5 prose-h3:text-base prose-h3:font-medium",
                  "prose-h4:mt-5 prose-h4:mb-2 prose-h4:text-sm prose-h4:font-medium",
                  // Lists - better spacing and hierarchy
                  "prose-ul:my-4 prose-ul:pl-6 prose-ul:space-y-2",
                  "prose-ol:my-4 prose-ol:pl-6 prose-ol:space-y-2",
                  "prose-li:leading-relaxed prose-li:text-[15px]",
                  "prose-li:marker:text-muted-foreground",
                  // Nested lists with proper indentation
                  "prose-li>ul:mt-2 prose-li>ul:mb-0 prose-li>ul:pl-6",
                  "prose-li>ol:mt-2 prose-li>ol:mb-0 prose-li>ol:pl-6",
                  "prose-li>ul>li:mt-1 prose-li>ol>li:mt-1",
                  // Different list styles for nesting
                  "prose-ol>li:marker:font-normal",
                  "prose-ul>li:marker:text-[0.6em]",
                  "prose-li>ul>li:marker:text-[0.8em]",
                  // Code and pre
                  "prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:font-mono prose-code:before:content-[''] prose-code:after:content-['']",
                  "prose-pre:bg-muted prose-pre:p-3 prose-pre:rounded-lg prose-pre:overflow-x-auto prose-pre:my-5 prose-pre:text-sm",
                  // Other elements
                  "prose-blockquote:border-l-4 prose-blockquote:border-primary prose-blockquote:pl-4 prose-blockquote:py-2 prose-blockquote:italic prose-blockquote:my-4",
                  "prose-table:my-5 prose-table:w-full prose-table:border-collapse",
                  "prose-th:border prose-th:border-border prose-th:px-3 prose-th:py-2 prose-th:text-left prose-th:font-medium prose-th:text-sm",
                  "prose-td:border prose-td:border-border prose-td:px-3 prose-td:py-2 prose-td:text-sm",
                  "prose-img:rounded-lg prose-img:my-5",
                  "prose-hr:my-8 prose-hr:border-border",
                  "prose-strong:font-medium",
                  "prose-a:text-primary prose-a:underline prose-a:underline-offset-2 hover:prose-a:text-primary/80",
                  className
                )}>
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      h1: ({ children }) => <h1 className="text-xl font-medium tracking-tight mt-8 mb-4 text-foreground">{children}</h1>,
                      h2: ({ children }) => <h2 className="text-lg font-medium mt-7 mb-3 text-foreground">{children}</h2>,
                      h3: ({ children }) => <h3 className="text-base font-medium mt-6 mb-2.5 text-foreground">{children}</h3>,
                      p: ({ children }) => <p className="text-[15px] leading-relaxed mb-4 text-foreground">{children}</p>,
                      ul: ({ children }) => (
                        <ul className="list-disc pl-6 my-4 space-y-2 text-foreground">{children}</ul>
                      ),
                      ol: ({ children, start }) => (
                        <ol className="list-decimal pl-6 my-4 space-y-2 text-foreground" start={start}>{children}</ol>
                      ),
                      li: ({ children }) => <li className="text-foreground leading-[1.55]">{children}</li>,
                      strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
                      em: ({ children }) => <em className="italic text-foreground">{children}</em>,
                      code: ({ children }) => <code className="bg-muted px-1.5 py-0.5 rounded text-[13px] md:text-sm font-mono text-foreground break-words">{children}</code>,
                      pre: ({ children }) => <pre className="bg-muted p-4 rounded-lg overflow-x-auto mb-5 text-[13px] md:text-sm leading-relaxed text-foreground">{children}</pre>,
                      blockquote: ({ children }) => <blockquote className="border-l-4 border-primary/60 pl-5 italic mb-5 text-muted-foreground">{children}</blockquote>,
                      a: ({ href, children }) => {
                        const raw = String(href || '');
                        const clean = unwrapRedirect(raw);
                        const label = shortLabelFor(clean, children);
                        return (
                          <a
                            href={clean}
                            title={clean}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 max-w-full whitespace-nowrap rounded-full border border-border bg-muted px-2 py-0.5 text-foreground no-underline hover:bg-muted/80"
                          >
                            {label}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        );
                      },
                    }}
                  >
                    {preprocessMessageForSources(message)}
                  </ReactMarkdown>
                </div>
            )}
          </div>
            {usedFallback && (
              <div className="mt-2 text-[10px] text-muted-foreground">Browser speech fallback used.</div>
            )}
            {isBot && sources && !isThinking && (
              <SourcesDisplay sources={sources} className="mt-6" />
            )}
            {isBot && healthRelated && !isThinking && (
              <div className="mt-4">
                <Alert>
                  <AlertTitle>Health information only</AlertTitle>
                  <AlertDescription>
                    This is general information, not a diagnosis. For medical advice, consult a qualified professional.
                  </AlertDescription>
                </Alert>
              </div>
            )}
        </div>
      )}
    </div>
  );
};

export default ChatMessage;