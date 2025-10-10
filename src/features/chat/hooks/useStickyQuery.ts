import { useEffect, useState } from 'react';

import type { ChatMessageRecord } from '@/features/chat/types';

export interface StickyQueryState {
  content: string;
  isVisible: boolean;
}

interface UseStickyQueryArgs {
  messages: ChatMessageRecord[];
  distanceFromBottom: number;
}

export const useStickyQuery = ({
  messages,
  distanceFromBottom,
}: UseStickyQueryArgs): StickyQueryState | null => {
  const [stickyQuery, setStickyQuery] = useState<StickyQueryState | null>(null);

  useEffect(() => {
    const userMessages = messages.filter((m) => !m.isBot);
    const lastUserMessage = userMessages[userMessages.length - 1];
    const showSticky = distanceFromBottom > 400;

    if (showSticky && lastUserMessage) {
      setStickyQuery({
        content: lastUserMessage.content.substring(0, 80),
        isVisible: true,
      });
    } else {
      setStickyQuery(null);
    }
  }, [messages, distanceFromBottom]);

  return stickyQuery;
};
