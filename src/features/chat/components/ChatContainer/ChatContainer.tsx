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
import { languageStore } from "@/lib/languageStore";
import { LanguageSelector } from "@/components/ui/language-selector";

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
  const [showIntakeModal, setShowIntakeModal] = useState(false);
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
    scrollToShowNewMessage,
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
        // Delegate fallback selection/creation to Index route to avoid duplicate logic
        navigate('/app', { replace: true });
        setChatLoading(false);
        return;
      }
      if (cancelled) return;
      
      // Restore pending health intake if exists
      if (chat.pendingIntake) {
        setIntake(chat.pendingIntake as any);
        setAwaitingIntake(true);
        setShowIntakeModal(false);
      }
      
      // Restore meta items from storage
      const restoredMeta: Record<string, MetaItem[]> = {};
      chat.messages.forEach(m => {
        if (m.metaItems && m.metaItems.length > 0) {
          restoredMeta[m.id] = m.metaItems;
        }
      });
      if (Object.keys(restoredMeta).length > 0) {
        setMetaByMessage(restoredMeta);
      }
      
      const mapped: ChatMessageRecord[] = chat.messages.map(m => {
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
      setShowIntakeModal(false);
      setIntake(null);
      setIntakeAnswers({});
      // Clear pending intake from storage
      if (chatId) chatStore.clearPendingIntake(chatId);
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
    
    // Scroll new query to top of viewport
    scrollToShowNewMessage();
    
    // Show routing state
    setThinkingMode('routing');
    setThinkingLabel('Routing');
    setIsLoading(true);
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
      const routed = await aiRouter.routeStream(finalMessage, chatId || undefined, { 
        files: filesForAI,
        onStatusChange: (status) => {
          if (status === 'preparing_intake') {
            setThinkingMode('analyzing');
            setThinkingLabel('Preparing health intake');
          } else if (status === 'analyzing_health') {
            setThinkingMode('analyzing');
            setThinkingLabel('Analyzing health context');
          }
        }
      } as any);
      // Intake path
      if ((routed as any).intake && (routed as any).awaitingIntakeAnswers) {
        const r = routed as any;
        // Intake questions are ready - save and show them
        setIntake(r.intake);
        setAwaitingIntake(true);
        setShowIntakeModal(true); // Show modal immediately when generated
        setIsLoading(false);
        
        // Save pending intake to persist across refreshes
        if (chatId) {
          chatStore.setPendingIntake(chatId, {
            questions: r.intake.questions,
            userMessage: message,
            createdAt: Date.now()
          });
        }
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
            setThinkingLabel(starter.isHealthRelated ? 'Searching medical sources' : 'Searching');
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
        if (finalMetaItems && finalMetaItems.length > 0) {
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
    // Intake answers submitted - show analyzing state
    setThinkingMode('analyzing');
    setThinkingLabel('Analyzing health context');
    setIsLoading(true);
    try {
      const { aiRouter } = await import('@/lib/aiRouter');
      const routed = await aiRouter.routeStream(jsonPayload, chatId || undefined, {
        onStatusChange: (status) => {
          if (status === 'analyzing_health') {
            setThinkingMode('searching');
            setThinkingLabel('Searching medical sources');
          }
        }
      } as any);
      if ((routed as any).intake && (routed as any).awaitingIntakeAnswers) {
        const r = routed as any;
        setIntake(r.intake);
        setAwaitingIntake(true);
        setShowIntakeModal(true);
        setIsLoading(false);
        
        // Save pending intake (for submitIntake path)
        if (chatId) {
          chatStore.setPendingIntake(chatId, {
            questions: r.intake.questions,
            userMessage: '', // No original message in intake submission
            createdAt: Date.now()
          });
        }
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
            setThinkingLabel('Searching medical sources');
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
        if (finalMetaItems && finalMetaItems.length > 0) {
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
                className="min-h-full mx-auto px-4 sm:px-6 lg:px-8 xl:px-16 pb-32"
                style={{ maxWidth: 900 }}
              >
                {(() => {
                  // Group messages into pairs: each user message + its bot response
                  const pairs: Array<{ userMsg: ChatMessageRecord; botMsg?: ChatMessageRecord; pairIndex: number }> = [];
                  
                  for (let i = 0; i < messages.length; i++) {
                    const msg = messages[i];
                    if (!msg.isBot) {
                      // This is a user message, check if next is bot response
                      const nextMsg = messages[i + 1];
                      pairs.push({
                        userMsg: msg,
                        botMsg: nextMsg?.isBot ? nextMsg : undefined,
                        pairIndex: pairs.length
                      });
                      // Skip the bot message in next iteration if it exists
                      if (nextMsg?.isBot) i++;
                    }
                  }
                  
                  return pairs.map((pair, pairIdx) => (
                    <div
                      key={`pair-${pair.userMsg.id}`}
                      data-message-pair
                      data-pair-index={pairIdx}
                      data-user-message-id={pair.userMsg.id}
                      data-bot-message-id={pair.botMsg?.id}
                      className={pairIdx === 0 ? "w-full pt-8" : "w-full"}
                    >
                      {/* Divider at top of pair (except first pair) */}
                      {pairIdx > 0 && (
                        <div className="border-t border-border/80 my-8" />
                      )}
                      
                      {/* User Query */}
                      <div className="mb-6">
                        <h1 className="text-xl sm:text-[26px] md:text-[30px] font-normal text-foreground leading-tight">
                          {(() => {
                            const contentToShow = lang.code === 'en' ? pair.userMsg.content : (translatedMap[pair.userMsg.id] || pair.userMsg.content);
                            const linkRegex = /(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:[\/\?#][^\s]*)?/gi;
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
                      
                      {/* Attachments */}
                      {Array.isArray(pair.userMsg.attachments) && pair.userMsg.attachments.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {pair.userMsg.attachments.map((file, i) => {
                            const isImage = file.type.startsWith('image/');
                            const isPdf = file.type === 'application/pdf';
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
                      
                      {/* Sources Display */}
                      {pair.botMsg?.sources && (
                        <SourcesDisplay sources={pair.botMsg.sources} className="mb-4" />
                      )}
                      
                      {/* Bot Response */}
                      {pair.botMsg && (
                        <div className="animate-fade-in">
                          <ChatMessage
                            message={lang.code === 'en' ? pair.botMsg.content : (translatedMap[pair.botMsg.id] || pair.botMsg.content)}
                            isBot={pair.botMsg.isBot}
                            timestamp={pair.botMsg.timestamp}
                            isThinking={streamingBotId === pair.botMsg.id}
                            healthRelated={pair.botMsg.healthRelated}
                            onEdit={undefined}
                            userAvatar={undefined}
                            thinkingMode={thinkingMode}
                            thinkingLabel={thinkingLabel}
                            sources={pair.botMsg.sources}
                            metaItems={metaByMessage[pair.botMsg.id]}
                            metaOpen={false}
                            onToggleMeta={undefined}
                          />
                        </div>
                      )}
                    </div>
                  ));
                })()}
              {/* Health Intake Button - shows right after last message */}
              {awaitingIntake && intake && !showIntakeModal && (
                <div className="w-full max-w-3xl mx-auto mt-4 mb-2 animate-in fade-in duration-300">
                  <button
                    onClick={() => setShowIntakeModal(true)}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs bg-gradient-to-r from-orange-500 to-primary text-white rounded-full shadow-sm hover:shadow-md transition-all duration-200 hover:scale-[1.02] font-medium mx-auto"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Answer Health Questions
                  </button>
                </div>
              )}
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
        <LanguageSelector />
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

        {/* Health Intake Modal */}
        {awaitingIntake && intake && showIntakeModal && (
          <HealthIntakeModal
            questions={intake.questions}
            onSubmit={(answers) => {
              const jsonPayload = JSON.stringify({ intakeAnswers: answers }, null, 2);
              setAwaitingIntake(false);
              setShowIntakeModal(false);
              setIntake(null);
              setIntakeAnswers({});
              // Clear pending intake from storage
              if (chatId) chatStore.clearPendingIntake(chatId);
              setTimeout(() => submitIntake(jsonPayload), 0);
            }}
            onClose={() => {
              // Just close modal, keep intake pending (user can reopen with button)
              setShowIntakeModal(false);
            }}
          />
        )}
      </div>
    </div>
  );
};

export default ChatContainer;


