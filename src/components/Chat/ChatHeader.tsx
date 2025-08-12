import { Brain } from "lucide-react";
import { Separator } from "@/components/ui/separator";

const ChatHeader = () => {
  return (
    <div className="bg-background/80 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center">
            <Brain className="w-5 h-5 text-primary-foreground" />
          </div>
          <h1 className="font-futuristic text-lg text-foreground">Ojas AI</h1>
        </div>
      </div>
      <Separator />
    </div>
  );
};

export default ChatHeader;