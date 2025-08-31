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

interface ChatMessageProps {
  message: string;
  isBot: boolean;
  timestamp: Date;
  isThinking?: boolean;
  healthRelated?: boolean;
  onEdit?: (message: string) => void;
  userAvatar?: string;
  className?: string; // for parent-controlled scaling
}

import { synthesizeSpeech, speakSmart } from '@/lib/tts';
import { useState } from 'react';

const ChatMessage = ({ message, isBot, timestamp, isThinking, healthRelated, onEdit, userAvatar, className }: ChatMessageProps) => {
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
  <div className={cn("px-0 py-2", className)}>
      <div className={cn("flex w-full gap-3", isBot ? "justify-start" : "justify-end")}>        
        {/* Avatar */}
        <Avatar className={cn("h-8 w-8 shrink-0", isBot ? "order-none" : "order-2")}>          
          {isBot ? (
            <img src="/logo-jas.svg" alt="Ojas logo" className="h-8 w-8 p-1" />
          ) : (
            userAvatar ? (
              <img src={userAvatar} alt="avatar" className="h-8 w-8 rounded" />
            ) : (
              <AvatarFallback className="bg-accent text-accent-foreground">
                <User className="w-4 h-4" />
              </AvatarFallback>
            )
          )}
        </Avatar>

  <div className={cn("flex max-w-[85%] flex-col", isBot ? "items-start" : "items-end order-1")}> 
          <div className={cn("flex items-center gap-1 mb-1 text-xs text-muted-foreground", isBot ? "flex-row" : "flex-row-reverse")}>            
            <span>{format(timestamp, "HH:mm")}</span>
            {healthRelated && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="secondary" className="cursor-help">Health</Badge>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="text-sm">
                      ⚠️ AI-generated health info. Consult professionals for medical advice, diagnosis, or treatment.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {isBot && !isThinking && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSpeak}
                className="h-5 w-5 p-0"
                title="Read aloud"
              >
                <Volume2 className={cn("h-3 w-3", isSpeaking && 'animate-pulse')} />
              </Button>
            )}
            {!isBot && onEdit && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(message)}
                className="h-5 w-5 p-0"
              >
                <Edit3 className="h-3 w-3" />
              </Button>
            )}
          </div>
          <div className={cn("rounded-2xl px-4 py-3 leading-relaxed text-[16px] md:text-[17px]", isBot ? "bg-transparent" : "bg-transparent")}> 
              {isThinking ? (
                <div className="flex gap-1 py-1 px-1">
                  <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce [animation-delay:-0.2s]"></span>
                  <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce [animation-delay:-0.1s]"></span>
                  <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" ></span>
                </div>
              ) : (
        <div className="prose max-w-none prose-p:my-3 prose-ul:my-3 prose-ol:my-3 prose-li:leading-relaxed prose-headings:mt-6 prose-headings:mb-3 prose-pre:rounded-xl prose-pre:p-4 prose-blockquote:italic prose-blockquote:border-l-4 prose-blockquote:pl-5 prose-blockquote:text-muted-foreground text-foreground">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
          h1: ({ children }) => <h1 className="text-2xl font-bold tracking-tight mb-4 text-foreground">{children}</h1>,
          h2: ({ children }) => <h2 className="text-xl font-semibold mb-3 text-foreground">{children}</h2>,
          h3: ({ children }) => <h3 className="text-lg font-semibold mb-2 text-foreground">{children}</h3>,
          p: ({ children }) => <p className="text-[16px] md:text-[17px] leading-[1.65] text-foreground">{children}</p>,
          ul: ({ children }) => <ul className="list-disc pl-6 mb-4 text-foreground space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-6 mb-4 text-foreground space-y-1">{children}</ol>,
          li: ({ children }) => <li className="text-foreground leading-[1.55]">{children}</li>,
                      strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
                      em: ({ children }) => <em className="italic text-foreground">{children}</em>,
          code: ({ children }) => <code className="bg-muted px-1.5 py-0.5 rounded text-[13px] md:text-sm font-mono text-foreground">{children}</code>,
          pre: ({ children }) => <pre className="bg-muted p-4 rounded-lg overflow-x-auto mb-5 text-[13px] md:text-sm leading-relaxed text-foreground">{children}</pre>,
          blockquote: ({ children }) => <blockquote className="border-l-4 border-primary/60 pl-5 italic mb-5 text-muted-foreground">{children}</blockquote>,
                      a: ({ href, children }) => (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:text-primary-hover underline inline-flex items-center gap-1"
                        >
                          {children}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ),
                    }}
                  >
                    {message}
                  </ReactMarkdown>
                </div>
              )}
          </div>
          {usedFallback && (
            <div className="mt-2 text-[10px] text-muted-foreground">Browser speech fallback used.</div>
          )}
          {isBot && healthRelated && !isThinking && (
            <div className="mt-2">
              <Alert>
                <AlertTitle>Health information only</AlertTitle>
                <AlertDescription>
                  This is general information, not a diagnosis. For medical advice, consult a qualified professional.
                </AlertDescription>
              </Alert>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;