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
  ephemeral?: boolean; // true until first user message is added
}

const LS_KEY = 'ojas.chats.v1';

// In-memory cache for ephemeral (unsaved) chats until first user message
const ephemeralCache: Record<string, Chat> = {};

// Attempt to restore an ephemeral chat from sessionStorage (survives refresh)
function restoreEphemeral(id: string): Chat | undefined {
  try {
    const raw = sessionStorage.getItem(`ojas.ephemeral.${id}`);
    if (!raw) return undefined;
    const chat = JSON.parse(raw) as Chat;
    ephemeralCache[id] = chat;
    return chat;
  } catch {
    return undefined;
  }
}

function loadAll(): Chat[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Sanitize each chat object to avoid runtime errors
    const cleaned: Chat[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue;
      const { id, title, createdAt, updatedAt, messages, ephemeral } = item as Partial<Chat> & { messages?: unknown };
      if (typeof id !== 'string') continue;
      const safeMessages: ChatMessageItem[] = Array.isArray(messages)
        ? (messages.filter(m => m && typeof m === 'object' && typeof m.id === 'string' && typeof m.role === 'string' && typeof m.content === 'string' && typeof m.timestamp === 'number') as ChatMessageItem[])
        : [];
      cleaned.push({
        id,
        title: typeof title === 'string' ? title : 'Untitled',
        createdAt: typeof createdAt === 'number' ? createdAt : Date.now(),
        updatedAt: typeof updatedAt === 'number' ? updatedAt : Date.now(),
        messages: safeMessages,
        ephemeral: !!ephemeral
      });
    }
    return cleaned;
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
    const now = Date.now();
    let changed = false;
    const all = loadAll();
    const filtered: Chat[] = [];
    for (const c of all) {
      if (!c) { changed = true; continue; }
      if (!Array.isArray(c.messages)) { c.messages = []; changed = true; }
      const isEmpty = c.messages.length === 0;
      const isStale = isEmpty && now - c.createdAt > 1000 * 60 * 60;
      if (isStale) { changed = true; continue; }
      if (c.ephemeral || isEmpty) continue; // hide ephemeral or legacy empty
      filtered.push(c);
    }
    if (changed) saveAll(all.filter(c => c && Array.isArray(c.messages))); // persist sanitized dataset
    return filtered.sort((a, b) => b.updatedAt - a.updatedAt);
  },
  get(id: string): Chat | undefined {
    return ephemeralCache[id] || loadAll().find(c => c.id === id) || restoreEphemeral(id);
  },
  create(): Chat {
    const id = crypto.randomUUID();
    const now = Date.now();
    const chat: Chat = { id, title: 'New Chat', createdAt: now, updatedAt: now, messages: [], ephemeral: true };
    ephemeralCache[id] = chat; // not persisted yet
  try { sessionStorage.setItem(`ojas.ephemeral.${id}`, JSON.stringify(chat)); } catch (err) { /* ignore sessionStorage failure */ }
    window.dispatchEvent(new Event('ojas-chats-changed'));
    return chat;
  },
  addMessage(id: string, role: ChatMessageRole, content: string): Chat | undefined {
  const chats = loadAll();
  const chat = ephemeralCache[id] || chats.find(c => c.id === id);
    if (!chat) return undefined;
    const msg: ChatMessageItem = { id: crypto.randomUUID(), role, content, timestamp: Date.now() };
    chat.messages.push(msg);
    if (chat.ephemeral && role === 'user') {
      // Persist this previously ephemeral chat now
      chat.ephemeral = false;
      chats.push(chat);
      saveAll(chats);
      this.pushToCloud();
      delete ephemeralCache[id];
  try { sessionStorage.removeItem(`ojas.ephemeral.${id}`); } catch (err) { /* ignore */ }
    }
    if (chat.title === 'New Chat' && role === 'user') {
      chat.title = content.slice(0, 40) + (content.length > 40 ? '…' : '');
    }
    chat.updatedAt = Date.now();
    if (!chat.ephemeral) {
      saveAll(chats);
      this.pushToCloud();
    }
  window.dispatchEvent(new Event('ojas-chats-changed'));
    return chat;
  },
  updateMessage(chatId: string, messageId: string, content: string) {
    // Only update if chat is persisted (not ephemeral)
    const chats = loadAll();
    const chat = chats.find(c => c.id === chatId);
    if (!chat) return;
    const msg = chat.messages.find(m => m.id === messageId);
    if (!msg) return;
    msg.content = content;
    chat.updatedAt = Date.now();
    saveAll(chats); // skip cloud push for every tiny update (bandwidth)
  },
  rename(id: string, title: string): Chat | undefined {
    const chats = loadAll();
    const chat = chats.find(c => c.id === id);
    if (!chat) return undefined; // don't rename ephemeral via this path
    chat.title = title;
    chat.updatedAt = Date.now();
    saveAll(chats);
    this.pushToCloud();
    window.dispatchEvent(new Event('ojas-chats-changed'));
    return chat;
  },
  remove(id: string) {
    if (ephemeralCache[id]) {
      delete ephemeralCache[id];
    } else {
      const chats = loadAll().filter(c => c.id !== id);
      saveAll(chats);
      this.pushToCloud();
    }
    window.dispatchEvent(new Event('ojas-chats-changed'));
  },
  purgeEphemeral() {
    for (const id of Object.keys(ephemeralCache)) {
      const c = ephemeralCache[id];
      if (c.messages.length === 0) delete ephemeralCache[id];
    }
  }
};
