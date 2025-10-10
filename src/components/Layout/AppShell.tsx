import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Plus, Settings, MoreHorizontal, Pencil, Trash2, LogOut, MessageSquare, User, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { chatStore } from "@/lib/chatStore";
import { useEffect, useRef, useState } from "react";
import { auth } from "@/lib/firebase";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { profileStore, type UserProfile } from "@/lib/profileStore";
import { Input } from "@/components/ui/input";
import { signOut } from "firebase/auth";
import { useToast } from "@/hooks/use-toast";
import SettingsDialog from "@/components/Settings/SettingsDialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function AppShell() {
  const [chats, setChats] = useState(chatStore.list());
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  // Collapsible Home sidebar state
  const [homeOpen, setHomeOpen] = useState(false); // pinned open by click
  const [homeHover, setHomeHover] = useState(false); // temporarily open on hover
  const isHomeVisible = homeOpen || homeHover;
  const hoverCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const homeOpenRef = useRef(homeOpen);

  useEffect(() => {
    homeOpenRef.current = homeOpen;
  }, [homeOpen]);

  const cancelHoverCloseDelay = () => {
    if (hoverCloseTimer.current) {
      clearTimeout(hoverCloseTimer.current);
      hoverCloseTimer.current = null;
    }
  };
  const startHoverCloseDelay = () => {
    if (homeOpenRef.current) return; // don't auto-close if pinned open
    cancelHoverCloseDelay();
    hoverCloseTimer.current = setTimeout(() => {
      setHomeHover(false);
      hoverCloseTimer.current = null;
    }, 300); // 0.7s delay
  };
  const [openSettings, setOpenSettings] = useState(false);
  const [settings, setSettings] = useState<{ notifications: boolean; theme: 'light' | 'dark' | 'system'; accent: 'orange' | 'blue' | 'green'; compact: boolean; scrollLock: boolean; }>({ notifications: true, theme: 'system', accent: 'orange', compact: false, scrollLock: true });
  const email = auth.currentUser?.email || 'Account';
  const [profile, setProfile] = useState<UserProfile>(() => (profileStore.get() as UserProfile) || {});
  const photoUrl = profile.photoUrl;
  const authPhoto = auth.currentUser?.photoURL || undefined;
  const localPart = email.includes('@') ? email.split('@')[0] : email;
  const initial = (
    (profile.username && profile.username[0]) ||
    (profile.name && profile.name[0]) ||
    (auth.currentUser?.displayName && auth.currentUser.displayName[0]) ||
    (localPart && localPart[0]) ||
    'U'
  ).toUpperCase();

  // removed old settings fields and avatars; managed in the new SettingsDialog
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedChat, setSelectedChat] = useState<{ id: string; title: string } | null>(null);
  const [newChatTitle, setNewChatTitle] = useState("");

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(() => {
      chatStore.hydrateFromCloud().finally(() => setChats(chatStore.list()));
    });
    return () => unsub();
  }, []);
  useEffect(() => {
    setChats(chatStore.list());
  }, [location.pathname]);
  useEffect(() => {
    const handler = () => setChats(chatStore.list());
    window.addEventListener('ojas-chats-changed', handler);
    return () => window.removeEventListener('ojas-chats-changed', handler);
  }, []);
  useEffect(() => {
    const fn = () => setProfile((profileStore.get() as UserProfile) || {});
    window.addEventListener('ojas-profile-changed', fn);
    return () => window.removeEventListener('ojas-profile-changed', fn);
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('ojas.settings.v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        setSettings((prev) => ({
          ...prev,
          ...parsed,
        }));
      }
    } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    localStorage.setItem('ojas.settings.v1', JSON.stringify(settings));
    window.dispatchEvent(new Event('ojas-settings-changed'));
    const root = document.documentElement;
    root.classList.remove('dark');
    root.dataset.accent = settings.accent;
    root.dataset.compact = settings.compact ? '1' : '0';
  }, [settings]);

  const startNew = () => {
    const chat = chatStore.create();
    navigate(`/chat/${chat.id}`);
  };

  return (
    <div className="flex h-screen bg-background relative">
      {/* Icon Rail - Narrow left sidebar (hover opens Home) */}
      <div
        className="w-[68px] bg-[#fafafa] border-r border-gray-200 flex flex-col items-center py-4"
      >
        {/* Logo */}
        <div className="mb-8">
          <img src="/logo-jas.svg" alt="Ojas" className="h-8 w-8" />
        </div>
        
        {/* New Chat Button */}
        <button 
          onClick={startNew}
          className="w-10 h-10 rounded-lg hover:bg-gray-100 flex items-center justify-center mb-6 transition-colors"
        >
          <Plus className="h-5 w-5 text-gray-600" />
        </button>
        
        {/* Home/Chats Icon - open Chat interface and reveal Home sidebar */}
        <button
          className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center mb-0 transition-colors",
            isHomeVisible ? "bg-gray-200 text-gray-900" : "hover:bg-gray-100"
          )}
          onClick={() => {
            cancelHoverCloseDelay();
            // Navigate to chat interface (home)
            navigate('/');
            // Ensure the Home sidebar is visible
            setHomeOpen(true);
            setHomeHover(true);
          }}
          onMouseEnter={() => {
            cancelHoverCloseDelay();
            setHomeHover(true);
          }}
          onMouseLeave={startHoverCloseDelay}
          aria-pressed={isHomeVisible}
          aria-label="Toggle Home"
        >
          <MessageSquare className="h-5 w-5 text-gray-600" />
        </button>
        <span className="text-[10px] text-gray-500 mt-0 mb-1 leading-tight">Home</span>
        
        {/* Pulse Feed */}
        <button
          className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center mb-0 transition-colors",
            location.pathname === '/pulse' ? "bg-gray-200 text-gray-900" : "hover:bg-gray-100"
          )}
          onClick={() => navigate('/pulse')}
          aria-label="Pulse"
        >
          <Activity className="h-5 w-5 text-gray-600" />
        </button>
        <span className="text-[10px] text-gray-500 mt-0 mb-1 leading-tight">Pulse</span>
        
        {/* Spacer */}
        <div className="flex-1" />
        
        {/* Profile Icon */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-10 h-10 rounded-lg hover:bg-gray-100 flex items-center justify-center mb-0 transition-colors">
              <Avatar className="h-7 w-7">
                <AvatarImage src={photoUrl || authPhoto} alt="profile" />
                <AvatarFallback className="text-[10px] bg-gray-200">{initial}</AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="right" className="w-56 ml-2 bg-white dark:bg-gray-900 backdrop-blur-none">
            <DropdownMenuLabel className="truncate">{email}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setOpenSettings(true)}>
              <Settings className="h-4 w-4 mr-2" /> Settings…
            </DropdownMenuItem>
            <DropdownMenuItem className="text-destructive" onClick={() => signOut(auth)}>
              <LogOut className="h-4 w-4 mr-2" /> Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <span className="text-[10px] text-gray-500 mt-0 leading-tight">Account</span>
      </div>

      {/* Content Panel - Chat list (collapsible overlay) */}
      <div
        className={cn(
          "absolute inset-y-0 left-[68px] bg-white border-r border-gray-200 flex flex-col overflow-hidden transition-[width] duration-300 ease-out z-20",
          isHomeVisible ? "w-[280px]" : "w-0 pointer-events-none"
        )}
        aria-hidden={!isHomeVisible}
        onMouseEnter={() => {
          cancelHoverCloseDelay();
          setHomeHover(true);
        }}
        onMouseLeave={startHoverCloseDelay}
      >
        {/* Header */}
        <div className="px-4 py-4 border-b border-gray-100">
          <h2 className="text-sm font-medium text-gray-900">Home</h2>
        </div>
        
        {/* Chat List */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-3 py-3">
            <div className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-3 px-2">Library</div>
            {chats.map((c) => (
              <div 
                key={c.id} 
                className={cn(
                  "group relative flex items-center px-2 py-2 text-sm rounded-md transition-colors cursor-pointer",
                  location.pathname === `/chat/${c.id}` 
                    ? "bg-gray-100 text-gray-900" 
                    : "hover:bg-gray-50 text-gray-700"
                )}
                onClick={() => navigate(`/chat/${c.id}`)}
              >
                <Link to={`/chat/${c.id}`} className="flex-1 truncate">
                  {c.title}
                </Link>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 rounded transition-all">
                      <MoreHorizontal className="h-3 w-3" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40 bg-white dark:bg-gray-900 backdrop-blur-none">
                    <DropdownMenuItem onClick={(e) => {
                      e.stopPropagation();
                      setSelectedChat({ id: c.id, title: c.title });
                      setNewChatTitle(c.title);
                      setRenameDialogOpen(true);
                    }}>
                      <Pencil className="h-3 w-3 mr-2" /> Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive" onClick={(e) => {
                      e.stopPropagation();
                      setSelectedChat({ id: c.id, title: c.title });
                      setDeleteDialogOpen(true);
                    }}>
                      <Trash2 className="h-3 w-3 mr-2" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
            {chats.length === 0 && (
              <div className="text-sm text-gray-400 px-2 py-4">No chats yet</div>
            )}
          </div>
        </div>
        
        {/* Footer removed as requested */}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-y-auto">
        <Outlet />
      </div>

      {/* Rename Chat Dialog */}
      <AlertDialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rename Chat</AlertDialogTitle>
            <AlertDialogDescription>
              Enter a new name for this chat.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={newChatTitle}
            onChange={(e) => setNewChatTitle(e.target.value)}
            placeholder="Chat title"
            className="my-4"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (selectedChat && newChatTitle.trim()) {
                chatStore.rename(selectedChat.id, newChatTitle.trim());
                setChats(chatStore.list());
                toast({
                  title: "Chat renamed",
                  description: `Renamed to "${newChatTitle.trim()}"`
                });
              }
              setRenameDialogOpen(false);
            }}>
              Rename
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Chat Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Chat?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{selectedChat?.title}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (selectedChat) {
                  chatStore.remove(selectedChat.id);
                  setChats(chatStore.list());
                  if (location.pathname === `/chat/${selectedChat.id}`) {
                    const first = chatStore.list()[0];
                    if (first) navigate(`/chat/${first.id}`); 
                    else startNew();
                  }
                  toast({
                    title: "Chat deleted",
                    description: "The chat has been removed."
                  });
                }
                setDeleteDialogOpen(false);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* New Settings Dialog */}
      <SettingsDialog open={openSettings} onOpenChange={setOpenSettings} />
    </div>
  );
}