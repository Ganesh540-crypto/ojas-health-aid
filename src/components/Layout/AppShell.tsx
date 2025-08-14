import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Plus, MessageSquare, Settings, User, MoreHorizontal, Pencil, Trash2, LogOut, Sun, Moon, Monitor, Bell, X } from "lucide-react";
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
  SidebarInset,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { SidebarMenuAction } from "@/components/ui/sidebar";
import { chatStore } from "@/lib/chatStore";
import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { profileStore, type UserProfile } from "@/lib/profileStore";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ref, set } from 'firebase/database';
import { db } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { toast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function AppShell() {
  const [chats, setChats] = useState(chatStore.list());
  const location = useLocation();
  const navigate = useNavigate();
  const [openSettings, setOpenSettings] = useState(false);
  const [settings, setSettings] = useState<{ notifications: boolean; theme: 'light' | 'dark' | 'system'; }>({ notifications: true, theme: 'system' });
  const email = auth.currentUser?.email || 'Account';
  type ProfileWithAvatar = UserProfile & { avatar?: string };
  const [profile, setProfile] = useState<ProfileWithAvatar>(() => (profileStore.get() as ProfileWithAvatar) || {});
  const avatar = profile.avatar;
  const [newAllergy, setNewAllergy] = useState("");
  const [newCondition, setNewCondition] = useState("");
  const [newMedication, setNewMedication] = useState("");

  useEffect(() => {
    // hydrate from cloud when user logs in
    const unsub = auth.onAuthStateChanged(() => {
      chatStore.hydrateFromCloud().finally(() => setChats(chatStore.list()));
    });
    return () => unsub();
  }, []);
  useEffect(() => {
    setChats(chatStore.list());
  }, [location.pathname]);

  // Load and persist settings
  useEffect(() => {
    try {
      const raw = localStorage.getItem('ojas.settings.v1');
      if (raw) setSettings(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    localStorage.setItem('ojas.settings.v1', JSON.stringify(settings));
    // Apply theme
    const root = document.documentElement;
    if (settings.theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      root.classList.toggle('dark', mq.matches);
    } else {
      root.classList.toggle('dark', settings.theme === 'dark');
    }
  }, [settings]);

  const startNew = () => {
    const chat = chatStore.create();
    navigate(`/chat/${chat.id}`);
  };

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <div className="flex items-center gap-2 px-2 py-1">
            <img src="/logo-jas.svg" alt="Ojas logo" className="h-6 w-6" />
            <span className="font-hero text-base tracking-tight">Ojas</span>
          </div>
          <Button variant="secondary" className="w-full" onClick={startNew}>
            <Plus className="h-4 w-4 mr-2" /> New Chat
          </Button>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Recent</SidebarGroupLabel>
            <SidebarMenu>
              {chats.map((c) => (
                <SidebarMenuItem key={c.id}>
                  <SidebarMenuButton asChild isActive={location.pathname === `/chat/${c.id}`} className="transition-all hover:translate-x-0.5">
                    <Link to={`/chat/${c.id}`}>
                      <MessageSquare className="h-4 w-4" />
                      <span className="truncate">{c.title}</span>
                    </Link>
                  </SidebarMenuButton>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <SidebarMenuAction className="opacity-100">
                        <MoreHorizontal className="h-4 w-4" />
                      </SidebarMenuAction>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuItem onClick={() => {
                        const title = prompt('Rename chat', c.title);
                        if (title && title.trim()) {
                          chatStore.rename(c.id, title.trim());
                          setChats(chatStore.list());
                        }
                      }}>
                        <Pencil className="h-4 w-4 mr-2" /> Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => {
                        if (confirm('Delete this chat? This cannot be undone.')) {
                          chatStore.remove(c.id);
                          setChats(chatStore.list());
                          if (location.pathname === `/chat/${c.id}`) {
                            const first = chatStore.list()[0];
                            if (first) navigate(`/chat/${first.id}`); else startNew();
                          }
                        }
                      }}>
                        <Trash2 className="h-4 w-4 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="justify-start gap-2 w-full">
                <img src={avatar || '/avatars/user-1.svg'} alt="avatar" className="h-6 w-6 rounded" />
                <span className="truncate">{email}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="truncate">{email}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setOpenSettings(true)}>
                <Settings className="h-4 w-4 mr-2" /> Settings…
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => signOut(auth)}>
                <LogOut className="h-4 w-4 mr-2" /> Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <Outlet />
      </SidebarInset>

      {/* Settings Dialog */}
      <Dialog open={openSettings} onOpenChange={setOpenSettings}>
  <DialogContent className="max-w-lg max-h-[85vh] focus-visible:ring-0 focus-visible:ring-offset-0 outline-none">
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
            <DialogDescription>Adjust preferences for Ojas.</DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="general" className="w-full">
            <TabsList className="grid grid-cols-2 w-full rounded-2xl bg-muted p-1">
              <TabsTrigger value="general" className="rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-sm py-2">General</TabsTrigger>
              <TabsTrigger value="account" className="rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-sm py-2">Account</TabsTrigger>
            </TabsList>
            <ScrollArea className="mt-4 h-[60vh] pr-1">
            <TabsContent value="general" className="space-y-6">
        <div className="flex items-center justify-between">
                <div>
          <Label className="flex items-center gap-2"><Bell className="h-4 w-4" /> Notifications</Label>
          <p className="mt-1 text-xs text-muted-foreground">Enable important alerts</p>
                </div>
                <Switch
                  checked={settings.notifications}
                  onCheckedChange={(v) => {
                    setSettings({ ...settings, notifications: v });
                    toast({
                      title: v ? 'Notifications enabled' : 'Notifications disabled',
                      description: 'You can change this anytime in Settings.',
                    });
                  }}
                />
              </div>

              <div>
                <Label>Theme</Label>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <Button
                    variant={settings.theme === 'light' ? 'default' : 'outline'}
                    className="focus-visible:ring-0 focus-visible:ring-offset-0"
                    onClick={() => {
                      setSettings({ ...settings, theme: 'light' });
                      toast({ title: 'Theme set to Light' });
                    }}
                  ><Sun className="h-4 w-4 mr-2"/>Light</Button>
                  <Button
                    variant={settings.theme === 'dark' ? 'default' : 'outline'}
                    className="focus-visible:ring-0 focus-visible:ring-offset-0"
                    onClick={() => {
                      setSettings({ ...settings, theme: 'dark' });
                      toast({ title: 'Theme set to Dark' });
                    }}
                  ><Moon className="h-4 w-4 mr-2"/>Dark</Button>
                  <Button
                    variant={settings.theme === 'system' ? 'default' : 'outline'}
                    className="focus-visible:ring-0 focus-visible:ring-offset-0"
                    onClick={() => {
                      setSettings({ ...settings, theme: 'system' });
                      toast({ title: 'Theme follows System' });
                    }}
                  ><Monitor className="h-4 w-4 mr-2"/>System</Button>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="account" className="space-y-6">
              {/* Avatar section on top */}
              <div className="flex flex-col items-center gap-3">
                <img src={avatar || '/avatars/user-1.svg'} alt="avatar" className="h-14 w-14 rounded-md border shadow-sm" />
                <div className="grid grid-cols-6 gap-1.5 justify-center">
                  {['/avatars/cat-1.svg','/avatars/dog-1.svg','/avatars/robot-1.svg','/avatars/alien-1.svg','/avatars/koala-1.svg','/avatars/user-1.svg'].map(src => (
                    <button
                      key={src}
                      type="button"
                      className={`rounded-md p-1 border transition-all ${profile.avatar === src ? 'ring-2 ring-primary/60 bg-primary/5 border-transparent' : 'border-border hover:bg-muted/40'}`}
                      onClick={() => setProfile(p => ({ ...p, avatar: src }))}
                      aria-label={`Select avatar ${src.split('/').pop()?.replace('.svg','')}`}
                    >
                      <img src={src} alt="option" className="h-7 w-7" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Form fields stacked in multiple rows */}
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="p-name">Name</Label>
                  <Input id="p-name" value={profile.name || ''} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="p-email">Email</Label>
                  <Input id="p-email" value={email} disabled className="bg-muted/50" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="p-height">Height (cm)</Label>
                  <Input id="p-height" type="number" value={profile.heightCm ?? ''} onChange={(e) => setProfile({ ...profile, heightCm: e.target.value === '' ? undefined : Number(e.target.value) })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="p-weight">Weight (kg)</Label>
                  <Input id="p-weight" type="number" value={profile.weightKg ?? ''} onChange={(e) => setProfile({ ...profile, weightKg: e.target.value === '' ? undefined : Number(e.target.value) })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="p-age">Age</Label>
                  <Input id="p-age" type="number" value={profile.age ?? ''} onChange={(e) => setProfile({ ...profile, age: e.target.value === '' ? undefined : Number(e.target.value) })} />
                </div>

                {/* Allergies */}
                <div className="space-y-2">
                  <Label>Allergies</Label>
                  <div className="flex flex-wrap gap-2">
                    {(profile.allergies || []).map((a, idx) => (
                      <Badge key={idx} variant="secondary" className="pl-2 pr-1">
                        {a}
                        <button
                          type="button"
                          className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded hover:bg-muted"
                          onClick={() => setProfile(p => ({ ...p, allergies: (p.allergies || []).filter((_, i) => i !== idx) }))}
                          aria-label={`Remove allergy ${a}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                  <Input
                    placeholder="Type an allergy and press Enter"
                    value={newAllergy}
                    onChange={(e) => setNewAllergy(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault();
                        const v = newAllergy.trim();
                        if (v) {
                          setProfile(p => ({ ...p, allergies: [ ...(p.allergies || []), v ] }));
                          setNewAllergy("");
                        }
                      }
                    }}
                  />
                </div>

                {/* Pre-existing conditions */}
                <div className="space-y-2">
                  <Label>Pre‑existing conditions</Label>
                  <div className="flex flex-wrap gap-2">
                    {(profile.preexisting || []).map((c, idx) => (
                      <Badge key={idx} variant="secondary" className="pl-2 pr-1">
                        {c}
                        <button
                          type="button"
                          className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded hover:bg-muted"
                          onClick={() => setProfile(p => ({ ...p, preexisting: (p.preexisting || []).filter((_, i) => i !== idx) }))}
                          aria-label={`Remove condition ${c}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                  <Input
                    placeholder="Type a condition and press Enter"
                    value={newCondition}
                    onChange={(e) => setNewCondition(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault();
                        const v = newCondition.trim();
                        if (v) {
                          setProfile(p => ({ ...p, preexisting: [ ...(p.preexisting || []), v ] }));
                          setNewCondition("");
                        }
                      }
                    }}
                  />
                </div>

                {/* Medications */}
                <div className="space-y-2">
                  <Label>Medications</Label>
                  <div className="flex flex-wrap gap-2">
                    {(profile.medications || []).map((m, idx) => (
                      <Badge key={idx} variant="secondary" className="pl-2 pr-1">
                        {m}
                        <button
                          type="button"
                          className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded hover:bg-muted"
                          onClick={() => setProfile(p => ({ ...p, medications: (p.medications || []).filter((_, i) => i !== idx) }))}
                          aria-label={`Remove medication ${m}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                  <Input
                    placeholder="Type a medication and press Enter"
                    value={newMedication}
                    onChange={(e) => setNewMedication(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault();
                        const v = newMedication.trim();
                        if (v) {
                          setProfile(p => ({ ...p, medications: [ ...(p.medications || []), v ] }));
                          setNewMedication("");
                        }
                      }
                    }}
                  />
                </div>
              </div>
              <Separator />
              <div className="flex justify-between">
                <div className="text-xs text-muted-foreground">These details help personalize responses.</div>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => setProfile((profileStore.get() as ProfileWithAvatar) || {})}>Reset</Button>
                  <Button onClick={async () => {
                    try {
                      profileStore.set(profile);
                      const user = auth.currentUser;
                      if (user) {
                        await set(ref(db, `users/${user.uid}/profile`), profile);
                      }
                      toast({ title: 'Profile saved' });
                      setOpenSettings(false);
                    } catch (e) {
                      toast({ title: 'Failed to save profile', description: 'Please try again.' });
                    }
                  }}>Save</Button>
                </div>
              </div>
              <div className="pt-2">
                <Button variant="outline" onClick={() => signOut(auth)}><LogOut className="h-4 w-4 mr-2"/> Sign out</Button>
              </div>
            </TabsContent>
            </ScrollArea>
          </Tabs>
          <DialogFooter>
            <Button onClick={() => setOpenSettings(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}
