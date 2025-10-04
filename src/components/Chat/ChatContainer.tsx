import React, { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ChatHeader from "./ChatHeader";
// Controls moved to settings; no per-chat UI bar now.
import ChatMessage from "./ChatMessage";
import ChatInput from "./ChatInput";
import HealthIntakeModal from "./HealthIntakeModal";
import SourcesDisplay from "./SourcesDisplay";
import WelcomeScreen from "@/components/Chat/WelcomeScreen";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, AlertTriangle, ChevronDown } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { LoadingAnimation } from "@/components/ui/loading-animation";
import type { HealthIntakePayload } from '@/lib/healthIntake';
import { memoryStore, type MemoryMessage } from "@/lib/memory";
import { auth } from "@/lib/firebase";
import { profileStore } from "@/lib/profileStore";
import { chatStore } from "@/lib/chatStore";
import { languageStore } from "@/lib/languageStore";
import { azureTranslator } from "@/lib/azureTranslator";

interface Message {
  id: string;
  content: string;
  isBot: boolean;
  timestamp: Date;
  healthRelated?: boolean;
  sources?: Array<{ title: string; url: string; snippet?: string; displayUrl?: string }>;
  attachments?: File[];
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
  const [stickyQuery, setStickyQuery] = useState<{ content: string; isVisible: boolean } | null>(null);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout>();
  const [editingMessage, setEditingMessage] = useState<string>("");
  const [profile, setProfile] = useState(() => profileStore.get());
  const [intake, setIntake] = useState<HealthIntakePayload | null>(null);
  const [intakeAnswers, setIntakeAnswers] = useState<Record<string,string>>({});
  const [awaitingIntake, setAwaitingIntake] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [thinkingMode, setThinkingMode] = useState<'routing' | 'thinking' | 'searching' | 'analyzing'>('thinking');
  const [thinkingLabel, setThinkingLabel] = useState<string>('Thinking');
  const [lastImageAttachments, setLastImageAttachments] = useState<File[] | null>(null);
  const [lang, setLang] = useState(() => languageStore.get());
  const [translatedMap, setTranslatedMap] = useState<Record<string, string>>({});
  const [streamingBotId, setStreamingBotId] = useState<string | null>(null);
  type MetaItem = { type: 'step' | 'thought' | 'search_query'; text?: string; query?: string; ts?: number };
  const [metaByMessage, setMetaByMessage] = useState<Record<string, MetaItem[]>>({});
  const [metaOpen, setMetaOpen] = useState<Record<string, boolean>>({});
  const [i18n, setI18n] = useState({
    loadingChat: 'Loading chat…',
    reload: 'Reload',
    healthDetails: 'Health Details',
    answerIntro: 'Answer the questions below to personalize safe guidance. You can select an option or type an answer. Use the final card to add extra conditions.',
    anyAdditional: 'Any additional conditions or details?',
    typeExtraPlaceholder: 'Enter any other symptoms, allergies, medications, or context...',
    back: 'Back',
    next: 'Next',
    submitAll: 'Submit All',
    typeInstead: "I'll type instead above",
    thinking: 'Thinking',
    searching: 'Searching',
    analyzing: 'Analyzing',
  });

  const scrollToBottom = (smooth = true, force = false) => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        // Don't auto-scroll if user is scrolling and not forced
        if (isUserScrolling && !force) return;
        
