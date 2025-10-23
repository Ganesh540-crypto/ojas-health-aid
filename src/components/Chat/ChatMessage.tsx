import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from "@/lib/utils";
import { User, Edit3, ExternalLink, Volume2, ChevronDown, ChevronRight, Globe, Search, Lightbulb, Sparkles, ImageIcon } from "lucide-react";
import { useState, useEffect, useRef } from 'react';
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { LoadingAnimation } from '@/components/ui/loading-animation';
import SourcesDisplay from '@/features/chat/components/SourcesDisplay';
import {
  ChainOfThought,
  ChainOfThoughtContent,
  ChainOfThoughtHeader,
  ChainOfThoughtSearchResult,
  ChainOfThoughtSearchResults,
  ChainOfThoughtStep,
} from '@/components/ui/chain-of-thought';

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
  thinkingMode?: 'routing' | 'thinking' | 'searching' | 'analyzing';
  thinkingLabel?: string;
  sources?: Array<{ title: string; url: string; snippet?: string; displayUrl?: string }>;
  // Optional generation meta (thoughts, search queries, steps)
  metaItems?: Array<{ type: 'step' | 'thought' | 'search_query'; text?: string; query?: string; ts?: number }>;
  metaOpen?: boolean;
  onToggleMeta?: () => void;
}

function getSiteName(domainOrUrl: string): string {
  try {
    const domain = getDomain(domainOrUrl).toLowerCase();
    const map: Record<string, string> = {
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
      'github.com': 'GitHub'
    };
    if (map[domain]) return map[domain];
    const base = domain.split('.')[0];
    return base.charAt(0).toUpperCase() + base.slice(1);
  } catch {
    return domainOrUrl;
  }
}

function faviconUrl(domain?: string): string | undefined {
  if (!domain) return undefined;
  const d = getDomain(domain);
  return `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(d)}`;
}

import { synthesizeSpeech, speakSmart } from '@/lib/tts';

// Remark plugin (proper shape) to convert [1][2] style citations into a single grouped badge per sentence
// Groups all consecutive [n] markers (even with spaces) into one badge like "Source +2"
function remarkCitationsPlugin(options?: { sources?: Array<{ url: string }> }) {
  const sources = options?.sources || [];
  return function transformer(tree: any) {
    if (!Array.isArray(sources) || sources.length === 0) return;
    const replaceInNode = (node: any) => {
      if (!node || typeof node !== 'object') return;
      const kids = node.children;
      if (Array.isArray(kids)) {
        const next: any[] = [];
        for (const child of kids) {
          // Recurse first to handle nested containers
          replaceInNode(child);
          if (child && child.type === 'text' && typeof child.value === 'string' && /\[\d+\]/.test(child.value)) {
            // Find all citations and their positions
            const text = child.value;
            const citations: number[] = [];
            const citationRegex = /\[(\d+)\]/g;
            let match;
            let firstCitationIndex = -1;
            
            // Collect all citation numbers and find where they start
            while ((match = citationRegex.exec(text)) !== null) {
              citations.push(parseInt(match[1], 10));
              if (firstCitationIndex === -1) {
                firstCitationIndex = match.index;
              }
            }
            
            if (citations.length > 0 && firstCitationIndex !== -1) {
              // Split: text before citations, and grouped citation badge
              const textBefore = text.substring(0, firstCitationIndex).trim();
              
              // Push the text content (if any)
              if (textBefore) {
                next.push({ type: 'text', value: textBefore + ' ' });
              }
              
              // Create ONE grouped badge for all citations
              const first = citations[0];
              const url = sources[first - 1]?.url || '#';
              next.push({
                type: 'link',
                url,
                data: { hProperties: { 'data-citation': 'true', 'data-citation-indices': citations.join(',') } },
                children: [{ type: 'text', value: `[${citations.join(',')}]` }]
              });
            }
          } else {
            next.push(child);
          }
        }
        node.children = next;
      }
    };
    replaceInNode(tree);
  };
}

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

function getDomain(url: string): string {
  try {
    const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
    return urlObj.hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
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

const ChatMessage = ({ message, isBot, timestamp, isThinking, healthRelated, onEdit, userAvatar, className, thinkingMode, thinkingLabel, sources, metaItems, metaOpen, onToggleMeta }: ChatMessageProps) => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [usedFallback, setUsedFallback] = useState(false);
  const [showThoughts, setShowThoughts] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [wasThinking, setWasThinking] = useState(false);
  const [manualToggle, setManualToggle] = useState(false);
  
  // Debug logging
  useEffect(() => {
    if (metaItems && metaItems.length > 0) {
      console.log('🧠 ChatMessage received metaItems:', metaItems.length, 'items');
    }
  }, [metaItems]);
  
  // Auto-expand thoughts when available and thinking
  useEffect(() => {
    if (isThinking && metaItems && metaItems.length > 0 && !manualToggle) {
      setShowThoughts(true);
      setWasThinking(true);
    }
  }, [isThinking, metaItems, manualToggle]);
  
  // Auto-collapse when main response starts streaming (but keep collecting thoughts internally)
  useEffect(() => {
    if (message && message.length > 30 && isThinking && showThoughts && !manualToggle) {
      // Main response is streaming, auto-collapse thoughts
      setShowThoughts(false);
      setWasThinking(true);
    }
  }, [message, isThinking, showThoughts, manualToggle]);
  
  // Keep thoughts collapsed when thinking finishes
  useEffect(() => {
    if (!isThinking && wasThinking && !manualToggle) {
      setShowThoughts(false);
    }
  }, [isThinking, wasThinking, manualToggle]);
  
  // ThoughtsPanel handles its own scrolling behavior
  
  const handleToggleThoughts = () => {
    setManualToggle(true);
    setShowThoughts(!showThoughts);
  };

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

  // Process markdown in thoughts
  const renderThoughtText = (text: string) => {
    // Convert basic markdown patterns
    let processed = text
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code class="px-1 py-0.5 rounded bg-muted text-xs">$1</code>');
    return <span dangerouslySetInnerHTML={{ __html: processed }} />;
  };

  return (
    <div className={cn("w-full", className)}>
      {isBot && (
        <div className="w-full">
          {/* Dynamic header that transitions from thinking to Answer */}
          <div className="mb-3 flex items-center gap-2 transition-all duration-300">
            {isThinking ? (
              <LoadingAnimation 
                mode={thinkingMode ?? 'thinking'} 
                label={thinkingLabel} 
                className="" 
              />
            ) : (
              <>
                <span className="text-sm font-medium text-foreground">Answer</span>
                {metaItems && metaItems.length > 0 && (
                  <button
                    onClick={handleToggleThoughts}
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-all duration-200"
                    aria-expanded={showThoughts}
                    aria-label="Toggle thinking process"
                  >
                    <ChevronRight className={cn(
                      "h-3 w-3 transition-transform duration-200",
                      showThoughts && "rotate-90"
                    )} />
                  </button>
                )}
              </>
            )}
          </div>
          
          {/* Chain of Thought - Step-by-step visualization */}
          {metaItems && metaItems.length > 0 && (
            <div className="mb-4">
              <ChainOfThought open={showThoughts} onOpenChange={(open) => {
                setManualToggle(true);
                setShowThoughts(open);
              }}>
                <ChainOfThoughtContent>
                  {(() => {
                    const thoughts = metaItems.filter(it => it.type === 'thought');
                    const queries = metaItems.filter(it => it.type === 'search_query');
                    const steps = metaItems.filter(it => it.type === 'step');

                    // Combine all items in chronological order for step-by-step display
                    const allItems = [...metaItems].sort((a, b) => (a.ts || 0) - (b.ts || 0));

                    return (
                      <>
                        {allItems.map((item, idx) => {
                          const isLast = idx === allItems.length - 1;
                          const isActive = isThinking && isLast;

                          if (item.type === 'search_query') {
                            // Group consecutive search queries together
                            const searchQueries = [item];
                            let nextIdx = idx + 1;
                            while (nextIdx < allItems.length && allItems[nextIdx].type === 'search_query') {
                              searchQueries.push(allItems[nextIdx]);
                              nextIdx++;
                            }
                            
                            // Skip rendering if this query was already grouped
                            if (idx > 0 && allItems[idx - 1].type === 'search_query') {
                              return null;
                            }
                            
                            return (
                              <ChainOfThoughtStep
                                key={`item-${idx}`}
                                icon={Globe}
                                label="Searching"
                                status={isActive ? 'active' : 'complete'}
                              >
                                <div className="flex flex-col gap-2 mt-1 ml-1">
                                  {searchQueries.map((q, qIdx) => (
                                    <div 
                                      key={qIdx}
                                      className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted text-sm text-foreground/80 w-fit"
                                    >
                                      <Search className="h-3.5 w-3.5 text-muted-foreground" />
                                      <span>{q.query}</span>
                                    </div>
                                  ))}
                                </div>
                              </ChainOfThoughtStep>
                            );
                          }

                          if (item.type === 'thought') {
                            const text = item.text || '';
                            // Extract first line as label, rest as description
                            const lines = text.split('\n');
                            const firstLine = lines[0].replace(/\*\*/g, '');
                            const restLines = lines.slice(1).join('\n');
                            
                            return (
                              <ChainOfThoughtStep
                                key={`item-${idx}`}
                                icon={Lightbulb}
                                label={firstLine.substring(0, 100)}
                                status={isActive ? 'active' : 'complete'}
                              >
                                {restLines && (
                                  <div className="text-sm text-foreground/70 leading-relaxed mt-1">
                                    {restLines.split('\n').map((line, lineIdx) => {
                                      const processed = line
                                        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                                        .replace(/\*(.+?)\*/g, '<em>$1</em>')
                                        .replace(/`(.+?)`/g, '<code class="px-1 py-0.5 rounded bg-muted text-xs">$1</code>');
                                      return processed ? (
                                        <div key={lineIdx} dangerouslySetInnerHTML={{ __html: processed }} />
                                      ) : null;
                                    })}
                                  </div>
                                )}
                              </ChainOfThoughtStep>
                            );
                          }

                          if (item.type === 'step') {
                            return (
                              <ChainOfThoughtStep
                                key={`item-${idx}`}
                                icon={Sparkles}
                                label={item.text || 'Processing...'}
                                status={isActive ? 'active' : 'complete'}
                              />
                            );
                          }

                          return null;
                        })}
                      </>
                    );
                  })()}
                </ChainOfThoughtContent>
              </ChainOfThought>
            </div>
          )}
          
          <div className="w-full">
            {isThinking && !message ? (
              <div className="h-4" /> // Spacer while thinking
            ) : (
                <div className={cn(
                  "prose prose-sm dark:prose-invert max-w-none",
                  // Paragraphs - good spacing, left-aligned
                  "prose-p:leading-relaxed prose-p:mb-5 prose-p:text-[16.5px] prose-p:text-left",
                  // Headers - less bold, more spacing between sections, left-aligned
                  "prose-h1:mt-10 prose-h1:mb-5 prose-h1:text-xl prose-h1:font-medium prose-h1:text-left",
                  "prose-h2:mt-8 prose-h2:mb-5 prose-h2:text-lg prose-h2:font-medium prose-h2:text-left",
                  "prose-h3:mt-6 prose-h3:mb-4 prose-h3:text-base prose-h3:font-medium prose-h3:text-left",
                  "prose-h4:mt-5 prose-h4:mb-2 prose-h4:text-sm prose-h4:font-medium prose-h4:text-left",
                  // Lists - better spacing and hierarchy
                  "prose-ul:my-4 prose-ul:pl-6 prose-ul:space-y-2",
                  "prose-ol:my-4 prose-ol:pl-6 prose-ol:space-y-2",
                  "prose-li:leading-relaxed prose-li:text-[16.5px]",
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
                  // Enhanced table styling for better UI
                  "prose-table:my-6 prose-table:w-full prose-table:overflow-hidden prose-table:rounded-lg prose-table:border prose-table:border-border",
                  "prose-thead:bg-muted",
                  "prose-th:border-b prose-th:border-border prose-th:px-4 prose-th:py-3 prose-th:text-left prose-th:font-medium prose-th:text-sm prose-th:text-foreground",
                  "prose-td:border-b prose-td:border-border prose-td:px-4 prose-td:py-3 prose-td:text-sm prose-td:text-foreground",
                  "prose-tbody:divide-y prose-tbody:divide-border",
                  "prose-tr:hover:bg-muted prose-tr:transition-colors",
                  "prose-img:rounded-lg prose-img:my-5",
                  "prose-hr:my-10 prose-hr:border-border prose-hr:border-t",
                  "prose-strong:font-medium",
                  "prose-a:text-primary prose-a:underline prose-a:underline-offset-2 hover:prose-a:text-primary/80",
                  className
                )}>
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, [remarkCitationsPlugin as any, { sources }]]}
                    components={{
                      h1: ({ children }) => <h1 className="text-xl font-medium tracking-tight mt-10 mb-5 text-foreground text-left">{children}</h1>,
                      h2: ({ children }) => <h2 className="text-lg font-medium mt-8 mb-5 text-foreground text-left">{children}</h2>,
                      h3: ({ children }) => <h3 className="text-base font-medium mt-6 mb-4 text-foreground text-left">{children}</h3>,
                      p: ({ children }) => <p className="text-[16.5px] leading-relaxed mb-5 text-foreground text-left">{children}</p>,
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
                      hr: () => <hr className="my-5 border-t border-border" />,
                      table: ({ children }) => (
                        <div className="my-6 w-full overflow-x-auto">
                          <table className="w-full min-w-[500px] border-separate border-spacing-0 overflow-hidden rounded-lg border border-border bg-background shadow-sm">
                            {children}
                          </table>
                        </div>
                      ),
                      thead: ({ children }) => (
                        <thead className="bg-muted">{children}</thead>
                      ),
                      tbody: ({ children }) => (
                        <tbody className="divide-y divide-border">{children}</tbody>
                      ),
                      tr: ({ children }) => (
                        <tr className="transition-colors hover:bg-muted">{children}</tr>
                      ),
                      th: ({ children }) => (
                        <th className="border-b border-border px-4 py-3 text-left text-sm font-semibold text-foreground">
                          {children}
                        </th>
                      ),
                      td: ({ children }) => (
                        <td className="border-b border-border px-4 py-3 text-sm text-foreground">
                          {children}
                        </td>
                      ),
                      a: ({ href, children, ...rest }) => {
                        const raw = String(href || '');
                        const clean = unwrapRedirect(raw);
                        const label = shortLabelFor(clean, children);
                        const childText = getChildText(children as any) || String(label);
                        const isCitation = !!(rest as any)['data-citation'] || /^\[\d+(?:,\d+)*\]$/.test(childText);
                        if (isCitation) {
                          // Extract one or many indices
                          const indicesStr = (rest as any)['data-citation-indices'] || childText.replace(/[\[\]\s]/g, '');
                          const idxs = String(indicesStr).split(',').map((s) => parseInt(s, 10)).filter((n) => !Number.isNaN(n));
                          // Deduplicate sources by domain to avoid showing same site multiple times
                          const allItems = idxs.map((n) => {
                            const s = sources && sources[n - 1];
                            const d = s?.displayUrl || getDomain(s?.url || '');
                            const name = getSiteName(d || '');
                            const u = s?.url || '#';
                            return { name, url: u, domain: d };
                          });
                          const seenDomains = new Set<string>();
                          const uniqueItems = allItems.filter((item) => {
                            if (seenDomains.has(item.domain)) return false;
                            seenDomains.add(item.domain);
                            return true;
                          });
                          const firstItem = uniqueItems[0];
                          const otherItems = uniqueItems.slice(1);
                          
                          // Badge display: show first source name and count of additional unique sources
                          const sourceNameRaw = firstItem?.name || 'Source';
                          const sourceName = sourceNameRaw.length > 18 ? sourceNameRaw.substring(0, 18) + '…' : sourceNameRaw;
                          const extra = uniqueItems.length > 1 ? ` +${uniqueItems.length - 1}` : '';

                          return (
                            <span className="ml-1 relative group/citation inline-block align-baseline">
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-muted text-muted-foreground text-xs font-medium cursor-pointer transition-colors group-hover/citation:bg-primary group-hover/citation:text-primary-foreground">
                                {sourceName}{extra}
                              </span>
                              {/* Hover Popup with delay - shows all sources with favicons */}
                              {idxs.length > 0 && (
                                <div className="invisible group-hover/citation:visible opacity-0 group-hover/citation:opacity-100 transition-all duration-200 group-hover/citation:delay-0 delay-300 absolute bottom-full left-0 mb-2 z-50 hover:!visible hover:!opacity-100">
                                  <div className="bg-background border border-border rounded-lg shadow-xl p-2 min-w-[200px] max-w-[300px]">
                                    <div className="text-xs font-medium mb-1 text-muted-foreground">Sources • {uniqueItems.length}</div>
                                    <div className="space-y-1">
                                      {firstItem && (
                                        <a
                                          href={firstItem.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="flex items-center gap-2 text-sm hover:bg-accent/80 p-1.5 rounded transition-colors block"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <img src={faviconUrl(firstItem.domain)} alt="" className="h-4 w-4 rounded" />
                                          <span className="truncate flex-1">{firstItem.name}</span>
                                        </a>
                                      )}
                                      {otherItems.map((it, idx) => (
                                        <a
                                          key={idx}
                                          href={it.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="flex items-center gap-2 text-sm hover:bg-accent/80 p-1.5 rounded transition-colors block"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <img src={faviconUrl(it.domain)} alt="" className="h-4 w-4 rounded" />
                                          <span className="truncate flex-1">{it.name}</span>
                                        </a>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </span>
                          );
                        }
                        return (
                          <a
                            href={clean}
                            title={clean}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 max-w-full whitespace-nowrap rounded-full border border-border bg-muted px-2 py-0.5 text-foreground no-underline hover:bg-muted"
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