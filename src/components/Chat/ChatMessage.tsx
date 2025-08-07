import { Brain, User, Clock, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ChatMessageProps {
  message: string;
  isBot: boolean;
  timestamp: Date;
  isThinking?: boolean;
  healthRelated?: boolean;
}

const ChatMessage = ({ message, isBot, timestamp, isThinking, healthRelated }: ChatMessageProps) => {
  return (
    <div className={cn(
      "flex gap-4 p-6 transition-all",
      isBot ? "bg-card/30" : "bg-transparent"
    )}>
      <div className={cn(
        "w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0",
        isBot 
          ? "bg-gradient-primary shadow-glow" 
          : "bg-background-secondary border border-card-border"
      )}>
        {isBot ? (
          <Brain className="w-5 h-5 text-primary-foreground" />
        ) : (
          <User className="w-5 h-5 text-foreground-secondary" />
        )}
      </div>
      
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground">
            {isBot ? "Ojas AI" : "You"}
          </span>
          {healthRelated && (
            <div className="px-2 py-1 text-xs bg-success/20 text-success rounded-full border border-success/30">
              Health Consultation
            </div>
          )}
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            {timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
        
        <div className="text-foreground leading-relaxed">
          {isThinking ? (
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:0.1s]"></div>
                <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:0.2s]"></div>
              </div>
              <span className="text-muted-foreground">Ojas is thinking...</span>
            </div>
          ) : (
            <div className="prose prose-neutral dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({node, ...props}) => <h1 className="text-xl font-bold text-foreground mb-3 mt-0" {...props} />,
                  h2: ({node, ...props}) => <h2 className="text-lg font-semibold text-foreground mb-2 mt-0" {...props} />,
                  h3: ({node, ...props}) => <h3 className="text-base font-medium text-foreground mb-2 mt-0" {...props} />,
                  p: ({node, ...props}) => <p className="text-foreground mb-3 last:mb-0 leading-relaxed" {...props} />,
                  strong: ({node, ...props}) => <strong className="font-semibold text-foreground" {...props} />,
                  em: ({node, ...props}) => <em className="italic text-foreground" {...props} />,
                  ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-3 text-foreground space-y-1" {...props} />,
                  ol: ({node, ...props}) => <ol className="list-decimal pl-5 mb-3 text-foreground space-y-1" {...props} />,
                  li: ({node, ...props}) => <li className="leading-relaxed" {...props} />,
                  code: ({node, ...props}) => <code className="bg-muted px-1.5 py-0.5 rounded text-sm text-foreground font-mono" {...props} />,
                  pre: ({node, ...props}) => <pre className="bg-muted p-3 rounded-lg overflow-x-auto mb-3" {...props} />,
                  blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-primary pl-4 italic text-muted-foreground mb-3" {...props} />,
                  a: ({node, ...props}) => <a className="text-primary hover:underline" {...props} />,
                }}
              >
                {message}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </div>
      
      {!isBot && (
        <div className="flex items-end">
          <CheckCircle2 className="w-4 h-4 text-success" />
        </div>
      )}
    </div>
  );
};

export default ChatMessage;