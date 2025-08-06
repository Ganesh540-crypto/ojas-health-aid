import { Brain, User, Clock, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

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
        
        <div className={cn(
          "prose prose-invert max-w-none",
          "text-foreground-secondary leading-relaxed"
        )}>
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
            <div className="whitespace-pre-wrap">{message}</div>
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