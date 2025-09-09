import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ChatHeader from "./ChatHeader";
// Controls moved to settings; no per-chat UI bar now.
import ChatMessage from "./ChatMessage";
import ChatInput from "./ChatInput";
import SourcesDisplay from "./SourcesDisplay";
import WelcomeScreen from "@/components/Chat/WelcomeScreen";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import type { HealthIntakePayload, HealthIntakeQuestion } from '@/lib/healthIntake';
import { memoryStore, type MemoryMessage } from "@/lib/memory";
import { auth } from "@/lib/firebase";
import { profileStore } from "@/lib/profileStore";
import { chatStore } from "@/lib/chatStore";

interface Message {
  id: string;
  content: string;
  isBot: boolean;
  timestamp: Date;
  healthRelated?: boolean;
  sources?: Array<{ title: string; url: string; snippet?: string; displayUrl?: string }>;
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
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const [editingMessage, setEditingMessage] = useState<string>("");
  const [profile, setProfile] = useState(() => profileStore.get());
  const [intake, setIntake] = useState<HealthIntakePayload | null>(null);
  const [intakeAnswers, setIntakeAnswers] = useState<Record<string,string>>({});
  const [awaitingIntake, setAwaitingIntake] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [intakeIndex, setIntakeIndex] = useState(0);
  const [thinkingMode, setThinkingMode] = useState<'thinking' | 'searching'>('thinking');
  const [thinkingLabel, setThinkingLabel] = useState<string>('Thinking');

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
    if (shouldAutoScroll && messages.length > 0) {
      const timer = setTimeout(() => {
        scrollToBottom();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [messages, shouldAutoScroll]);

  useEffect(() => {
    if (scrollLocked) scrollToBottom();
  }, [messages, scrollLocked]);

  // Auto-scroll detection
  useEffect(() => {
    const scrollContainer = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (!scrollContainer) return;
    
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainer as HTMLElement;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
      
      // Only update auto-scroll if we're not currently streaming
      if (!isLoading || !streamController) {
        setShouldAutoScroll(isAtBottom);
      }
      setShowScrollButton(!isAtBottom);
      setScrollLocked(isAtBottom);
    };
    
    scrollContainer.addEventListener('scroll', handleScroll);
    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, [isLoading, streamController]);

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
        healthRelated: typeof m.healthRelated === 'boolean' ? m.healthRelated : false,
        sources: m.sources,
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
    // If currently in intake mode and user typed free-form, treat as final answers
    if (awaitingIntake && intake) {
      const packaged = { intakeAnswers: { freeform: message, structured: intakeAnswers } };
      const jsonPayload = JSON.stringify(packaged, null, 2);
      setAwaitingIntake(false);
      setIntake(null);
      setIntakeAnswers({});
      // Send answers to AI without adding a user-visible message
      return submitIntake(jsonPayload);
    }
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
      chatStore.pushToCloud();
    }
    // Pick loader mode+label heuristically before routing so UI shows the right state
    const inferLoader = (m: string): { mode: 'thinking' | 'searching'; label: string } => {
      const lower = m.toLowerCase();
      const research = ['research','sources','cite','evidence','current','today','market','price','best','compare','latest','india'];
      const health = ['symptom','pain','fever','medicine','medication','doctor','hospital','treatment','diet','exercise','injury','headache','diabetes','cancer','allergy','infection','virus','blood pressure','anxiety','depression','stress','fracture','urgent','emergency','serious','chest pain','stroke','heart attack'];
      const trigger = research.some(k => lower.includes(k)) || health.some(k => lower.includes(k));
      return trigger ? { mode: 'searching', label: 'Searching' } : { mode: 'thinking', label: 'Thinking' };
    };
    const inferred = inferLoader(finalMessage);
    setThinkingMode(inferred.mode);
    setThinkingLabel(inferred.label);
    setIsLoading(true);
    try {
      const { aiRouter } = await import('@/lib/aiRouter');
      const response = await aiRouter.route(finalMessage, chatId || undefined);
      // If router returned intake questions, open carousel UI and DO NOT insert the interim notice into chat history.
      if (response.intake && response.awaitingIntakeAnswers) {
        setIntake(response.intake);
        setAwaitingIntake(true);
        setIsLoading(false);
        return;
      }
      // Streaming / typewriter effect
      const full = response.content;
      // Persist an assistant placeholder message with healthRelated flag so it survives refresh
      let botMessageId: string | undefined;
      if (chatId) {
        botMessageId = chatStore.addMessageWithId(chatId, 'assistant', '', { healthRelated: response.isHealthRelated, sources: response.sources });
      }
      const botId = botMessageId || (Date.now() + 1).toString();
      const botMessage: Message = {
        id: botId,
        content: "",
        isBot: true,
        timestamp: new Date(),
        healthRelated: response.isHealthRelated,
        sources: response.sources
      };
      setMessages(prev => [...prev, botMessage]);
      let i = 0;
      const chunk = Math.max(1, Math.round(full.length / 32));
      let stopped = false;
      const interval = setInterval(() => {
        if (stopped) return;
        i += chunk;
        setMessages(prev => prev.map(m => m.id === botId ? { ...m, content: full.slice(0, i) } : m));
        if (scrollLocked) scrollToBottom(true);
        if (chatId && botMessageId) chatStore.updateMessage(chatId, botId, full.slice(0, i));
        if (i >= full.length) {
          clearInterval(interval);
          if (chatId && !botMessageId) chatStore.addMessage(chatId, 'assistant', full);
          // If we have a persisted placeholder, finalize it by updating content
          if (chatId && botMessageId) chatStore.updateMessage(chatId, botId, full);
          // Ensure cloud gets the finalized content
          if (chatId) chatStore.pushToCloud();
          setStreamController(null);
          setIsLoading(false);
        }
      }, 25);
      setStreamController({ stop: () => { stopped = true; clearInterval(interval); setStreamController(null); setIsLoading(false); if (chatId) {
        if (botMessageId) chatStore.updateMessage(chatId, botId, full.slice(0, i)); else chatStore.addMessage(chatId, 'assistant', full.slice(0, i));
        chatStore.pushToCloud();
      } } });
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: "I apologize, but I encountered an error while processing your request. Please try again.",
        isBot: true,
        timestamp: new Date(),
        healthRelated: false,
        sources: undefined
      };
      setMessages(prev => [...prev, errorMessage]);
      if (chatId) chatStore.addMessage(chatId, 'assistant', errorMessage.content);
    } finally {
      if (!streamController) setIsLoading(false);
    }
  };

  // Hidden submit path for intake answers: does NOT add a user message; streams assistant reply
  const submitIntake = async (jsonPayload: string) => {
    // Intake flows always escalate to search
    setThinkingMode('searching');
    setThinkingLabel('Searching');
    setIsLoading(true);
    try {
      const { aiRouter } = await import('@/lib/aiRouter');
      const response = await aiRouter.route(jsonPayload, chatId || undefined);
      if (response.intake && response.awaitingIntakeAnswers) {
        setIntake(response.intake);
        setAwaitingIntake(true);
        setIsLoading(false);
        return;
      }
      const full = response.content;
      let botMessageId: string | undefined;
      if (chatId) {
        botMessageId = chatStore.addMessageWithId(chatId, 'assistant', '', { healthRelated: response.isHealthRelated, sources: response.sources });
      }
      const botId = botMessageId || (Date.now() + 1).toString();
      const botMessage: Message = {
        id: botId,
        content: "",
        isBot: true,
        timestamp: new Date(),
        healthRelated: response.isHealthRelated,
        sources: response.sources
      };
      setMessages(prev => [...prev, botMessage]);
      let i = 0;
      const chunk = Math.max(1, Math.round(full.length / 32));
      let stopped = false;
      const interval = setInterval(() => {
        if (stopped) return;
        i += chunk;
        setMessages(prev => prev.map(m => m.id === botId ? { ...m, content: full.slice(0, i) } : m));
        if (scrollLocked) scrollToBottom(true);
        if (chatId && botMessageId) chatStore.updateMessage(chatId, botId, full.slice(0, i));
        if (i >= full.length) {
          clearInterval(interval);
          if (chatId && !botMessageId) chatStore.addMessage(chatId, 'assistant', full);
          if (chatId && botMessageId) chatStore.updateMessage(chatId, botId, full);
          if (chatId) chatStore.pushToCloud();
          setStreamController(null);
          setIsLoading(false);
        }
      }, 25);
      setStreamController({ stop: () => { stopped = true; clearInterval(interval); setStreamController(null); setIsLoading(false); if (chatId) {
        if (botMessageId) chatStore.updateMessage(chatId, botId, full.slice(0, i)); else chatStore.addMessage(chatId, 'assistant', full.slice(0, i));
        chatStore.pushToCloud();
      } } });
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: "I apologize, but I encountered an error while processing your request. Please try again.",
        isBot: true,
        timestamp: new Date(),
        healthRelated: false,
        sources: undefined
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
    <div className="flex flex-col h-full bg-background overflow-hidden" aria-busy={isLoading || chatLoading ? true : undefined} data-loading={isLoading || chatLoading ? 'true' : undefined}>
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
          <>
            <ScrollArea className="flex-1 overflow-y-auto" ref={scrollAreaRef}>
              <div className="min-h-full mx-auto px-4 sm:px-6 lg:px-8 xl:px-16 py-8" style={{ maxWidth: 900 }}>
                {messages.map((message, index) => (
                  <div key={message.id}>
                    {/* Show divider after complete exchanges (before new user questions) */}
                    {index > 0 && !message.isBot && messages[index - 1]?.isBot && (
                      <div className="border-t border-border/50 my-8" />
                    )}
                    <div className={message.isBot ? 'animate-fade-in' : ''}>
                      {!message.isBot ? (
                      <>
                        <div className="mb-6">
                          <h1 className="text-lg sm:text-xl md:text-[22px] font-normal text-foreground leading-tight">{message.content}</h1>
                        </div>
                        {/* Show sources right after question if next message is bot with sources */}
                        {messages[index + 1]?.isBot && messages[index + 1]?.sources && (
                          <SourcesDisplay sources={messages[index + 1].sources} className="mb-4" />
                        )}
                      </>
                    ) : (
                      <ChatMessage
                        message={message.content}
                        isBot={message.isBot}
                        timestamp={message.timestamp}
                        healthRelated={message.healthRelated}
                        onEdit={undefined}
                        userAvatar={undefined}
                        thinkingMode={thinkingMode}
                        thinkingLabel={thinkingLabel}
                        sources={undefined} // Don't show sources in ChatMessage anymore
                      />
                    )}
                    </div>
                  </div>
                ))}
              {/* Show loading below user message */}
              {isLoading && !streamController && messages.length > 0 && messages[messages.length - 1].isBot === false && (
                <div className="mt-8 flex justify-center">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{animationDelay: '0ms'}} />
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{animationDelay: '150ms'}} />
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{animationDelay: '300ms'}} />
                    </div>
                    <span className="text-sm">{thinkingLabel}</span>
                  </div>
                </div>
              )}
              </div>
            </ScrollArea>
            {showScrollButton && (
              <Button
                onClick={() => scrollToBottom(true)}
                className="absolute bottom-24 right-6 rounded-full shadow-lg"
                size="icon"
                variant="secondary"
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
            )}
          </>
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
        {awaitingIntake && intake && (
          <div className="fixed inset-0 z-40 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40" />
            <div className="relative w-full max-w-2xl p-6">
              <div className="bg-background rounded-lg p-6 shadow-lg">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold">Health Details</h3>
                  <span className="text-xs text-muted-foreground">
                    {(() => {
                      const total = (intake?.questions?.length ?? 0) + 1;
                      const current = Math.min(intakeIndex + 1, total);
                      return `${current}/${total}`;
                    })()}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mb-4">Answer the questions below to personalize safe guidance. You can select an option or type an answer. Use the final card to add extra conditions.</p>
                <div className="min-h-[140px]">
                  {intake.questions.length > 0 && intakeIndex < intake.questions.length ? (
                    (() => {
                      const q = intake.questions[intakeIndex];
                      return (
                        <div key={q.id} className="rounded-lg border bg-background p-4 space-y-3">
                          <p className="font-medium">{q.text}</p>
                          {Array.isArray(q.options) && q.options.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {q.options.map(opt => {
                                const active = intakeAnswers[q.id] === opt;
                                return (
                                  <button
                                    key={opt}
                                    onClick={() => setIntakeAnswers(a => ({ ...a, [q.id]: opt }))}
                                    className={`px-3 py-1 rounded text-sm border transition ${active ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted'}`}
                                  >{opt}</button>
                                );
                              })}
                            </div>
                          )}
                          <input
                            className="w-full px-3 py-2 text-sm rounded border bg-background"
                            placeholder="Type answer (or pick an option above)..."
                            value={intakeAnswers[q.id] || ''}
                            onChange={e => setIntakeAnswers(a => ({ ...a, [q.id]: e.target.value }))}
                          />
                        </div>
                      );
                    })()
                  ) : (
                    <div className="rounded-lg border bg-background p-4 space-y-3">
                      <p className="font-medium">Any additional conditions or details?</p>
                      <textarea
                        className="w-full h-28 px-3 py-2 text-sm rounded border bg-background"
                        placeholder="Enter any other symptoms, allergies, medications, or context..."
                        value={intakeAnswers['__extra'] || ''}
                        onChange={e => setIntakeAnswers(a => ({ ...a, ['__extra']: e.target.value }))}
                      />
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between gap-3 mt-4">
                  <div className="flex gap-2">
                    <button
                      onClick={() => { if (intakeIndex > 0) setIntakeIndex(i => i - 1); }}
                      className="px-3 py-1.5 rounded-md border text-sm"
                      disabled={intakeIndex === 0}
                    >Back</button>
                    {intakeIndex < intake.questions.length ? (
                      <button
                        onClick={() => { setIntakeIndex(i => Math.min(i + 1, intake.questions.length)); }}
                        className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm"
                      >Next</button>
                    ) : (
                      <button
                        onClick={() => {
                          const jsonPayload = JSON.stringify({ intakeAnswers }, null, 2);
                          setAwaitingIntake(false);
                          setIntake(null);
                          setIntakeAnswers({});
                          setIntakeIndex(0);
                          setTimeout(() => submitIntake(jsonPayload), 0);
                        }}
                        className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm"
                      >Submit All</button>
                    )}
                  </div>
                  <div className="text-sm">
                    <button
                      onClick={() => { setAwaitingIntake(false); setIntake(null); setIntakeAnswers({}); setIntakeIndex(0); }}
                      className="px-3 py-1.5 rounded-md border text-sm"
                    >I'll type instead above</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatContainer;