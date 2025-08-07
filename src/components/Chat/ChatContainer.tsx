import { useState, useRef, useEffect } from "react";
import ChatHeader from "./ChatHeader";
import ChatMessage from "./ChatMessage";
import ChatInput from "./ChatInput";
import WelcomeScreen from "./WelcomeScreen";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Message {
  id: string;
  content: string;
  isBot: boolean;
  timestamp: Date;
  healthRelated?: boolean;
}

const ChatContainer = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingMessage, setEditingMessage] = useState<string>("");
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

  const handleSendMessage = async (message: string, files?: File[]) => {
    let finalMessage = message;
    
    // Handle file uploads by adding file descriptions to message
    if (files && files.length > 0) {
      const fileDescriptions = files.map(file => {
        if (file.type.startsWith('image/')) {
          return `[Image uploaded: ${file.name}]`;
        } else if (file.type === 'application/pdf') {
          return `[PDF uploaded: ${file.name}]`;
        } else {
          return `[File uploaded: ${file.name}]`;
        }
      }).join('\n');
      
      finalMessage = `${message}\n\n${fileDescriptions}`;
    }

    // If editing, update the existing message instead of creating new one
    if (editingMessage) {
      setMessages(prev => 
        prev.map(msg => 
          msg.content === editingMessage && !msg.isBot 
            ? { ...msg, content: finalMessage, timestamp: new Date() }
            : msg
        )
      );
      setEditingMessage("");
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      content: finalMessage,
      isBot: false,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const { geminiService } = await import('@/lib/gemini');
      const response = await geminiService.generateResponse(finalMessage);

      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: response.content,
        isBot: true,
        timestamp: new Date(),
        healthRelated: response.isHealthRelated
      };

      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      console.error('Error generating response:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: "I apologize, but I encountered an error while processing your request. Please try again.",
        isBot: true,
        timestamp: new Date(),
        healthRelated: false
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditMessage = (messageContent: string) => {
    setEditingMessage(messageContent);
  };

  const handleCancelEdit = () => {
    setEditingMessage("");
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      <ChatHeader />
      
      <div className="flex-1 overflow-hidden">
        {messages.length === 0 ? (
          <WelcomeScreen onSendMessage={handleSendMessage} />
        ) : (
          <ScrollArea className="h-full" ref={scrollAreaRef}>
            <div className="min-h-full max-w-4xl mx-auto px-6 py-8">
              {messages.map((message) => (
                <ChatMessage
                  key={message.id}
                  message={message.content}
                  isBot={message.isBot}
                  timestamp={message.timestamp}
                  healthRelated={message.healthRelated}
                  onEdit={!message.isBot ? handleEditMessage : undefined}
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
        )}
      </div>
      
      <ChatInput 
        onSendMessage={handleSendMessage} 
        isLoading={isLoading}
        editMessage={editingMessage}
        onCancelEdit={handleCancelEdit}
      />
    </div>
  );
};

export default ChatContainer;