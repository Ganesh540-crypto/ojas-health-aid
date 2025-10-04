export type ChatMessageRole = 'user' | 'assistant';

export interface ChatMessageItem {
  id: string;
  role: ChatMessageRole;
  content: string;
  timestamp: number;
  healthRelated?: boolean;
  sources?: Array<{ title: string; url: string; snippet?: string; displayUrl?: string }>;
  attachments?: Array<{ url: string; name: string; type: string; size: number }>;
  metaItems?: Array<{ type: 'step' | 'thought' | 'search_query'; text?: string; query?: string; ts?: number }>;
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
      type RawMessage = {
        id?: unknown;
        role?: unknown;
        content?: unknown;
        timestamp?: unknown;
        healthRelated?: unknown;
        sources?: unknown;
      };
      const isValidRawMessage = (
        m: unknown
      ): m is {
        id: string;
        role: ChatMessageRole;
        content: string;
        timestamp: number;
        healthRelated?: unknown;
        sources?: unknown;
      } => {
        if (!m || typeof m !== 'object') return false;
        const r = m as RawMessage;
        const role = r.role;
        const roleOk = role === 'user' || role === 'assistant';
        return (
          typeof r.id === 'string' &&
          roleOk &&
          typeof r.content === 'string' &&
          typeof r.timestamp === 'number'
        );
      };
      const rawMsgs: unknown[] = Array.isArray(messages) ? (messages as unknown[]) : [];
      const safeMessages: ChatMessageItem[] = rawMsgs
        .filter(isValidRawMessage)
        .map((m) => {
          const base: ChatMessageItem = {
            id: m.id,
            role: m.role,
            content: m.content,
            timestamp: m.timestamp,
          };
          if (typeof m.healthRelated === 'boolean') {
            base.healthRelated = m.healthRelated;
          }
          if (Array.isArray(m.sources)) {
            base.sources = m.sources as Array<{ title: string; url: string; snippet?: string; displayUrl?: string }>;
          }
          if (Array.isArray((m as any).attachments)) {
            base.attachments = (m as any).attachments as Array<{ url: string; name: string; type: string; size: number }>;
          }
          // Preserve metaItems if present (thoughts, steps, search queries)
          const rawMeta = (m as any).metaItems;
          if (Array.isArray(rawMeta)) {
            const cleanedMeta = rawMeta
              .map((it: any) => {
                const type = it?.type;
                if (type !== 'step' && type !== 'thought' && type !== 'search_query') return undefined;
                const out: { type: 'step' | 'thought' | 'search_query'; text?: string; query?: string; ts?: number } = { type };
                if (typeof it?.text === 'string') out.text = it.text;
                if (typeof it?.query === 'string') out.query = it.query;
                if (typeof it?.ts === 'number') out.ts = it.ts;
                return out;
              })
              .filter(Boolean) as Array<{ type: 'step' | 'thought' | 'search_query'; text?: string; query?: string; ts?: number }>;
            if (cleanedMeta.length > 0) base.metaItems = cleanedMeta;
          }
          return base;
        });
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

import { auth, db, storage } from './firebase';
import { ref, set, get, child } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';

// Recursively remove undefined values from objects/arrays to satisfy Firebase RTDB constraints
function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}
function stripUndefinedDeep<T>(value: T): T {
  const recurse = (val: unknown): unknown => {
    if (Array.isArray(val)) {
      // Processing array
      // For Firebase compatibility, ensure arrays have proper numeric indices
      const cleaned = val.map((item) => recurse(item)).filter(item => item !== undefined);
      return cleaned; // Preserve empty arrays instead of converting to null
    }
    if (isPlainObject(val)) {
      const out: Record<string, unknown> = {};
      for (const [k, v2] of Object.entries(val)) {
        if (v2 === undefined) continue;
        if (k === 'sources' && Array.isArray(v2)) {
          // Force sources to be a proper Firebase-compatible array
          const cleanedSources = v2.filter(source => source != null);
          out[k] = cleanedSources; // Preserve sources arrays instead of converting to null
        } else {
          out[k] = recurse(v2);
        }
      }
      return out;
    }
    return val;
  };
  return recurse(value) as T;
}

