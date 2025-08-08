import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Flag, Share2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function Topbar() {
  return (
    <header className="h-14 flex items-center border-b border-border bg-background/80 backdrop-blur-sm">
      <SidebarTrigger className="ml-2" />

      <div className="flex-1 flex justify-center">
        <div className="flex items-center gap-2">
          <Select defaultValue="router">
            <SelectTrigger className="w-[260px]">
              <SelectValue placeholder="Select model" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="router">Smart Router (Lite/Research)</SelectItem>
              <SelectItem value="lite">Gemini 2.5 Flash Lite</SelectItem>
              <SelectItem value="research">Gemini 2.5 Flash + Web</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center gap-2 mr-2">
        <Button variant="ghost" size="sm" aria-label="Report">
          <Flag className="h-4 w-4" />
        </Button>
        <Button variant="secondary" size="sm">
          <Share2 className="h-4 w-4 mr-2" /> Share
        </Button>
      </div>
    </header>
  );
}