        requestAnimationFrame(() => {
          if (smooth) {
            scrollContainer.scrollTo({ top: scrollContainer.scrollHeight, behavior: 'smooth' });
          } else {
            scrollContainer.scrollTop = scrollContainer.scrollHeight;
          }
          setIsUserScrolling(false);
        });
      }
    }
  };

  // Smart scroll behavior
  useEffect(() => {
    const scrollContainer = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (!scrollContainer) return;
    
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainer as HTMLElement;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      const isNearBottom = distanceFromBottom < 100;
      
      // Clear timeout on any scroll
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      
      if (!isNearBottom) {
        setIsUserScrolling(true);
        setShowScrollButton(true);
      } else {
        setShowScrollButton(false);
        scrollTimeoutRef.current = setTimeout(() => {
          setIsUserScrolling(false);
        }, 300);
      }
      
      // Show sticky query only when far from bottom (like Perplexity)
      const userMessages = messages.filter(m => !m.isBot);
      const lastUserMessage = userMessages[userMessages.length - 1];
      const showSticky = distanceFromBottom > 400;
      if (showSticky && lastUserMessage) {
        setStickyQuery({ 
          content: lastUserMessage.content.substring(0, 80),
          isVisible: true 
        });
      } else {
        setStickyQuery(null);
      }
    };
    
    scrollContainer.addEventListener('scroll', handleScroll);
    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, [messages]);
  
  // Auto-scroll only for new messages when at bottom
  useEffect(() => {
    if (messages.length > 0 && !isUserScrolling) {
      const lastMessage = messages[messages.length - 1];
      // Scroll for new user queries or bot messages
      if (!lastMessage.isBot || streamingBotId) {
        const timer = setTimeout(() => {
          scrollToBottom(true);
        }, 100);
        return () => clearTimeout(timer);
      }
    }
  }, [messages, isUserScrolling, streamingBotId]);

  // Language subscription
  useEffect(() => {
    const unsub = languageStore.subscribe((l) => setLang(l));
    return () => { unsub(); };
  }, []);

  // Update UI translations on language change
  useEffect(() => {
    let cancelled = false;
    const update = async () => {
      const to = lang?.code || 'en';
      if (to === 'en') {
        setI18n({
          loadingChat: 'Loading chat…', reload: 'Reload', healthDetails: 'Health Details',
          answerIntro: 'Answer the questions below to personalize safe guidance. You can select an option or type an answer. Use the final card to add extra conditions.',
          anyAdditional: 'Any additional conditions or details?',
          typeExtraPlaceholder: 'Enter any other symptoms, allergies, medications, or context...',
          back: 'Back', next: 'Next', submitAll: 'Submit All', typeInstead: "I'll type instead above",
          thinking: 'Thinking', searching: 'Searching', analyzing: 'Analyzing'
        });
        return;
      }
      const texts = [
        'Loading chat…', 'Reload', 'Health Details',
        'Answer the questions below to personalize safe guidance. You can select an option or type an answer. Use the final card to add extra conditions.',
        'Any additional conditions or details?',
        'Enter any other symptoms, allergies, medications, or context...',
        'Back', 'Next', 'Submit All', "I'll type instead above",
        'Thinking', 'Searching', 'Analyzing'
      ];
      try {
        const out = await azureTranslator.translateBatch(texts, { to });
        if (cancelled) return;
        setI18n({
          loadingChat: out[0], reload: out[1], healthDetails: out[2],
          answerIntro: out[3], anyAdditional: out[4], typeExtraPlaceholder: out[5],
          back: out[6], next: out[7], submitAll: out[8], typeInstead: out[9],
          thinking: out[10], searching: out[11], analyzing: out[12]
        });
      } catch {
        // fallback noop
      }
    };
    update();
    return () => { cancelled = true; };
  }, [lang]);

  // Translate existing messages when language changes or after generation completes
  const rebuildTranslations = async () => {
    const to = lang?.code || 'en';
    if (to === 'en') { setTranslatedMap({}); return; }
    const ids: string[] = [];
    const texts: string[] = [];
    for (const m of messages) {
      ids.push(m.id);
      texts.push(m.content);
    }
    try {
      const out = await azureTranslator.translateBatch(texts, { to });
      const map: Record<string, string> = {};
      ids.forEach((id, i) => { map[id] = out[i]; });
      setTranslatedMap(map);
    } catch {
      // ignore
    }
  };

  useEffect(() => { if (!chatLoading) { void rebuildTranslations(); } }, [lang, chatLoading]);
  useEffect(() => { if (!isLoading && !streamController) { void rebuildTranslations(); } }, [isLoading, streamController]);

  useEffect(() => {
    if (scrollLocked) scrollToBottom();
  }, [messages, scrollLocked]);

  // Auto-scroll detection
  useEffect(() => {
    const scrollContainer = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (!scrollContainer) return;
    
    let scrollTimer: NodeJS.Timeout;
    const handleScroll = () => {
      // Debounce scroll events to prevent bouncing
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        const { scrollTop, scrollHeight, clientHeight } = scrollContainer as HTMLElement;
        const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
        
        // Don't update scroll state while streaming to prevent bouncing
        if (!isLoading && !streamController) {
          setShouldAutoScroll(isAtBottom);
          setScrollLocked(isAtBottom);
        }
        setShowScrollButton(!isAtBottom);
      }, 50);
    };
    
    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      clearTimeout(scrollTimer);
      scrollContainer.removeEventListener('scroll', handleScroll);
    };
  }, [isLoading, streamController]);

  // Reset sticky query when switching chats or after new messages
  useEffect(() => { setStickyQuery(null); }, [chatId, messages.length]);

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
      const mapped: Message[] = chat.messages.map(m => {
        // Restore meta items from storage
        if (m.metaItems) {
          setMetaByMessage(prev => ({ ...prev, [m.id]: m.metaItems || [] }));
        }
        // Convert stored attachment URLs to File-like objects for preview
        let attachments: File[] | undefined;
        if (m.attachments && m.attachments.length > 0) {
          // Create fake File objects from stored metadata for preview rendering
          // Note: These won't be actual Files but have enough info for display
          attachments = m.attachments.map(att => {
            const blob = new Blob([], { type: att.type });
            const file = new File([blob], att.name, { type: att.type });
            // Store the Firebase URL and stored size on the file object for rendering
            (file as any).firebaseUrl = att.url;
            (file as any).fileSize = att.size;
            return file;
          });
        }
        return {
          id: m.id,
          content: m.content,
          isBot: m.role === 'assistant',
          timestamp: new Date(m.timestamp),
          healthRelated: typeof m.healthRelated === 'boolean' ? m.healthRelated : false,
          sources: m.sources,
          attachments
        };
      });
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
    
    // Do NOT append bracketed file strings to the message. We pass files to the router
    // and show visual previews in the UI instead.

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

    const messageId = Date.now().toString();
    let uploadedAttachments: Array<{ url: string; name: string; type: string; size: number }> | undefined;
    
    // Upload files to Firebase Storage if present
    if (files && files.length > 0 && chatId) {
      try {
        uploadedAttachments = [];
        for (const file of files) {
          const attachment = await chatStore.uploadAttachment(file, chatId, messageId);
          uploadedAttachments.push(attachment);
        }
      } catch (err) {
        console.error('Failed to upload attachments:', err);
        // Fall back to local files if upload fails
      }
    }
    
    const userMessage: Message = {
      id: messageId,
      content: finalMessage,
      isBot: false,
      timestamp: new Date(),
      attachments: files && files.length > 0 ? files : undefined
    };

    setMessages(prev => [...prev, userMessage]);
    if (chatId) {
      chatStore.addMessage(chatId, 'user', finalMessage, uploadedAttachments);
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
    // Always show a brief Routing phase first
    setThinkingMode('routing');
    setThinkingLabel('Routing');
    setIsLoading(true);
    // Clear any previous meta for smooth transitions
    setMetaByMessage({});
    setMetaOpen({});
    try {
      const { aiRouter } = await import('@/lib/aiRouter');
      // Decide which files to send to AI. If none provided, but the message refers to images and we have
      // recent image attachments, reuse them so the model can see the same image in follow-ups.
      const imageFiles = (files || []).filter(f => f.type.startsWith('image/'));
      const mentionsImage = /\b(image|photo|picture|screenshot)\b/i.test(finalMessage) || /\bin the (image|photo|picture)\b/i.test(finalMessage);
      let filesForAI: File[] | undefined = undefined;
      if (imageFiles.length > 0) {
        filesForAI = imageFiles;
        setLastImageAttachments(imageFiles);
      } else if (!files || files.length === 0) {
        if (mentionsImage && lastImageAttachments && lastImageAttachments.length > 0) {
          filesForAI = lastImageAttachments;
        }
      }
      const routed = await aiRouter.routeStream(finalMessage, chatId || undefined, { files: filesForAI } as any);
      // Intake path
      if ((routed as any).intake && (routed as any).awaitingIntakeAnswers) {
        const r = routed as any;
        // Show health intake transition
        setThinkingMode('analyzing');
        setThinkingLabel('Preparing health questions');
        // Keep loading visible for transition
        setTimeout(() => {
          setIntake(r.intake);
          setAwaitingIntake(true);
          setIsLoading(false);
        }, 400);
        return;
      }
      const starter = routed as { model: 'lite' | 'health'; isHealthRelated: boolean; start: (onChunk: (delta: string) => void, onEvent?: (evt: any) => void) => { stop: () => void; finished: Promise<{ content: string; isHealthRelated: boolean; sources?: Array<{ title: string; url: string; snippet?: string; displayUrl?: string }> }> } };
      // Create assistant placeholder
      let botMessageId: string | undefined;
      if (chatId) {
        botMessageId = chatStore.addMessageWithId(chatId, 'assistant', '', { healthRelated: starter.isHealthRelated });
      }
      const botId = botMessageId || (Date.now() + 1).toString();
      setMessages(prev => [...prev, { id: botId, content: '', isBot: true, timestamp: new Date(), healthRelated: starter.isHealthRelated, sources: undefined }]);

      // Start streaming
      let accumulated = '';
      // Transition to Thinking once routing hands over to a model
      setThinkingMode('thinking');
      setThinkingLabel('Thinking');
      setStreamingBotId(botId);
      setMetaByMessage(prev => ({ ...prev, [botId]: [] }));
      const metaAcc: MetaItem[] = [];
      const controller = starter.start((delta: string) => {
        accumulated += delta || '';
        setMessages(prev => prev.map(m => m.id === botId ? { ...m, content: accumulated } : m));
        if (scrollLocked) scrollToBottom(false);
        if (chatId && botMessageId) chatStore.updateMessage(chatId, botId, accumulated);
      }, (evt?: any) => {
        if (!evt) return;
        setMetaByMessage(prev => {
          const arr = prev[botId] ? [...prev[botId]] : [];
          if (evt.type === 'thought' && typeof evt.text === 'string') {
            arr.push({ type: 'thought', text: evt.text, ts: Date.now() });
            metaAcc.push({ type: 'thought', text: evt.text, ts: Date.now() });
          }
          if (evt.type === 'search_query' && typeof evt.query === 'string') {
            // Show searching state and record the query
            setThinkingMode('searching');
            setThinkingLabel('Searching');
            arr.push({ type: 'search_query', query: evt.query, ts: Date.now() });
            metaAcc.push({ type: 'search_query', query: evt.query, ts: Date.now() });
          }
          // Cap to last 50 items to avoid bloat
          const capped = arr.slice(-50);
          // Don't save during streaming to avoid excessive writes
          return { ...prev, [botId]: capped };
        });
      });
      setStreamController({ stop: controller.stop });
      const finished = await controller.finished;
      // Finalize content and sources
      const finalText = finished.content || accumulated;
      const finalMetaItems = metaAcc.length > 0 ? metaAcc : (metaByMessage[botId] || []);
      setMessages(prev => prev.map(m => m.id === botId ? { ...m, content: finalText, sources: finished.sources } : m));
      if (chatId) {
        if (!botMessageId) chatStore.addMessage(chatId, 'assistant', finalText);
        else chatStore.updateMessage(chatId, botId, finalText);
        if (finished.sources && finished.sources.length > 0) {
          chatStore.updateMessageSources(chatId, botId, finished.sources);
        }
        // Save meta items to Firebase for persistence
        if (finalMetaItems.length > 0) {
          chatStore.updateMessageMeta(chatId, botId, finalMetaItems);
        }
        chatStore.pushToCloud();
      }
      setStreamingBotId(null);
      
      setStreamController(null);
      setIsLoading(false);
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
      const routed = await aiRouter.routeStream(jsonPayload, chatId || undefined);
      if ((routed as any).intake && (routed as any).awaitingIntakeAnswers) {
        const r = routed as any;
        setIntake(r.intake);
        setAwaitingIntake(true);
        setIsLoading(false);
        return;
      }
      const starter = routed as { model: 'lite' | 'health'; isHealthRelated: boolean; start: (onChunk: (delta: string) => void, onEvent?: (evt: any) => void) => { stop: () => void; finished: Promise<{ content: string; isHealthRelated: boolean; sources?: Array<{ title: string; url: string; snippet?: string; displayUrl?: string }> }> } };
      let botMessageId: string | undefined;
      if (chatId) {
        botMessageId = chatStore.addMessageWithId(chatId, 'assistant', '', { healthRelated: starter.isHealthRelated });
      }
      const botId = botMessageId || (Date.now() + 1).toString();
      setMessages(prev => [...prev, { id: botId, content: '', isBot: true, timestamp: new Date(), healthRelated: starter.isHealthRelated, sources: undefined }]);
      let accumulated = '';
      setThinkingMode('thinking');
      setThinkingLabel('Analyzing health context');
      setStreamingBotId(botId);
      setMetaByMessage(prev => ({ ...prev, [botId]: [] }));
      const metaAcc: MetaItem[] = [];
      const controller = starter.start((delta: string) => {
        accumulated += delta || '';
        setMessages(prev => prev.map(m => m.id === botId ? { ...m, content: accumulated } : m));
        if (scrollLocked) scrollToBottom(false);
        if (chatId && botMessageId) chatStore.updateMessage(chatId, botId, accumulated);
      }, (evt?: any) => {
        if (!evt) return;
        setMetaByMessage(prev => {
          const arr = prev[botId] ? [...prev[botId]] : [];
          if (evt.type === 'thought' && typeof evt.text === 'string') {
            arr.push({ type: 'thought', text: evt.text, ts: Date.now() });
            metaAcc.push({ type: 'thought', text: evt.text, ts: Date.now() });
          }
          if (evt.type === 'search_query' && typeof evt.query === 'string') {
            setThinkingMode('searching');
            setThinkingLabel('Searching');
            arr.push({ type: 'search_query', query: evt.query, ts: Date.now() });
            metaAcc.push({ type: 'search_query', query: evt.query, ts: Date.now() });
          }
          return { ...prev, [botId]: arr.slice(-50) };
        });
      });
      setStreamController({ stop: controller.stop });
      const finished = await controller.finished;
      const finalText = finished.content || accumulated;
      const finalMetaItems = metaAcc.length > 0 ? metaAcc : (metaByMessage[botId] || []);
      setMessages(prev => prev.map(m => m.id === botId ? { ...m, content: finalText, sources: finished.sources } : m));
      if (chatId) {
        if (!botMessageId) chatStore.addMessage(chatId, 'assistant', finalText);
        else chatStore.updateMessage(chatId, botId, finalText);
        if (finished.sources && finished.sources.length > 0) {
          chatStore.updateMessageSources(chatId, botId, finished.sources);
        }
        // Save meta items to Firebase for persistence
        if (finalMetaItems.length > 0) {
          chatStore.updateMessageMeta(chatId, botId, finalMetaItems);
        }
        chatStore.pushToCloud();
      }
      setStreamingBotId(null);
      
      setStreamController(null);
      setIsLoading(false);
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
    <div className="flex flex-col h-full bg-background overflow-hidden" style={{ backgroundColor: '#fff' }} aria-busy={isLoading || chatLoading ? true : undefined} data-loading={isLoading || chatLoading ? 'true' : undefined}>
      <ChatHeader />
      {/* Controls removed; managed in Settings dialog */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            {chatLoading && (
              <div className="flex-1 flex flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
            <span>{i18n.loadingChat}</span>
              {Date.now() - chatLoadStartedAt > 3000 && (
                <button onClick={() => window.location.reload()} className="text-primary underline">{i18n.reload}</button>
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
                  <div 
                    key={message.id}
                    data-message-id={message.id}
                    data-message-role={message.isBot ? 'assistant' : 'user'}
                    data-message-content={message.content}
                  >
                    {/* Show divider after complete exchanges (before new user questions) */}
                    {index > 0 && !message.isBot && messages[index - 1]?.isBot && (
                      <div className="border-t border-border/80 my-8" />
                    )}
                    <div className={message.isBot ? 'animate-fade-in' : ''}>
                      {!message.isBot ? (
                      <>
                        <div className="mb-6">
                          <h1 className="text-lg sm:text-xl md:text-[22px] font-normal text-foreground leading-tight">
                            {(() => {
                              // Use translated content if language selected
                              const contentToShow = lang.code === 'en' ? message.content : (translatedMap[message.id] || message.content);
                              // Auto-link URLs in the content
                              const linkRegex = /(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:[\/?#][^\s]*)?/gi;
                              const contentParts = contentToShow.split(linkRegex);
                              const matchesFinal = contentToShow.match(linkRegex) || [];
                              return contentParts.map((part, i) => (
                                <React.Fragment key={i}>
                                  {part}
                                  {matchesFinal[i] && (
                                    <a 
                                      href={matchesFinal[i].startsWith('http') ? matchesFinal[i] : `https://${matchesFinal[i]}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-orange-500 hover:text-orange-600 underline underline-offset-2 inline-flex items-center gap-1"
                                    >
                                      {matchesFinal[i]}
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                      </svg>
                                    </a>
                                  )}
                                </React.Fragment>
                              ));
                            })()}
                          </h1>
                        </div>
                        {Array.isArray(message.attachments) && message.attachments.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {message.attachments.map((file, i) => {
                              const isImage = file.type.startsWith('image/');
                              const isPdf = file.type === 'application/pdf';
                              // Use Firebase URL if available, otherwise create object URL
                              const url = isImage ? ((file as any).firebaseUrl || URL.createObjectURL(file)) : undefined;
                              const fileSize = (file as any).fileSize ?? file.size;
                              return (
                                <div key={i} className="border rounded-md bg-muted p-2 flex items-center gap-2">
                                  {isImage ? (
                                    <img src={url} alt={file.name} className="w-20 h-20 object-cover rounded" />
                                  ) : (
                                    <div className="w-10 h-10 flex items-center justify-center bg-muted rounded text-xs">
                                      {isPdf ? 'PDF' : (file.type?.split('/')?.[1] || 'FILE').toUpperCase()}
                                    </div>
                                  )}
                                  <div className="min-w-0">
                                    <div className="text-xs font-medium truncate max-w-[220px]">{file.name}</div>
                                    <div className="text-[10px] text-muted-foreground">{(fileSize / 1024 / 1024).toFixed(2)} MB</div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        {/* Show sources right after question if next message is bot with sources */}
                        {messages[index + 1]?.isBot && messages[index + 1]?.sources && (
                          <SourcesDisplay sources={messages[index + 1].sources} className="mb-4" />
                        )}
                      </>
                    ) : (
                      <ChatMessage
                        message={lang.code === 'en' ? message.content : (translatedMap[message.id] || message.content)}
                        isBot={message.isBot}
                        timestamp={message.timestamp}
                        isThinking={streamingBotId === message.id}
                        healthRelated={message.healthRelated}
                        onEdit={undefined}
                        userAvatar={undefined}
                        thinkingMode={thinkingMode}
                        thinkingLabel={thinkingLabel}
                        sources={undefined}
                        metaItems={metaByMessage[message.id]}
                        metaOpen={false}
                        onToggleMeta={undefined}
                      />
                    )}
                    </div>
                  </div>
                ))}
              {/* Show loading below user message */}
              {isLoading && !streamController && messages.length > 0 && messages[messages.length - 1].isBot === false && (
                <div className="mt-8 w-full max-w-3xl mx-auto">
                  <div className="w-full">
                    <div className="mb-3">
                      <LoadingAnimation 
                        mode={thinkingMode}
                        label={thinkingLabel}
                        className="" 
                      />
                    </div>
                  </div>
                </div>
              )}
              </div>
            </ScrollArea>
            {showScrollButton && (
              <Button
                onClick={() => scrollToBottom(true, true)}
                className="absolute bottom-24 right-6 rounded-full shadow-lg z-10"
                size="icon"
                variant="secondary"
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
            )}
            {/* Sticky Query (compact pill, only visible when scrolled) */}
            {stickyQuery?.isVisible && stickyQuery.content && (
              <div className="absolute top-0 left-0 right-0 z-10 flex justify-center pt-2 pointer-events-none">
                <div className="pointer-events-auto max-w-[80%] px-3 py-1.5 rounded-full bg-background/95 border shadow-sm text-xs text-foreground/80 truncate">
                  {stickyQuery.content}
                </div>
              </div>
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
          <HealthIntakeModal
            questions={intake.questions}
            onSubmit={(answers) => {
              const jsonPayload = JSON.stringify({ intakeAnswers: answers }, null, 2);
              setAwaitingIntake(false);
              setIntake(null);
              setIntakeAnswers({});
              setTimeout(() => submitIntake(jsonPayload), 0);
            }}
            onClose={() => {
              setAwaitingIntake(false);
              setIntake(null);
              setIntakeAnswers({});
            }}
          />
        )}
      </div>
    </div>
  );
};

export default ChatContainer;


