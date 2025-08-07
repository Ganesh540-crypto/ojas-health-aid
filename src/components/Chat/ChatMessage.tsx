import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from "@/lib/utils";
import { Brain, User, Check, Edit3, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ChatMessageProps {
  message: string;
  isBot: boolean;
  timestamp: Date;
  isThinking?: boolean;
  healthRelated?: boolean;
  onEdit?: (message: string) => void;
}

const ChatMessage = ({ message, isBot, timestamp, isThinking, healthRelated, onEdit }: ChatMessageProps) => {
  return (
    <div className={cn(
      "group flex gap-3 py-4 px-4 border-b border-border/50",
      isBot ? "bg-background" : "bg-muted/30"
    )}>
      <div className="flex-shrink-0">
        <div className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center",
          isBot ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground"
        )}>
          {isBot ? <Brain className="w-4 h-4" /> : <User className="w-4 h-4" />}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-medium text-foreground">
            {isBot ? "Ojas" : "You"}
          </span>
          <span className="text-xs text-muted-foreground">
            {format(timestamp, "HH:mm")}
          </span>
          {healthRelated && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-xs bg-warning/20 text-warning px-2 py-1 rounded-full cursor-help">
                    Health Consultation
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-sm">
                    ⚠️ This response is AI-generated health information. Always consult healthcare professionals for medical advice, diagnosis, or treatment.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {!isBot && onEdit && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(message)}
              className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Edit3 className="h-3 w-3" />
            </Button>
          )}
        </div>
        
        <div className="text-foreground">
          {isThinking ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:0.1s]"></div>
                <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:0.2s]"></div>
              </div>
              <span>Ojas is thinking...</span>
            </div>
          ) : (
            <ReactMarkdown 
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ children }) => <h1 className="text-xl font-bold mb-4 text-foreground">{children}</h1>,
                h2: ({ children }) => <h2 className="text-lg font-semibold mb-3 text-foreground">{children}</h2>,
                h3: ({ children }) => <h3 className="text-base font-semibold mb-2 text-foreground">{children}</h3>,
                p: ({ children }) => <p className="mb-2 text-foreground leading-relaxed">{children}</p>,
                ul: ({ children }) => <ul className="list-disc list-inside mb-3 text-foreground space-y-1">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal list-inside mb-3 text-foreground space-y-1">{children}</ol>,
                li: ({ children }) => <li className="text-foreground">{children}</li>,
                strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
                em: ({ children }) => <em className="italic text-foreground">{children}</em>,
                code: ({ children }) => <code className="bg-muted px-1 py-0.5 rounded text-sm font-mono text-foreground">{children}</code>,
                pre: ({ children }) => <pre className="bg-muted p-3 rounded-lg overflow-x-auto mb-3 text-foreground">{children}</pre>,
                blockquote: ({ children }) => <blockquote className="border-l-4 border-primary pl-4 italic mb-3 text-muted-foreground">{children}</blockquote>,
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
          )}
        </div>
      </div>
      
      {!isBot && (
        <div className="flex items-end">
          <Check className="w-4 h-4 text-success" />
        </div>
      )}
    </div>
  );
};

export default ChatMessage;