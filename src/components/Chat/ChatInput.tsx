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
  const placeholder = "Ask something...";

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

  const handleRemoveFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="w-full bg-background pb-3">
      <div className="mx-auto px-8 lg:px-16" style={{ maxWidth: 900 }}>
        <form onSubmit={handleSubmit} className="relative py-4">
          <div className="relative flex items-end gap-3">
            <div className="flex-1 relative">
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
                placeholder={placeholder}
                className="min-h-[56px] max-h-[200px] pr-24 resize-none rounded-xl border border-border bg-muted/30 focus:bg-background transition-colors"
                disabled={isLoading}
              />
              <div className="absolute right-2 bottom-2 flex items-center gap-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,application/pdf,text/*,.txt,.md,.json,.csv"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading}
                  className="hover:bg-muted"
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
                {onStopGeneration ? (
                  <Button
                    type="button"
                    size="icon"
                    variant="destructive"
                    onClick={onStopGeneration}
                  >
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    size="icon"
                    disabled={!message.trim() || isLoading}
                    className="bg-primary hover:bg-primary/90"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
          {files.length > 0 && (
            <div className="mt-2 flex gap-2">
              {files.map((file, index) => (
                <FilePreview key={index} file={file} onRemove={() => handleRemoveFile(index)} />
              ))}
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default ChatInput;