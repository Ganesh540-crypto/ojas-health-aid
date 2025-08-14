import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ChatHeader from "./ChatHeader";
import ChatMessage from "./ChatMessage";
import ChatInput from "./ChatInput";
import WelcomeScreen from "./WelcomeScreen";
import { ScrollArea } from "@/components/ui/scroll-area";
import { chatStore } from "@/lib/chatStore";
import { memoryStore, type MemoryMessage } from "@/lib/memory";
import { auth } from "@/lib/firebase";

interface Message {
  id: string;
  content: string;
  isBot: boolean;
  timestamp: Date;
  healthRelated?: boolean;
}

const ChatContainer = () => {
  const { chatId } = useParams<{ chatId: string }>();
  const navigate = useNavigate();
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

  // Load chat history for this chatId and sync memory
  useEffect(() => {
    if (!auth.currentUser) {
      navigate('/login', { replace: true });
      return;
    }
    if (!chatId) return;
    const chat = chatStore.get(chatId) || chatStore.create();
    const mapped: Message[] = chat.messages.map(m => ({
      id: m.id,
      content: m.content,
      isBot: m.role === 'assistant',
      timestamp: new Date(m.timestamp),
    }));
    setMessages(mapped);
    const mem: MemoryMessage[] = chat.messages.map(m => ({ role: m.role, content: m.content, timestamp: m.timestamp }));
    memoryStore.setHistory(mem);
  }, [chatId, navigate]);

  // Quick-prompt integration from CommandDialog
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (typeof detail === 'string') {
        // Prefill editor or immediately send a starter
        setEditingMessage(detail + ' ');
      }
    };
    window.addEventListener('oj-quick-prompt', handler as EventListener);
    return () => window.removeEventListener('oj-quick-prompt', handler as EventListener);
  }, []);

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
    if (chatId) {
      chatStore.addMessage(chatId, 'user', finalMessage);
    }
    setIsLoading(true);
    try {
      const { aiRouter } = await import('@/lib/aiRouter');
      const response = await aiRouter.route(finalMessage);

  const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: response.content,
        isBot: true,
        timestamp: new Date(),
        healthRelated: response.isHealthRelated
      };

      setMessages(prev => [...prev, botMessage]);
      if (chatId) chatStore.addMessage(chatId, 'assistant', response.content);
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: "I apologize, but I encountered an error while processing your request. Please try again.",
        isBot: true,
        timestamp: new Date(),
        healthRelated: false
      };
      setMessages(prev => [...prev, errorMessage]);
      if (chatId) chatStore.addMessage(chatId, 'assistant', errorMessage.content);
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
    <div className="min-h-full max-w-3xl mx-auto px-6 py-6">
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