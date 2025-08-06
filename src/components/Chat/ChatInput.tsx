import { useState } from "react";
import { Send, Mic, Paperclip, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  isLoading?: boolean;
}

const ChatInput = ({ onSendMessage, isLoading }: ChatInputProps) => {
  const [message, setMessage] = useState("");
  const [isRecording, setIsRecording] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !isLoading) {
      onSendMessage(message.trim());
      setMessage("");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="border-t border-border bg-background">
      <div className="max-w-4xl mx-auto px-6 py-6">
        <form onSubmit={handleSubmit} className="relative">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask AI a question or make a request..."
            className={cn(
              "min-h-[60px] resize-none",
              "bg-background border-input-border",
              "text-foreground placeholder:text-muted-foreground",
              "rounded-3xl px-6 py-4 pr-16",
              "focus:ring-2 focus:ring-primary/20 focus:border-primary/50",
              "transition-all shadow-sm",
              "text-base"
            )}
            disabled={isLoading}
          />
          
          <div className="absolute bottom-3 right-4 flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 hover:bg-muted rounded-full"
              onClick={() => setIsRecording(!isRecording)}
            >
              <Mic className={cn(
                "w-4 h-4",
                isRecording ? "text-destructive" : "text-muted-foreground"
              )} />
            </Button>
            
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 hover:bg-muted rounded-full"
            >
              <Paperclip className="w-4 h-4 text-muted-foreground" />
            </Button>
            
            <Button
              type="submit"
              disabled={!message.trim() || isLoading}
              size="sm"
              className={cn(
                "bg-foreground hover:bg-foreground/90",
                "text-background",
                "rounded-full h-8 w-8 p-0",
                "disabled:opacity-30 disabled:cursor-not-allowed",
                "transition-all"
              )}
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-background/30 border-t-background rounded-full animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </form>
        
        <div className="mt-4 text-center">
          <p className="text-xs text-muted-foreground">
            Ojas AI provides general health information only. Always consult healthcare professionals for medical advice.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ChatInput;