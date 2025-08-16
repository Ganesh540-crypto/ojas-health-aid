import { Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { geminiService } from "@/lib/gemini";

interface WelcomeScreenProps {
  onSendMessage: (message: string) => void;
}

const WelcomeScreen = ({ onSendMessage }: WelcomeScreenProps) => {
  const tips = [
    'Tip: Ask follow-ups like “explain step 2 in more detail”.',
    'Try: Paste a link and ask for a summary.',
    'Pro tip: Add “in 3 bullet points” to get concise answers.',
    'You can upload an image or PDF and ask questions about it.',
  ];

  const [liveTip, setLiveTip] = useState<string | null>(null);
  useEffect(() => {
    let ignore = false;
    const load = async () => {
      try {
        const { content } = await geminiService.generateResponse(
          'Suggest one short tip to get better answers from an AI chat. Keep it under 12 words.'
        );
        if (!ignore) setLiveTip(content.replace(/^"|"$/g, '').trim());
      } catch (err) {
        // Ignore network / AI failure; fall back to static tip.
        // Optional: add console.debug here if deeper diagnostics needed.
      }
    };
    load();
    return () => { ignore = true; };
  }, []);

  // Removed suggestions grid per new UX requirement

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 max-w-3xl mx-auto">
      <img src="/logo-jas.svg" alt="Ojas" className="h-14 w-14 mb-6 animate-pulse" />
      <h1 className="font-futuristic text-4xl text-foreground mb-4">
        {new Intl.DateTimeFormat(undefined, { hour: 'numeric', hour12: true }).format(new Date()).includes('AM') ? 'Good morning!' : (new Date().getHours() < 17 ? 'Good afternoon!' : 'Good evening!')}
      </h1>
      <p className="text-2xl text-foreground mb-8">
        What's on <span className="text-primary font-medium">your mind?</span>
      </p>
      <p className="text-center text-sm text-muted-foreground max-w-md">
        {liveTip || tips[Math.floor(Math.random() * tips.length)]}
      </p>
    </div>
  );
};

export default WelcomeScreen;