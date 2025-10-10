import React, { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Send, Paperclip, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
// Using native textarea to avoid framework ring/offset styles
import { FilePreview } from "./FilePreview";
import { useToast } from "@/hooks/use-toast";
import { VoiceGlyph } from "@/components/icons/VoiceGlyph";

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
  const navigate = useNavigate();
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
    <form onSubmit={handleSubmit} className="relative w-full">
      <div className="relative w-full">
              <div className="relative">
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit(e);
                    }
                  }}
                  placeholder={placeholder}
                  className="w-full min-h-[48px] max-h-[200px] pr-28 pl-4 py-3 resize-none rounded-2xl bg-background shadow-[0_4px_32px_rgba(0,0,0,0.16)] border border-[hsl(var(--border)/.06)] focus:border-orange-500 outline-none focus:outline-none ring-0 focus:ring-0 focus-visible:ring-0 ring-offset-0 focus-visible:ring-offset-0 text-[15px] leading-relaxed"
                  disabled={isLoading}
                />
                <div className="pointer-events-auto absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
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
                  className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted"
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
                {onStopGeneration ? (
                  <Button
                    type="button"
                    size="icon"
                    variant="destructive"
                    onClick={onStopGeneration}
                    className="h-8 w-8"
                  >
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </Button>
                ) : (
                  message.trim().length === 0 ? (
                    <Button
                      type="button"
                      size="icon"
                      className="h-8 w-8 bg-orange-500 hover:bg-orange-600 text-white"
                      onClick={() => navigate('/voice')}
                      aria-label="Voice mode"
                      disabled={isLoading}
                    >
                      <VoiceGlyph size={16} className="h-4 w-4 text-white" />
                    </Button>
                  ) : (
                    <Button
                      type="submit"
                      size="icon"
                      disabled={!message.trim() || isLoading}
                      className="h-8 w-8 bg-primary hover:bg-primary/90"
                      aria-label="Send message"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  )
                )}
              </div>
            </div>
          {files.length > 0 && (
            <div className="px-3 pb-2 pt-0">
              <div className="flex gap-2 flex-wrap">
                {files.map((file, index) => (
                  <FilePreview key={index} file={file} onRemove={() => handleRemoveFile(index)} />
                ))}
              </div>
            </div>
          )}
        </div>
      </form>
  );
};
export default ChatInput;