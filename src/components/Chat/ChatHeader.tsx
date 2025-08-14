import { Brain } from "lucide-react";
import { Separator } from "@/components/ui/separator";

const ChatHeader = () => {
  return (
    <div className="bg-background/80 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-6 py-3">
        {/* Intentionally empty title; branding moved to sidebar top */}
      </div>
      <Separator />
    </div>
  );
};

export default ChatHeader;