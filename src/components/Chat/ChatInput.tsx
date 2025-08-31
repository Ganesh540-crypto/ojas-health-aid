import React, { useState, useRef } from "react";
import { Send, Mic, Paperclip, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { FilePreview } from "./FilePreview";
import { useToast } from "@/hooks/use-toast";

interface ChatInputProps {
  onSendMessage: (message: string, files?: File[]) => void;
  isLoading?: boolean;
  editMessage?: string;
  onCancelEdit?: () => void;
  showExamplesAnimation?: boolean;
  onStopGeneration?: (() => void) | null;
  chatId?: string;
}

const examplePrompts = [
  "Track my healthy habits this week",
  "Explain intermittent fasting simply",
  "Suggest a balanced vegetarian meal plan",
  "Summarize latest AI in health news",
];

const ChatInput = ({ onSendMessage, isLoading, editMessage, onCancelEdit, showExamplesAnimation, onStopGeneration, chatId }: ChatInputProps) => {
  const [message, setMessage] = useState(() => {
    if (editMessage) return editMessage;
    if (chatId) {
      try { return localStorage.getItem(`ojas.draft.${chatId}`) || ""; } catch (err) { /* localStorage blocked */ return ""; }
    }
    return "";
  });
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [placeholder, setPlaceholder] = useState("Ask something...");
  React.useEffect(() => {
    if (!showExamplesAnimation) return;
    let idx = 0;
    let timeout: number;
    const cycle = () => {
      const full = examplePrompts[idx % examplePrompts.length];
      let chars = 0;
      const type = () => {
        chars++;
        setPlaceholder(full.slice(0, chars) + (chars < full.length ? "_" : ""));
        if (chars < full.length) {
          timeout = window.setTimeout(type, 60);
        } else {
          timeout = window.setTimeout(() => { idx++; cycle(); }, 2200);
        }
      };
      type();
    };
    cycle();
    return () => clearTimeout(timeout);
  }, [showExamplesAnimation]);

  React.useEffect(() => {
    if (editMessage) setMessage(editMessage); // editing overrides
  }, [editMessage]);

  // Persist draft per chat
  React.useEffect(() => {
    if (!chatId) return;
  try { localStorage.setItem(`ojas.draft.${chatId}`, message); } catch (err) { /* ignore persistence error */ }
  }, [message, chatId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !isLoading) {
      onSendMessage(message.trim(), files);
      setMessage("");
      setFiles([]);
      onCancelEdit?.();
  if (chatId) try { localStorage.removeItem(`ojas.draft.${chatId}`); } catch (err) { /* ignore */ }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const validFiles = selectedFiles.filter(file => {
      const isValidType = file.type.startsWith('image/') || 
                         file.type === 'application/pdf' || 
                         file.type.startsWith('text/');
      const isValidSize = file.size <= 10 * 1024 * 1024; // 10MB limit
      
      if (!isValidType) {
        toast({
          title: "Invalid file type",
          description: "Only images, PDFs, and text files are supported",
          variant: "destructive"
        });
        return false;
      }
      
      if (!isValidSize) {
        toast({
          title: "File too large",
          description: "File size must be less than 10MB",
          variant: "destructive"
        });
        return false;
      }
      
      return true;
    });
    
    setFiles(prev => [...prev, ...validFiles]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
  <div className="w-full">
      <form onSubmit={handleSubmit} className="max-w-4xl mx-auto px-6 py-4">
        {files.length > 0 && (
          <div className="mb-2 flex gap-2 flex-wrap">
            {files.map((file, index) => (
              <FilePreview
                key={`${file.name}-${index}`}
                file={file}
                onRemove={() => removeFile(index)}
              />
            ))}
          </div>
        )}

        {editMessage && (
          <div className="mb-2 text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded-full inline-flex items-center">
            Editing
            {onCancelEdit && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onCancelEdit}
                className="ml-2 h-6 px-2"
              >
                Cancel
              </Button>
            )}
          </div>
        )}

  <div className="relative">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder={placeholder}
            className="h-14 text-[15px] leading-snug resize-none pr-36 pl-4 rounded-2xl border border-primary/30 bg-background/70 outline-none focus-visible:ring-0 placeholder:text-muted-foreground/70 shadow-[0_1px_0_0_hsl(var(--border))]"
            disabled={isLoading}
          />
          <div className="absolute right-2 inset-y-0 my-auto h-9 flex items-center gap-2">
            <div className="hidden sm:block text-xs text-muted-foreground mr-2">3 prompts left</div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.pdf,.txt,.doc,.docx"
              onChange={handleFileSelect}
              className="hidden"
            />
            {isLoading && onStopGeneration && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs"
                onClick={onStopGeneration}
              >Stop</Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              disabled={isLoading}
              onClick={() => fileInputRef.current?.click()}
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            <Button
              type="submit"
              variant="secondary"
              size="sm"
              className="h-9 px-3 rounded-full"
              disabled={isLoading || !message.trim()}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default ChatInput;