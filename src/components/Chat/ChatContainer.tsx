import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ChatHeader from "./ChatHeader";
import { Button } from "@/components/ui/button";
// Controls moved to settings; no per-chat UI bar now.
import ChatMessage from "./ChatMessage";
import ChatInput from "./ChatInput";
import WelcomeScreen from "./WelcomeScreen";
import { ScrollArea } from "@/components/ui/scroll-area";
import { chatStore } from "@/lib/chatStore";
import { memoryStore, type MemoryMessage } from "@/lib/memory";
import { auth } from "@/lib/firebase";
import { profileStore } from "@/lib/profileStore";

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
  const [chatLoading, setChatLoading] = useState<boolean>(true);
  const [chatLoadStartedAt] = useState<number>(() => Date.now());
  const [isLoading, setIsLoading] = useState(false);
  const [streamController, setStreamController] = useState<{ stop: () => void } | null>(null);
  const [scrollLocked, setScrollLocked] = useState(true);
  const [speed, setSpeed] = useState<number>(25);
  const [editingMessage, setEditingMessage] = useState<string>("");
  const [profile, setProfile] = useState(() => profileStore.get());
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = (smooth = true) => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        if (smooth) {
          scrollContainer.scrollTo({ top: scrollContainer.scrollHeight, behavior: 'smooth' });
        } else {
          scrollContainer.scrollTop = scrollContainer.scrollHeight;
        }
      }
    }
  };

  useEffect(() => {
    if (scrollLocked) scrollToBottom();
  }, [messages, scrollLocked]);

  // Persist preferences
  // Listen for settings changes (speed & scroll lock default)
  useEffect(() => {
    const apply = () => {
      try {
        const raw = localStorage.getItem('ojas.settings.v1');
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (typeof parsed.typeSpeed === 'number') setSpeed(parsed.typeSpeed);
        if (typeof parsed.scrollLock === 'boolean') setScrollLocked(parsed.scrollLock);
      } catch {/* ignore */}
    };
    apply();
    window.addEventListener('ojas-settings-changed', apply);
    return () => window.removeEventListener('ojas-settings-changed', apply);
  }, []);

  // Load chat history for this chatId and sync memory
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!auth.currentUser) {
        navigate('/login', { replace: true });
        return;
      }
      if (!chatId) { setChatLoading(false); return; }
      let chat = chatStore.get(chatId);
      if (!chat) {
        // Attempt a cloud hydrate once before giving up
        await chatStore.hydrateFromCloud();
        chat = chatStore.get(chatId);
      }
      if (!chat) {
        const existing = chatStore.list();
        if (existing.length > 0) {
          navigate(`/chat/${existing[0].id}`, { replace: true });
          setChatLoading(false);
        } else {
          const created = chatStore.create();
          navigate(`/chat/${created.id}`, { replace: true });
          setChatLoading(false);
        }
        return;
      }
      if (cancelled) return;
      const mapped: Message[] = chat.messages.map(m => ({
        id: m.id,
        content: m.content,
        isBot: m.role === 'assistant',
        timestamp: new Date(m.timestamp),
      }));
      setMessages(mapped);
      const mem: MemoryMessage[] = chat.messages.map(m => ({ role: m.role, content: m.content, timestamp: m.timestamp }));
      memoryStore.setHistory(mem);
      setChatLoading(false);
    };
    load();
    return () => { cancelled = true; };
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
      // Streaming / typewriter effect
      const full = response.content;
      const botId = (Date.now() + 1).toString();
      const botMessage: Message = {
        id: botId,
        content: "",
        isBot: true,
        timestamp: new Date(),
        healthRelated: response.isHealthRelated
      };
      setMessages(prev => [...prev, botMessage]);
      let i = 0;
      const chunk = Math.max(1, Math.round(full.length / (800 / speed)));
      let stopped = false;
      const interval = setInterval(() => {
        if (stopped) return;
        i += chunk;
        setMessages(prev => prev.map(m => m.id === botId ? { ...m, content: full.slice(0, i) } : m));
        if (scrollLocked) scrollToBottom(true);
        if (chatId) chatStore.updateMessage(chatId, botId, full.slice(0, i));
        if (i >= full.length) {
          clearInterval(interval);
          if (chatId) chatStore.addMessage(chatId, 'assistant', full);
          setStreamController(null);
          setIsLoading(false);
        }
      }, 25);
      setStreamController({ stop: () => { stopped = true; clearInterval(interval); setStreamController(null); setIsLoading(false); if (chatId) chatStore.addMessage(chatId, 'assistant', full.slice(0, i)); } });
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
  if (!streamController) setIsLoading(false);
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
  {/* Controls removed; managed in Settings dialog */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {chatLoading && (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
            <span>Loading chat…</span>
            {Date.now() - chatLoadStartedAt > 3000 && (
              <button onClick={() => window.location.reload()} className="text-primary underline">Reload</button>
            )}
          </div>
        )}
        {!chatLoading && messages.length === 0 ? (
          <WelcomeScreen onSendMessage={handleSendMessage} />
        ) : (
          <ScrollArea className="flex-1" ref={scrollAreaRef}>
            <div className="min-h-full mx-auto px-6 lg:px-8 py-8 space-y-4" style={{ maxWidth: 1000, fontSize: '100%' }}>
              {messages.map((message) => (
                <div key={message.id} className={message.isBot ? 'animate-fade-in' : ''}>
                  <ChatMessage
                    message={message.content}
                    isBot={message.isBot}
                    timestamp={message.timestamp}
                    healthRelated={message.healthRelated}
                    onEdit={!message.isBot ? handleEditMessage : undefined}
                    userAvatar={(profile as { avatar?: string } | null)?.avatar || '/avatars/user-1.svg'}
                  />
                </div>
              ))}
              {isLoading && !streamController && (
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
        {/* Input aligned to chat column width, not global viewport */}
        <ChatInput
          onSendMessage={handleSendMessage}
          isLoading={!!streamController || isLoading}
          editMessage={editingMessage}
          onCancelEdit={handleCancelEdit}
          showExamplesAnimation={messages.length === 0}
          onStopGeneration={streamController?.stop}
          chatId={chatId || undefined}
        />
      </div>
    </div>
  );
};

export default ChatContainer;