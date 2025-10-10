import { useCallback, useEffect, useRef, useState } from 'react';

import type { ChatMessageRecord } from '@/features/chat/types';

interface UseChatScrollArgs {
  messages: ChatMessageRecord[];
  isLoading: boolean;
  streamController: { stop: () => void } | null;
  streamingBotId: string | null;
}

interface UseChatScrollResult {
  scrollAreaRef: React.RefObject<HTMLDivElement>;
  scrollLocked: boolean;
  showScrollButton: boolean;
  isUserScrolling: boolean;
  scrollToBottom: (smooth?: boolean, force?: boolean) => void;
}

const VIEWPORT_SELECTOR = '[data-radix-scroll-area-viewport]';

const getViewport = (container: HTMLDivElement | null): HTMLElement | null =>
  (container?.querySelector(VIEWPORT_SELECTOR) as HTMLElement | null) ?? null;

export const useChatScroll = ({
  messages,
  isLoading,
  streamController,
  streamingBotId,
}: UseChatScrollArgs): UseChatScrollResult => {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [scrollLocked, setScrollLocked] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const trailingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollToBottom = useCallback(
    (smooth = true, force = false) => {
      const viewport = getViewport(scrollAreaRef.current);
      if (!viewport) return;
      if (isUserScrolling && !force) return;

      const top = viewport.scrollHeight;
      viewport.scrollTo({ top, behavior: smooth ? 'smooth' : 'auto' });
      setIsUserScrolling(false);
    },
    [isUserScrolling]
  );

  useEffect(() => {
    const viewport = getViewport(scrollAreaRef.current);
    if (!viewport) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = viewport;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      const nearBottom = distanceFromBottom < 100;

      if (trailingTimerRef.current) {
        clearTimeout(trailingTimerRef.current);
        trailingTimerRef.current = null;
      }

      if (!nearBottom) {
        setIsUserScrolling(true);
        setShowScrollButton(true);
      } else {
        setShowScrollButton(false);
        trailingTimerRef.current = setTimeout(() => {
          setIsUserScrolling(false);
          trailingTimerRef.current = null;
        }, 180);
      }

      setScrollLocked(nearBottom);
    };

    viewport.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => {
      if (trailingTimerRef.current) {
        clearTimeout(trailingTimerRef.current);
        trailingTimerRef.current = null;
      }
      viewport.removeEventListener('scroll', handleScroll);
    };
  }, [isLoading, streamController, messages.length]);

  useEffect(() => {
    if (messages.length === 0 || isUserScrolling) return;
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage.isBot || streamingBotId) {
      const timer = setTimeout(() => {
        scrollToBottom(true);
      }, 120);
      return () => clearTimeout(timer);
    }
  }, [messages, isUserScrolling, streamingBotId, scrollToBottom]);

  useEffect(() => {
    if (scrollLocked) {
      scrollToBottom(false);
    }
  }, [messages, scrollLocked, scrollToBottom]);

  return {
    scrollAreaRef,
    scrollLocked,
    showScrollButton,
    isUserScrolling,
    scrollToBottom,
  };
};
