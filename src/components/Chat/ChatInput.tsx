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
    <div className="border-t border-card-border bg-card/50 backdrop-blur-xl">
      <div className="container mx-auto px-6 py-6">
        {/* Health Disclaimer */}
        <div className="mb-4 p-3 bg-warning/10 border border-warning/30 rounded-xl flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
          <div className="text-sm text-warning">
            <p className="font-medium">Medical Disclaimer</p>
            <p className="text-warning/80 mt-1">
              Ojas AI provides general health information only. Always consult healthcare professionals for medical advice.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask me anything about health, wellness, or general questions..."
              className={cn(
                "min-h-[80px] resize-none",
                "bg-background-secondary border-input-border",
                "text-foreground placeholder:text-muted-foreground",
                "rounded-2xl px-4 py-4 pr-24",
                "focus:ring-2 focus:ring-primary/50 focus:border-primary/50",
                "transition-all"
              )}
              disabled={isLoading}
            />
            
            <div className="absolute bottom-3 right-3 flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 hover:bg-muted"
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
                className="h-8 w-8 p-0 hover:bg-muted"
              >
                <Paperclip className="w-4 h-4 text-muted-foreground" />
              </Button>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              Press Enter to send, Shift + Enter for new line
            </div>
            
            <Button
              type="submit"
              disabled={!message.trim() || isLoading}
              className={cn(
                "bg-gradient-primary hover:bg-primary-hover",
                "text-primary-foreground font-medium",
                "rounded-xl px-6 py-2 h-auto",
                "shadow-primary transition-all",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  Sending...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Send className="w-4 h-4" />
                  Send Message
                </div>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChatInput;