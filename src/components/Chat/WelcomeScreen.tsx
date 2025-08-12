import { Brain, MessageSquare, Mail, Code, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface WelcomeScreenProps {
  onSendMessage: (message: string) => void;
}

const WelcomeScreen = ({ onSendMessage }: WelcomeScreenProps) => {
  const suggestions = [
    {
      icon: <User className="w-5 h-5" />,
      title: "Write a to-do list for a personal project",
      content: "Help me organize my personal healthcare routine"
    },
    {
      icon: <Mail className="w-5 h-5" />,
      title: "Generate an email to reply to a job offer",
      content: "Draft a response about health insurance benefits"
    },
    {
      icon: <MessageSquare className="w-5 h-5" />,
      title: "Summarize this article in one paragraph",
      content: "Explain the latest health research findings"
    },
    {
      icon: <Code className="w-5 h-5" />,
      title: "How does AI work in a technical capacity",
      content: "Explain how AI assists in healthcare diagnosis"
    }
  ];

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 max-w-3xl mx-auto">
      {/* Welcome Header */}
      <div className="text-center mb-12">
        <div className="flex items-center justify-center mb-6">
          <div className="w-16 h-16 rounded-full bg-gradient-primary flex items-center justify-center shadow-glow">
            <Brain className="w-8 h-8 text-primary-foreground" />
          </div>
        </div>
        <h1 className="font-futuristic text-4xl text-foreground mb-4">
          Good afternoon!
        </h1>
        <p className="text-2xl text-foreground">
          What's on <span className="text-primary font-medium">your mind?</span>
        </p>
      </div>

      {/* Suggestion Cards */}
      <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {suggestions.map((suggestion, index) => (
          <Card key={index} className="hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => onSendMessage(suggestion.content)}>
            <CardContent className="p-6">
              <div className="flex items-start gap-4 w-full">
                <div className="text-muted-foreground mt-1">
                  {suggestion.icon}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-foreground text-sm leading-relaxed">
                    {suggestion.title}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Footer Text */}
      <p className="text-center text-sm text-muted-foreground max-w-md">
        GET STARTED WITH AN EXAMPLE BELOW
      </p>
    </div>
  );
};

export default WelcomeScreen;