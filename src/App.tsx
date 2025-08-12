import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import React, { useState, useCallback } from "react";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => {
  const [open, setOpen] = useState(false);

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

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
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
