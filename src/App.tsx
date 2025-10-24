import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import React, { useState, useEffect } from "react";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import RequireAuth from "@/components/Auth/RequireAuth";
import RequireProfile from "@/components/Auth/RequireProfile";
import { HelmetProvider } from 'react-helmet-async';
// Lazy routes/components to reduce initial bundle
const AppShell = React.lazy(() => import("@/components/Layout/AppShell"));
const IndexPage = React.lazy(() => import("./pages/Index"));
const Onboarding = React.lazy(() => import("./pages/Onboarding"));
// chatStore is lazy-imported inside effects for app routes only
const LoginPage = React.lazy(() => import('./pages/Login'));
const SignupPage = React.lazy(() => import('./pages/Signup'));
import NotFound from "./pages/NotFound";
const VoiceMode = React.lazy(() => import("./pages/VoiceMode"));
const FlowDemo = React.lazy(() => import("./pages/FlowDemo"));
const Pulse = React.lazy(() => import("./pages/Pulse"));
// pulseCache is lazy-imported before use
const PulseArticle = React.lazy(() => import("./pages/PulseArticle"));
const Privacy = React.lazy(() => import("./pages/Privacy"));
const Terms = React.lazy(() => import("./pages/Terms"));
const LandingPrivacy = React.lazy(() => import("./pages/Landing/Privacy"));
const LandingTerms = React.lazy(() => import("./pages/Landing/Terms"));
const LandingContact = React.lazy(() => import("./pages/Landing/Contact"));
const LandingFAQ = React.lazy(() => import("./pages/Landing/FAQ"));
const LandingAbout = React.lazy(() => import("./pages/Landing/About"));
const VerifyEmail = React.lazy(() => import("./pages/VerifyEmail"));
const EmailAction = React.lazy(() => import("./pages/EmailAction"));
const LandingPage = React.lazy(() => import("./pages/Landing"));

const queryClient = new QueryClient();

