import { Brain, Activity, Shield } from "lucide-react";

const ChatHeader = () => {
  return (
    <div className="border-b border-card-border bg-card/50 backdrop-blur-xl">
      <div className="container mx-auto px-6 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-12 h-12 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow">
                <Brain className="w-6 h-6 text-primary-foreground" />
              </div>
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-success rounded-full border-2 border-background animate-pulse"></div>
            </div>
            <div>
              <h1 className="font-futuristic text-2xl text-foreground">
                Ojas AI
              </h1>
              <p className="text-sm text-muted-foreground">
                Your Intelligent Healthcare Assistant
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-6">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Activity className="w-4 h-4 text-success" />
                <span>Health-Ready</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Shield className="w-4 h-4 text-info" />
                <span>Secure & Private</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatHeader;