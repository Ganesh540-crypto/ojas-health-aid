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
  scrollToShowNewMessage: () => void;
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

  // Scroll new query to top of viewport (ChatGPT/Perplexity style)
  const scrollToShowNewMessage = useCallback(() => {
    setTimeout(() => {
      const viewport = getViewport(scrollAreaRef.current);
      if (!viewport) return;

      // Find all message pairs
      const pairs = viewport.querySelectorAll('[data-message-pair]');
      if (pairs.length === 0) return;

      // Get the newest pair (last one)
      const newestPair = pairs[pairs.length - 1] as HTMLElement;
      const pairIndex = parseInt(newestPair.dataset.pairIndex || '0', 10);
      
      // Find the query heading (h1) - this is what we position at top
      const queryHeading = newestPair.querySelector('h1') as HTMLElement;
      if (!queryHeading) return;

      // Calculate scroll position to put query at top of viewport
      // Use getBoundingClientRect for accurate positioning
      const viewportRect = viewport.getBoundingClientRect();
      const queryRect = queryHeading.getBoundingClientRect();
      
      // Distance from viewport top to query
      const offsetFromTop = queryRect.top - viewportRect.top;
      
      // Target scroll = current scroll + offset (this puts query at viewport top)
      const targetScroll = viewport.scrollTop + offsetFromTop;
      
      viewport.scrollTo({ 
        top: targetScroll,
        behavior: 'smooth'
      });
      
      setIsUserScrolling(false);
    }, 150);
  }, []);

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

  // Removed auto-scroll effects - only scroll when user explicitly sends message or clicks button

  return {
    scrollAreaRef,
    scrollLocked,
    showScrollButton,
    isUserScrolling,
    scrollToBottom,
    scrollToShowNewMessage,
  };
};
