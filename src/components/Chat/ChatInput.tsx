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
}

const ChatInput = ({ onSendMessage, isLoading, editMessage, onCancelEdit }: ChatInputProps) => {
  const [message, setMessage] = useState(editMessage || "");
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  React.useEffect(() => {
    setMessage(editMessage || "");
  }, [editMessage]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !isLoading) {
      onSendMessage(message.trim(), files);
      setMessage("");
      setFiles([]);
      onCancelEdit?.();
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
  <div className="border-t border-border bg-background px-6 py-4">
      <form onSubmit={handleSubmit} className="space-y-3 max-w-4xl mx-auto">
        {files.length > 0 && (
          <div className="flex gap-2 flex-wrap">
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
          <div className="text-sm text-muted-foreground bg-muted/50 p-2 rounded-lg">
            Editing message...
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
        
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Type your message here..."
              className="min-h-[56px] resize-none pr-28 rounded-2xl border-border bg-background"
              disabled={isLoading}
            />
            <div className="absolute right-2 bottom-2 flex gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                disabled={isLoading}
              >
                <Mic className="h-4 w-4" />
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,.pdf,.txt,.doc,.docx"
                onChange={handleFileSelect}
                className="hidden"
              />
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
                className="h-8 w-8 p-0 rounded-full"
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
        </div>
        <div className="flex items-center justify-end">
          <p className="text-xs text-muted-foreground">3 prompts left</p>
        </div>
      </form>
    </div>
  );
};

export default ChatInput;