const App = () => {
  const [open, setOpen] = useState(false);
  const [bootReady, setBootReady] = useState(() => {
    try { return sessionStorage.getItem('ojas.session.ready') === '1'; } catch { return false; }
  });
  const [showBootOverlay, setShowBootOverlay] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);

  // Early auth + chat hydration gate for app routes only (keeps landing bundle light)
  useEffect(() => {
    const landingPaths = new Set(['/', '/about', '/contact', '/faq', '/privacy', '/terms']);
    const path = window.location.pathname;
    // If landing-only, skip auth initialization entirely
    if (landingPaths.has(path)) {
      setBootReady(true);
      try { sessionStorage.setItem('ojas.session.ready', '1'); } catch {}
      return;
    }
    let unsub: (() => void) | undefined;
    const timeout: number = window.setTimeout(() => {}, 0);
    const setup = async () => {
      try {
        const [{ auth }, chat] = await Promise.all([
          import('@/lib/firebase'),
          import('@/lib/chatStore'),
        ]);
        unsub = auth.onAuthStateChanged((u) => {
          setBootReady(true);
          try { sessionStorage.setItem('ojas.session.ready', '1'); } catch {}
          if (u) {
            chat.chatStore.hydrateFromCloud().catch(() => setBootError('Failed to sync chats (offline?)'));
          }
        });
      } catch {
        // If Firebase fails to load, still allow UI to render
        setBootReady(true);
      }
    };
    setup();
    const fallback = window.setTimeout(() => { if (!bootReady) setBootReady(true); }, 7000);
    return () => { if (unsub) unsub(); clearTimeout(timeout); clearTimeout(fallback); };
  }, [bootReady]);

  // Idle prefetch VoiceMode chunk on app routes to minimize first-open latency
  useEffect(() => {
    if (!bootReady) return;
    const p = window.location.pathname;
    if (p.startsWith('/app') || p.startsWith('/chat') || p.startsWith('/pulse')) {
      const run = () => { import('./pages/VoiceMode').catch(() => {}); };
      const ric = (window as any).requestIdleCallback as ((cb: () => void, opts?: any) => void) | undefined;
      if (ric) ric(run, { timeout: 1500 }); else setTimeout(run, 600);
    }
  }, [bootReady]);

  // When on /pulse, also idle-prefetch the article chunk for faster detail opens
  useEffect(() => {
    if (!bootReady) return;
    if (window.location.pathname.startsWith('/pulse')) {
      const run = () => { import('./pages/PulseArticle').catch(() => {}); };
      const ric = (window as any).requestIdleCallback as ((cb: () => void, opts?: any) => void) | undefined;
      if (ric) ric(run, { timeout: 1500 }); else setTimeout(run, 800);
    }
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

  // Preload Pulse content in background once boot is ready (lazy import to avoid landing bloat)
  useEffect(() => {
    if (!bootReady) return;
    (async () => {
      try {
        const { prefetchPulse, getPulseCache, isPulseCacheFresh } = await import('@/lib/pulseCache');
        const cache = getPulseCache();
        const run = () => prefetchPulse().catch(() => {});
        if (!isPulseCacheFresh(cache)) {
          const ric = (window as any).requestIdleCallback as ((cb: () => void, opts?: any) => void) | undefined;
          if (ric) ric(run, { timeout: 1500 }); else setTimeout(run, 200);
        }
      } catch {}
    })();
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
    <HelmetProvider>
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
            <Route path="/verify-email" element={<React.Suspense fallback={<div /> }><VerifyEmail /></React.Suspense>} />
            <Route path="/email-action" element={<React.Suspense fallback={<div /> }><EmailAction /></React.Suspense>} />
            <Route path="/onboarding" element={<React.Suspense fallback={<div /> }><RequireAuth><Onboarding /></RequireAuth></React.Suspense>} />
            {/* Full-screen Voice Mode (no AppShell / sidebar) */}
            <Route path="/voice" element={<React.Suspense fallback={<div /> }><RequireAuth><VoiceMode /></RequireAuth></React.Suspense>} />
            {/* Full-screen Flow Demo (no AppShell / sidebar) */}
            <Route path="/flow-demo" element={<React.Suspense fallback={<div /> }><RequireAuth><FlowDemo /></RequireAuth></React.Suspense>} />
            {/* Landing page at root */}
            <Route path="/" element={<React.Suspense fallback={<div /> }><LandingPage /></React.Suspense>} />
            {/* Landing-specific pages */}
            <Route path="/about" element={<React.Suspense fallback={<div /> }><LandingAbout /></React.Suspense>} />
            <Route path="/contact" element={<React.Suspense fallback={<div /> }><LandingContact /></React.Suspense>} />
            <Route path="/faq" element={<React.Suspense fallback={<div /> }><LandingFAQ /></React.Suspense>} />
            <Route path="/privacy" element={<React.Suspense fallback={<div /> }><LandingPrivacy /></React.Suspense>} />
            <Route path="/terms" element={<React.Suspense fallback={<div /> }><LandingTerms /></React.Suspense>} />
            {/* App-specific legal pages */}
            <Route path="/app/privacy" element={<React.Suspense fallback={<div /> }><Privacy /></React.Suspense>} />
            <Route path="/app/terms" element={<React.Suspense fallback={<div /> }><Terms /></React.Suspense>} />
            <Route element={<React.Suspense fallback={<div className="h-screen flex items-center justify-center"><div className="oj-loader" aria-label="Loading" role="status" /><style>{`.oj-loader{width:60px;display:flex;align-items:flex-start;aspect-ratio:1}.oj-loader:before,.oj-loader:after{content:"";flex:1;aspect-ratio:1;--g:conic-gradient(from -90deg at 10px 10px,hsl(var(--primary)) 90deg,#0000 0);background:var(--g),var(--g),var(--g);filter:drop-shadow(30px 30px 0 hsl(var(--primary)));animation:l20 1s infinite}.oj-loader:after{transform:scaleX(-1)}@keyframes l20{0%{background-position:0 0,10px 10px,20px 20px}33%{background-position:10px 10px}66%{background-position:0 20px,10px 10px,20px 0}100%{background-position:0 0,10px 10px,20px 20px}}`}</style></div>}><AppShell /></React.Suspense>}>
              <Route path="/app" element={<React.Suspense fallback={<div /> }><RequireAuth><RequireProfile><IndexPage /></RequireProfile></RequireAuth></React.Suspense>} />
              <Route path="/pulse" element={<React.Suspense fallback={<div /> }><RequireAuth><Pulse /></RequireAuth></React.Suspense>} />
              <Route path="/pulse/:id" element={<React.Suspense fallback={<div /> }><RequireAuth><PulseArticle /></RequireAuth></React.Suspense>} />
              <Route path="/chat/:chatId" element={<React.Suspense fallback={<div /> }><RequireAuth><RequireProfile><IndexPage /></RequireProfile></RequireAuth></React.Suspense>} />
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
    </HelmetProvider>
  );
};

export default App;
