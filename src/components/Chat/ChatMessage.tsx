import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from "@/lib/utils";
import { Brain, User, Check, Edit3, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

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
    <div className="px-4 py-3">
      <div className="flex items-start gap-3">
        <Avatar className="h-8 w-8">
          <AvatarFallback className={cn(isBot ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground")}
          >
            {isBot ? <Brain className="w-4 h-4" /> : <User className="w-4 h-4" />}
          </AvatarFallback>
        </Avatar>

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
            {!isBot && onEdit && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(message)}
                className="h-6 w-6 p-0"
              >
                <Edit3 className="h-3 w-3" />
              </Button>
            )}
          </div>

          <Card className={cn(isBot ? "bg-background" : "bg-muted/30 border-muted/60")}
          >
            <CardContent className="p-4">
              {isThinking ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ) : (
                <div className="prose prose-invert max-w-none">
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
                </div>
              )}
            </CardContent>
          </Card>
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

        {!isBot && (
          <div className="flex items-end">
            <Check className="w-4 h-4 text-success" />
          </div>
        )}
      </div>
      <Separator className="mt-3" />
    </div>
  );
};

export default ChatMessage;