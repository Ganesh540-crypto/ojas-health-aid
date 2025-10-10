import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Onboarding from "./pages/Onboarding";
import RequireAuth from "@/components/Auth/RequireAuth";
import RequireProfile from "@/components/Auth/RequireProfile";
import React, { useState, useEffect } from "react";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import AppShell from "@/components/Layout/AppShell";
import { auth } from "@/lib/firebase";
import { chatStore } from "@/lib/chatStore";
const AuthPage = React.lazy(() => import('./pages/Auth'));
import NotFound from "./pages/NotFound";
import VoiceMode from "./pages/VoiceMode";
import FlowDemo from "./pages/FlowDemo";
import Pulse from "./pages/Pulse";
import PulseArticle from "./pages/PulseArticle";

const queryClient = new QueryClient();

const App = () => {
  const [open, setOpen] = useState(false);
  const [bootReady, setBootReady] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);

  // Early auth + chat hydration gate to avoid transient blank states.
  useEffect(() => {
  // Using two timers: a no-op micro start (kept for type consistency) and the fallback timer.
  const timeout: number = window.setTimeout(() => {}, 0);
    const unsub = auth.onAuthStateChanged(async (u) => {
      try {
        if (u) {
          await chatStore.hydrateFromCloud();
        }
      } catch (e) {
        setBootError('Failed to sync chats (offline?)');
      } finally {
        setBootReady(true);
      }
    });
  // Hard fallback after 7s to avoid perpetual spinner
  const fallback = window.setTimeout(() => { if (!bootReady) setBootReady(true); }, 7000);
  return () => { unsub(); clearTimeout(timeout); clearTimeout(fallback); };
  }, [bootReady]);

  // Toggle command with Ctrl/Cmd+K
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Basic runtime env var sanity check (helps diagnose blank screen if Firebase fails silently)
  const requiredEnv = [
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_AUTH_DOMAIN',
    'VITE_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_STORAGE_BUCKET',
    'VITE_FIREBASE_MESSAGING_SENDER_ID',
    'VITE_FIREBASE_APP_ID'
  ];
  const missing = requiredEnv.filter(k => !import.meta.env[k as never]);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        {missing.length > 0 && (
          <div className="fixed inset-0 flex items-center justify-center p-6 bg-background text-foreground">
            <div className="max-w-md w-full space-y-4 text-center">
              <h1 className="text-xl font-semibold">Configuration Error</h1>
              <p className="text-sm text-muted-foreground">Missing required environment variables:</p>
              <ul className="text-xs font-mono bg-muted/50 rounded p-3 text-left space-y-1">
                {missing.map(m => <li key={m}>{m}</li>)}
              </ul>
              <p className="text-xs text-muted-foreground">Add them to a .env file (restart dev server) or ensure your deployment injects them.</p>
            </div>
          </div>
        )}
        {(!bootReady) && (
          <div className="fixed inset-0 flex flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
            <span>Starting Ojas…</span>
            {bootError && <span className="text-destructive">{bootError}</span>}
          </div>
        )}
        <BrowserRouter>
          {bootReady && (
          <Routes>
            <Route path="/login" element={<React.Suspense fallback={<div className="h-screen flex items-center justify-center text-sm text-muted-foreground">Loading auth…</div>}><AuthPage /></React.Suspense>} />
            <Route path="/signup" element={<React.Suspense fallback={<div className="h-screen flex items-center justify-center text-sm text-muted-foreground">Loading auth…</div>}><AuthPage /></React.Suspense>} />
            <Route path="/onboarding" element={<RequireAuth><Onboarding /></RequireAuth>} />
            {/* Full-screen Voice Mode (no AppShell / sidebar) */}
            <Route path="/voice" element={<RequireAuth><VoiceMode /></RequireAuth>} />
            {/* Full-screen Flow Demo (no AppShell / sidebar) */}
            <Route path="/flow-demo" element={<RequireAuth><FlowDemo /></RequireAuth>} />
            <Route element={<RequireAuth><RequireProfile><AppShell /></RequireProfile></RequireAuth>}>
              <Route path="/" element={<Index />} />
              <Route path="/pulse" element={<Pulse />} />
              <Route path="/pulse/:id" element={<PulseArticle />} />
              <Route path="/chat/:chatId" element={<Index />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
          )}
        </BrowserRouter>
        <CommandDialog open={open} onOpenChange={setOpen}>
          <CommandInput placeholder="Ask Ojas or choose a starter…" />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup heading="Starters">
              <CommandItem onSelect={() => {
                window.dispatchEvent(new CustomEvent('oj-quick-prompt', { detail: 'Summarize this text:' }));
                setOpen(false);
              }}>
                Summarize text
              </CommandItem>
              <CommandItem onSelect={() => {
                window.dispatchEvent(new CustomEvent('oj-quick-prompt', { detail: 'Draft a polite email about:' }));
                setOpen(false);
              }}>
                Draft email
              </CommandItem>
              <CommandItem onSelect={() => {
                window.dispatchEvent(new CustomEvent('oj-quick-prompt', { detail: 'Explain like I am five:' }));
                setOpen(false);
              }}>
                Explain simply
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </CommandDialog>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
