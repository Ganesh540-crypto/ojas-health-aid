import { useState, useRef, useEffect } from "react";
import ChatHeader from "./ChatHeader";
import ChatMessage from "./ChatMessage";
import ChatInput from "./ChatInput";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Message {
  id: string;
  content: string;
  isBot: boolean;
  timestamp: Date;
  healthRelated?: boolean;
}

const ChatContainer = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      content: "Hello! I'm Ojas AI, your intelligent healthcare assistant. I'm here to help you with general questions, health-related inquiries, and provide guidance when you need it most.\n\nI can assist with:\n• General health questions and wellness tips\n• Understanding symptoms and preventive care\n• Emergency guidance and hospital recommendations\n• Medication information and safety advice\n\nHow can I help you today?",
      isBot: true,
      timestamp: new Date(),
      healthRelated: false
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (message: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      content: message,
      isBot: false,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    // Simulate AI response (replace with actual AI integration later)
    setTimeout(() => {
      const isHealthQuery = message.toLowerCase().includes('health') || 
                           message.toLowerCase().includes('pain') ||
                           message.toLowerCase().includes('symptom') ||
                           message.toLowerCase().includes('medicine') ||
                           message.toLowerCase().includes('doctor');

      const responses = isHealthQuery ? [
        "I understand you have a health-related question. Let me help you with that. Based on your query, I'd recommend consulting with a healthcare professional for personalized advice. In the meantime, here's some general information that might be helpful...",
        "For health concerns, it's always best to consult with qualified medical professionals. However, I can provide some general guidance and information. Would you like me to search for recent medical research on this topic?",
        "I notice this is health-related. While I can provide general information, please remember that this doesn't replace professional medical advice. Let me share what I know and suggest some preventive measures..."
      ] : [
        "That's an interesting question! Let me help you with that.",
        "I'd be happy to assist you with that. Here's what I can tell you...",
        "Great question! Let me provide you with some helpful information."
      ];

      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: responses[Math.floor(Math.random() * responses.length)],
        isBot: true,
        timestamp: new Date(),
        healthRelated: isHealthQuery
      };

      setMessages(prev => [...prev, botMessage]);
      setIsLoading(false);
    }, 1500);
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      <ChatHeader />
      
      <ScrollArea className="flex-1" ref={scrollAreaRef}>
        <div className="min-h-full">
          {messages.map((message) => (
            <ChatMessage
              key={message.id}
              message={message.content}
              isBot={message.isBot}
              timestamp={message.timestamp}
              healthRelated={message.healthRelated}
            />
          ))}
          
          {isLoading && (
            <ChatMessage
              message=""
              isBot={true}
              timestamp={new Date()}
              isThinking={true}
            />
          )}
        </div>
      </ScrollArea>
      
      <ChatInput onSendMessage={handleSendMessage} isLoading={isLoading} />
    </div>
  );
};

export default ChatContainer;