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
const LoginPage = React.lazy(() => import('./pages/Login'));
const SignupPage = React.lazy(() => import('./pages/Signup'));
import NotFound from "./pages/NotFound";
import VoiceMode from "./pages/VoiceMode";
import FlowDemo from "./pages/FlowDemo";
import Pulse from "./pages/Pulse";
import { prefetchPulse, getPulseCache, isPulseCacheFresh } from "@/lib/pulseCache";
import PulseArticle from "./pages/PulseArticle";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import LandingPrivacy from "./pages/Landing/Privacy";
import LandingTerms from "./pages/Landing/Terms";
import LandingContact from "./pages/Landing/Contact";
import LandingFAQ from "./pages/Landing/FAQ";
import LandingAbout from "./pages/Landing/About";
import VerifyEmail from "./pages/VerifyEmail";
import EmailAction from "./pages/EmailAction";
import LandingPage from "./pages/Landing";

const queryClient = new QueryClient();

const App = () => {
  const [open, setOpen] = useState(false);
  const [bootReady, setBootReady] = useState(() => {
    try { return sessionStorage.getItem('ojas.session.ready') === '1'; } catch { return false; }
  });
  const [showBootOverlay, setShowBootOverlay] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);

  // Early auth + chat hydration gate to avoid transient blank states.
  useEffect(() => {
    // Using two timers: a no-op micro start (kept for type consistency) and the fallback timer.
    const timeout: number = window.setTimeout(() => {}, 0);
    const unsub = auth.onAuthStateChanged((u) => {
      // Do not gate UI on cloud hydration; allow app to render immediately
      setBootReady(true);
      try { sessionStorage.setItem('ojas.session.ready', '1'); } catch {}
      if (u) {
        chatStore.hydrateFromCloud().catch(() => setBootError('Failed to sync chats (offline?)'));
      }
    });
    // Hard fallback after 7s to avoid perpetual spinner if auth event never fires
    const fallback = window.setTimeout(() => { if (!bootReady) setBootReady(true); }, 7000);
    return () => { unsub(); clearTimeout(timeout); clearTimeout(fallback); };
  }, [bootReady]);

  // Delay showing the boot overlay to avoid flash on fast refreshes
  useEffect(() => {
    if (bootReady) { setShowBootOverlay(false); return; }
    try { if (sessionStorage.getItem('ojas.session.overlay_seen') === '1') return; } catch {}
    const t = window.setTimeout(() => {
      setShowBootOverlay(true);
      try { sessionStorage.setItem('ojas.session.overlay_seen', '1'); } catch {}
    }, 1200);
    return () => clearTimeout(t);
  }, [bootReady]);

  // Preload Pulse content in background once boot is ready
  useEffect(() => {
    if (!bootReady) return;
    const cache = getPulseCache();
    const run = () => prefetchPulse().catch(() => {});
    if (!isPulseCacheFresh(cache)) {
      const ric = (window as any).requestIdleCallback as ((cb: () => void, opts?: any) => void) | undefined;
      if (ric) ric(run, { timeout: 1500 }); else setTimeout(run, 200);
    }
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
        {(!bootReady && showBootOverlay) && (
          <div className="fixed inset-0 flex flex-col items-center justify-center gap-3 text-xs text-muted-foreground bg-background/80 backdrop-blur-sm z-[999]">
            <div className="oj-loader" aria-label="Loading" role="status" />
            <span>Starting Ojas…</span>
            {bootError && <span className="text-destructive">{bootError}</span>}
            <style>{`
              .oj-loader{width:60px;display:flex;align-items:flex-start;aspect-ratio:1}
              .oj-loader:before,.oj-loader:after{content:"";flex:1;aspect-ratio:1;--g:conic-gradient(from -90deg at 10px 10px,hsl(var(--primary)) 90deg,#0000 0);background:var(--g),var(--g),var(--g);filter:drop-shadow(30px 30px 0 hsl(var(--primary)));animation:l20 1s infinite}
              .oj-loader:after{transform:scaleX(-1)}
              @keyframes l20{0%{background-position:0 0,10px 10px,20px 20px}33%{background-position:10px 10px}66%{background-position:0 20px,10px 10px,20px 0}100%{background-position:0 0,10px 10px,20px 20px}}
            `}</style>
          </div>
        )}
        <BrowserRouter>
          {bootReady && (
          <Routes>
            <Route path="/login" element={<React.Suspense fallback={<div className="h-screen flex items-center justify-center"><div className="oj-loader" aria-label="Loading" role="status" /><style>{`.oj-loader{width:60px;display:flex;align-items:flex-start;aspect-ratio:1}.oj-loader:before,.oj-loader:after{content:"";flex:1;aspect-ratio:1;--g:conic-gradient(from -90deg at 10px 10px,hsl(var(--primary)) 90deg,#0000 0);background:var(--g),var(--g),var(--g);filter:drop-shadow(30px 30px 0 hsl(var(--primary)));animation:l20 1s infinite}.oj-loader:after{transform:scaleX(-1)}@keyframes l20{0%{background-position:0 0,10px 10px,20px 20px}33%{background-position:10px 10px}66%{background-position:0 20px,10px 10px,20px 0}100%{background-position:0 0,10px 10px,20px 20px}}`}</style></div>}><LoginPage /></React.Suspense>} />
            <Route path="/signup" element={<React.Suspense fallback={<div className="h-screen flex items-center justify-center"><div className="oj-loader" aria-label="Loading" role="status" /><style>{`.oj-loader{width:60px;display:flex;align-items:flex-start;aspect-ratio:1}.oj-loader:before,.oj-loader:after{content:"";flex:1;aspect-ratio:1;--g:conic-gradient(from -90deg at 10px 10px,hsl(var(--primary)) 90deg,#0000 0);background:var(--g),var(--g),var(--g);filter:drop-shadow(30px 30px 0 hsl(var(--primary)));animation:l20 1s infinite}.oj-loader:after{transform:scaleX(-1)}@keyframes l20{0%{background-position:0 0,10px 10px,20px 20px}33%{background-position:10px 10px}66%{background-position:0 20px,10px 10px,20px 0}100%{background-position:0 0,10px 10px,20px 20px}}`}</style></div>}><SignupPage /></React.Suspense>} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/email-action" element={<EmailAction />} />
            <Route path="/onboarding" element={<RequireAuth><Onboarding /></RequireAuth>} />
            {/* Full-screen Voice Mode (no AppShell / sidebar) */}
            <Route path="/voice" element={<RequireAuth><VoiceMode /></RequireAuth>} />
            {/* Full-screen Flow Demo (no AppShell / sidebar) */}
            <Route path="/flow-demo" element={<RequireAuth><FlowDemo /></RequireAuth>} />
            {/* Landing page at root */}
            <Route path="/" element={<LandingPage />} />
            {/* Landing-specific pages */}
            <Route path="/about" element={<LandingAbout />} />
            <Route path="/contact" element={<LandingContact />} />
            <Route path="/faq" element={<LandingFAQ />} />
            <Route path="/privacy" element={<LandingPrivacy />} />
            <Route path="/terms" element={<LandingTerms />} />
            {/* App-specific legal pages */}
            <Route path="/app/privacy" element={<Privacy />} />
            <Route path="/app/terms" element={<Terms />} />
            <Route element={<AppShell />}>
              <Route path="/app" element={<RequireAuth><RequireProfile><Index /></RequireProfile></RequireAuth>} />
              <Route path="/pulse" element={<RequireAuth><Pulse /></RequireAuth>} />
              <Route path="/pulse/:id" element={<RequireAuth><PulseArticle /></RequireAuth>} />
              <Route path="/chat/:chatId" element={<RequireAuth><RequireProfile><Index /></RequireProfile></RequireAuth>} />
            </Route>
            {/* Ensure unknown nested segments like /chat/foo/bar or /pulse/foo go to 404 outside the shell */}
            <Route path="/chat/*" element={<NotFound />} />
            <Route path="/pulse/*" element={<NotFound />} />
            {/* Global fallback for any unmatched route (outside protected shell as well) */}
            <Route path="*" element={<NotFound />} />
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
