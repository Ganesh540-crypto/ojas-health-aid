export type ChatMessageRole = 'user' | 'assistant';

export interface ChatMessageItem {
  id: string;
  role: ChatMessageRole;
  content: string;
  timestamp: number;
}

export interface Chat {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessageItem[];
}

const LS_KEY = 'ojas.chats.v1';

function loadAll(): Chat[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Chat[];
  } catch {
    return [];
  }
}

function saveAll(chats: Chat[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(chats));
}

import { auth, db } from './firebase';
import { ref, set, get, child } from 'firebase/database';

export const chatStore = {
  async hydrateFromCloud() {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const snap = await get(child(ref(db), `users/${user.uid}/chats`));
      if (snap.exists()) {
        const chats = (snap.val() as Chat[]) || [];
        saveAll(chats);
      }
    } catch {
      // ignore
    }
  },
  async pushToCloud() {
    const user = auth.currentUser;
    if (!user) return;
    try {
      await set(ref(db, `users/${user.uid}/chats`), loadAll());
    } catch {
      // ignore transient
    }
  },
  list(): Chat[] {
    return loadAll().sort((a, b) => b.updatedAt - a.updatedAt);
  },
  get(id: string): Chat | undefined {
    return loadAll().find(c => c.id === id);
  },
  create(): Chat {
    const chats = loadAll();
    const id = crypto.randomUUID();
    const now = Date.now();
    const chat: Chat = { id, title: 'New Chat', createdAt: now, updatedAt: now, messages: [] };
    chats.push(chat);
    saveAll(chats);
  // push async, non-blocking
  this.pushToCloud();
  return chat;
  },
  addMessage(id: string, role: ChatMessageRole, content: string): Chat | undefined {
    const chats = loadAll();
    const chat = chats.find(c => c.id === id);
    if (!chat) return undefined;
    const msg: ChatMessageItem = { id: crypto.randomUUID(), role, content, timestamp: Date.now() };
    chat.messages.push(msg);
    if (chat.title === 'New Chat' && role === 'user') {
      chat.title = content.slice(0, 40) + (content.length > 40 ? '…' : '');
    }
    chat.updatedAt = Date.now();
  saveAll(chats);
  this.pushToCloud();
    return chat;
  },
  rename(id: string, title: string): Chat | undefined {
    const chats = loadAll();
    const chat = chats.find(c => c.id === id);
    if (!chat) return undefined;
    chat.title = title;
    chat.updatedAt = Date.now();
  saveAll(chats);
  this.pushToCloud();
    return chat;
  },
  remove(id: string) {
  const chats = loadAll().filter(c => c.id !== id);
  saveAll(chats);
  this.pushToCloud();
  },
};