export const chatStore = {
  async hydrateFromCloud() {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const snap = await get(child(ref(db), `users/${user.uid}/chats`));
      if (snap.exists()) {
        const chats = (snap.val() as Chat[]) || [];
        // Loaded from Firebase
        saveAll(chats);
      } else {
        // No data found in Firebase
      }
    } catch (err) {
      console.error('hydrateFromCloud failed:', err);
    }
  },
  async pushToCloud() {
    const user = auth.currentUser;
    if (!user) {
      console.log('⚠️ No authenticated user, skipping cloud push');
      return;
    }
    try {
      const local = loadAll();
      console.log('☁️ Pushing to Firebase:', { 
        numChats: local.length,
        hasMetaItems: local.some(c => c.messages.some(m => m.metaItems && m.metaItems.length > 0))
      });
      const cleaned = stripUndefinedDeep(local);
      await set(ref(db, `users/${user.uid}/chats`), cleaned);
      console.log('✅ Successfully pushed to Firebase');
    } catch (err) {
      console.error('❌ pushToCloud failed:', err);
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
  async uploadAttachment(file: File, chatId: string, messageId: string): Promise<{ url: string; name: string; type: string; size: number }> {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');
    
    const timestamp = Date.now();
    // Sanitize filename to avoid issues
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const fileName = `${timestamp}_${sanitizedName}`;
    const path = `users/${user.uid}/chats/${chatId}/${messageId}/${fileName}`;
    const fileRef = storageRef(storage, path);
    
    console.log('📤 Uploading attachment to Firebase Storage:', path);
    await uploadBytes(fileRef, file);
    const url = await getDownloadURL(fileRef);
    console.log('✅ Upload successful, URL:', url);
    
    return {
      url,
      name: file.name,
      type: file.type,
      size: file.size
    };
  },
  addMessage(id: string, role: ChatMessageRole, content: string, attachments?: Array<{ url: string; name: string; type: string; size: number }>): Chat | undefined {
  const chats = loadAll();
  const chat = ephemeralCache[id] || chats.find(c => c.id === id);
    if (!chat) return undefined;
  const msg: ChatMessageItem = { 
      id: crypto.randomUUID(), 
      role, 
      content, 
      timestamp: Date.now(),
      ...(attachments ? { attachments } : {})
    };
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
    // Generate smart title on first user message
    if (chat.title === 'New Chat' && role === 'user') {
      // Will be updated by AI after response
      chat.title = 'Chat ' + new Date().toLocaleDateString();
    }
    chat.updatedAt = Date.now();
    if (!chat.ephemeral) {
      saveAll(chats);
      this.pushToCloud();
    }
  window.dispatchEvent(new Event('ojas-chats-changed'));
    return chat;
  },
  // Add a message and return the new message id (useful for placeholders that will be updated)
  addMessageWithId(id: string, role: ChatMessageRole, content: string, meta?: { healthRelated?: boolean; sources?: Array<{ title: string; url: string; snippet?: string; displayUrl?: string }>; metaItems?: Array<{ type: 'step' | 'thought' | 'search_query'; text?: string; query?: string; ts?: number }> }): string | undefined {
    const chats = loadAll();
    const chat = ephemeralCache[id] || chats.find(c => c.id === id);
    if (!chat) return undefined;
    const msg: ChatMessageItem = { 
      id: crypto.randomUUID(), 
      role, 
      content, 
      timestamp: Date.now(), 
      ...(meta?.healthRelated !== undefined ? { healthRelated: meta.healthRelated } : {}),
      ...(meta?.sources ? { sources: meta.sources } : {}),
      ...(meta?.metaItems ? { metaItems: meta.metaItems } : {})
    };
    chat.messages.push(msg);
    // Persist even if the first non-ephemeral message is from assistant (e.g., hidden intake submit)
    if (chat.ephemeral) {
      chat.ephemeral = false;
      chats.push(chat);
      try { sessionStorage.removeItem(`ojas.ephemeral.${id}`); } catch (err) { /* ignore */ }
    }
    // Title: prefer first user message; fallback to assistant snippet
    if (chat.title === 'New Chat') {
      const firstUser = chat.messages.find(m => m.role === 'user');
      const basis = firstUser?.content || content;
      chat.title = basis.slice(0, 40) + (basis.length > 40 ? '…' : '');
    }
    chat.updatedAt = Date.now();
    saveAll(chats);
    this.pushToCloud();
    window.dispatchEvent(new Event('ojas-chats-changed'));
    return msg.id;
  },
  updateMessage(chatId: string, messageId: string, content: string, preserveSources = true) {
    // Only update if chat is persisted (not ephemeral)
    const chats = loadAll();
    const chat = chats.find(c => c.id === chatId);
    if (!chat) return;
    const msg = chat.messages.find(m => m.id === messageId);
    if (!msg) return;
    
    // Preserve sources when updating content
    const originalSources = msg.sources;
    msg.content = content;
    if (preserveSources && originalSources) {
      msg.sources = originalSources;
      // Preserving sources during update
    }
    
    chat.updatedAt = Date.now();
    saveAll(chats);
    // Push to cloud when sources are present to ensure they persist
    if (msg.sources && msg.sources.length > 0) {
      this.pushToCloud();
    }
  },
  updateMessageSources(chatId: string, messageId: string, sources: Array<{ title: string; url: string; snippet?: string; displayUrl?: string }>) {
    const chats = loadAll();
    const chat = chats.find(c => c.id === chatId);
    if (!chat) return;
    const msg = chat.messages.find(m => m.id === messageId);
    if (!msg) return;
    msg.sources = sources;
    chat.updatedAt = Date.now();
    saveAll(chats);
    this.pushToCloud();
    window.dispatchEvent(new Event('ojas-chats-changed'));
  },
  updateMessageMeta(chatId: string, messageId: string, metaItems: Array<{ type: 'step' | 'thought' | 'search_query'; text?: string; query?: string; ts?: number }>) {
    console.log('📝 updateMessageMeta called:', { chatId, messageId, metaItems });
    const chats = loadAll();
    const chat = chats.find(c => c.id === chatId);
    if (!chat) {
      console.warn('❌ Chat not found:', chatId);
      return;
    }
    const msg = chat.messages.find(m => m.id === messageId);
    if (!msg) {
      console.warn('❌ Message not found:', messageId);
      return;
    }
    msg.metaItems = metaItems;
    chat.updatedAt = Date.now();
    saveAll(chats);
    console.log('✅ MetaItems saved locally, pushing to cloud...');
    // Push to cloud to persist meta items
    this.pushToCloud();
    window.dispatchEvent(new Event('ojas-chats-changed'));
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
  },
  updateTitle(id: string, title: string): void {
    const chats = loadAll();
    const chat = ephemeralCache[id] || chats.find(c => c.id === id);
    if (!chat) return;
    chat.title = title;
    chat.updatedAt = Date.now();
    if (!chat.ephemeral) {
      saveAll(chats);
      this.pushToCloud();
    }
    window.dispatchEvent(new Event('ojas-chats-changed'));
  }
};
