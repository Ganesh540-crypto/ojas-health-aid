import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import ChatHeader from "@/components/Chat/ChatHeader";
import ChatInput from "@/components/Chat/ChatInput";
import ChatMessage from "@/components/Chat/ChatMessage";
import HealthIntakeModal from "@/components/Chat/HealthIntakeModal";
import WelcomeScreen from "@/components/Chat/WelcomeScreen";
import SourcesDisplay from "@/features/chat/components/SourcesDisplay";
import { LoadingAnimation } from "@/components/ui/loading-animation";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { HealthIntakePayload } from "@/lib/healthIntake";
import { auth } from "@/lib/firebase";
import { memoryStore, type MemoryMessage } from "@/lib/memory";
import { chatStore } from "@/lib/chatStore";
import { ChevronDown } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { languageStore } from "@/lib/languageStore";
import { INDIAN_LANGUAGES, GLOBAL_LANGUAGES } from "@/lib/languages";

import type { ChatMessageAttachment, ChatMessageRecord, MetaItem, ThinkingMode } from "@/features/chat/types";
import { useChatScroll } from "@/features/chat/hooks/useChatScroll";
import { useChatTranslations } from "@/features/chat/hooks/useChatTranslations";

const ChatContainer = () => {
  const { chatId } = useParams<{ chatId: string }>();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessageRecord[]>([]);
  const [chatLoading, setChatLoading] = useState<boolean>(true);
  const [chatLoadStartedAt] = useState<number>(() => Date.now());
  const [isLoading, setIsLoading] = useState(false);
  const [streamController, setStreamController] = useState<{ stop: () => void } | null>(null);
  const [editingMessage, setEditingMessage] = useState<string>("");
  const [intake, setIntake] = useState<HealthIntakePayload | null>(null);
  const [intakeAnswers, setIntakeAnswers] = useState<Record<string,string>>({});
  const [awaitingIntake, setAwaitingIntake] = useState(false);
  const [thinkingMode, setThinkingMode] = useState<ThinkingMode>('thinking');
  const [thinkingLabel, setThinkingLabel] = useState<string>('Thinking');
  const [lastImageAttachments, setLastImageAttachments] = useState<File[] | null>(null);
  const [streamingBotId, setStreamingBotId] = useState<string | null>(null);
  const [metaByMessage, setMetaByMessage] = useState<Record<string, MetaItem[]>>({});
  const {
    i18n,
    lang,
    translatedMap,
  } = useChatTranslations({ messages, chatLoading, isLoading, streamController });

  const {
    scrollAreaRef,
    scrollLocked,
    showScrollButton,
    isUserScrolling,
    scrollToBottom,
  } = useChatScroll({ messages, isLoading, streamController, streamingBotId });

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
      const mapped: ChatMessageRecord[] = chat.messages.map(m => {
        // Restore meta items from storage
        if (m.metaItems) {
          setMetaByMessage(prev => ({ ...prev, [m.id]: m.metaItems || [] }));
        }
        // Convert stored attachment URLs to File-like objects for preview
        let attachments: ChatMessageAttachment[] | undefined;
        if (m.attachments && m.attachments.length > 0) {
          // Create fake File objects from stored metadata for preview rendering
          // Note: These won't be actual Files but have enough info for display
          attachments = m.attachments.map(att => {
            const blob = new Blob([], { type: att.type });
            const file = new File([blob], att.name, { type: att.type });
            // Store the Firebase URL and stored size on the file object for rendering
            const chatFile = file as ChatMessageAttachment;
            chatFile.firebaseUrl = att.url;
            chatFile.fileSize = att.size;
            return chatFile;
          });
        }
        return {
          id: m.id,
          content: m.content,
          isBot: m.role === 'assistant',
          timestamp: new Date(m.timestamp),
          healthRelated: typeof m.healthRelated === 'boolean' ? m.healthRelated : false,
          sources: m.sources,
          attachments,
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
    
    const userMessage: ChatMessageRecord = {
      id: messageId,
      content: finalMessage,
      isBot: false,
      timestamp: new Date(),
      attachments: files && files.length > 0 ? (files as ChatMessageAttachment[]) : undefined,
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
      setMessages(prev => [...prev, { id: botId, content: '', isBot: true, timestamp: new Date(), healthRelated: starter.isHealthRelated }]);

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
      const errorMessage: ChatMessageRecord = {
        id: (Date.now() + 1).toString(),
        content: "I apologize, but I encountered an error while processing your request. Please try again.",
        isBot: true,
        timestamp: new Date(),
        healthRelated: false,
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
      setMessages(prev => [...prev, { id: botId, content: '', isBot: true, timestamp: new Date(), healthRelated: starter.isHealthRelated }]);
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
      const errorMessage: ChatMessageRecord = {
        id: (Date.now() + 1).toString(),
        content: "I apologize, but I encountered an error while processing your request. Please try again.",
        isBot: true,
        timestamp: new Date(),
        healthRelated: false,
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
          <div className="pb-32">
            <WelcomeScreen onSendMessage={handleSendMessage} />
          </div>
        ) : (
          <>
            <ScrollArea className="flex-1 overflow-y-auto" ref={scrollAreaRef}>
              <div
                className="min-h-full mx-auto px-4 sm:px-6 lg:px-8 xl:px-16 pt-8 pb-32"
                style={{ maxWidth: 900 }}
              >
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
                          <h1 className="text-xl sm:text-[26px] md:text-[30px] font-normal text-foreground leading-tight">
                            {(() => {
                              const contentToShow = lang.code === 'en' ? message.content : (translatedMap[message.id] || message.content);
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
                className="fixed bottom-20 right-6 rounded-full shadow-lg z-30"
                size="icon"
                variant="secondary"
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
            )}
          </>
        )}
        {/* Language selector - far right side */}
        {(() => {
          const allLanguages = [...GLOBAL_LANGUAGES, ...INDIAN_LANGUAGES].filter(
            (l, i, arr) => arr.findIndex(x => x.code === l.code) === i
          );
          const selectedLabel = allLanguages.find(l => l.code === lang.code)?.label || 'English';
          return (
            <div className="fixed bottom-6 right-6 z-30">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="h-10 w-10 rounded-full font-semibold shadow-md border border-border bg-background hover:bg-muted"
                    aria-label={`Change language (current: ${selectedLabel})`}
                    title={selectedLabel}
                  >
                    {selectedLabel.charAt(0)}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64 max-h-56 overflow-y-auto bg-background">
                  {allLanguages.map((l) => (
                    <DropdownMenuItem key={l.code} onClick={() => languageStore.set(l.code)}>
                      <span className="mr-2 w-4 inline-block text-primary">{lang.code === l.code ? '✓' : ''}</span>
                      <span>{l.label}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        })()}
        {/* Input centered, matching response container width */}
        <div className="fixed bottom-0 left-[68px] right-0 bg-gradient-to-t from-background via-background/95 to-transparent pt-6 pb-4 z-20">
          <div className="mx-auto px-4 sm:px-6 lg:px-8 xl:px-16" style={{ maxWidth: 900 }}>
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


