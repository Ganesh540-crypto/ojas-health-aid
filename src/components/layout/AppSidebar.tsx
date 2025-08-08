import { useMemo } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { PlusCircle, Settings, Download, FileText } from "lucide-react";

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  const todayItems = useMemo(
    () => [
      "How do I design interface for my…",
      "What is design?",
    ],
    []
  );
  const yesterdayItems = useMemo(
    () => [
      "How is visual hierarchy achieved?",
      "FAANG design practices",
      "Quantitative Research Types",
    ],
    []
  );

  const triggerNewChat = () => {
    window.dispatchEvent(new Event("ojas:new-chat"));
  };

  const Item = ({ label }: { label: string }) => (
    <SidebarMenuItem>
      <SidebarMenuButton asChild>
        <button className="w-full text-left truncate" title={label}>
          <FileText className="mr-2 h-4 w-4" />
          {!collapsed && <span>{label}</span>}
        </button>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <button
                    onClick={triggerNewChat}
                    className="w-full flex items-center justify-center gap-2 font-medium"
                    aria-label="New Chat"
                    title="New Chat"
                  >
                    <PlusCircle className="h-4 w-4" />
                    {!collapsed && <span>New Chat</span>}
                  </button>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Today</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {todayItems.map((t) => (
                <Item key={t} label={t} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Yesterday</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {yesterdayItems.map((t) => (
                <Item key={t} label={t} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupContent>
            <div className="m-3 rounded-lg border border-border bg-card p-3 text-card-foreground shadow-sm">
              <div className="text-sm font-medium">Upgrade to Pro</div>
              <p className="mt-1 text-xs text-muted-foreground">
                Faster replies, image generation and advanced search.
              </p>
              <button
                className="mt-3 w-full rounded-md bg-primary px-3 py-2 text-primary-foreground text-sm"
                type="button"
                title="Learn More"
              >
                Learn More
              </button>
            </div>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <button className="w-full text-left">
                    <Settings className="mr-2 h-4 w-4" />
                    {!collapsed && <span>Settings</span>}
                  </button>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <button className="w-full text-left">
                    <Download className="mr-2 h-4 w-4" />
                    {!collapsed && <span>Download for iOS</span>}
                  </button>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <button className="w-full text-left">
                    <FileText className="mr-2 h-4 w-4" />
                    {!collapsed && <span>AI Policy</span>}
                  </button>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
