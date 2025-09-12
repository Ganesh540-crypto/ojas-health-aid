import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sun, Moon, Monitor, Bell, Shield, User, LogOut, ChevronRight, Palette, Info } from "lucide-react";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

const LS_SETTINGS = 'ojas.settings.v1';

type SettingsState = {
  notifications: boolean;
  theme: 'light' | 'dark' | 'system';
  autoSave: boolean;
  soundEffects: boolean;
};

export default function Settings() {
  const [state, setState] = useState<SettingsState>({ 
    notifications: true, 
    theme: 'system',
    autoSave: true,
    soundEffects: false
  });
  const { toast } = useToast();
  const user = auth.currentUser;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_SETTINGS);
      if (raw) {
        const parsed = JSON.parse(raw);
        setState(prev => ({ ...prev, ...parsed }));
      }
    } catch {
      // ignore malformed localStorage
    }
  }, []);

  useEffect(() => {
    // apply theme immediately on load and when state changes
    const applyTheme = (t: SettingsState['theme']) => {
      const root = document.documentElement;
      if (t === 'system') {
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        root.classList.toggle('dark', mq.matches);
      } else {
        root.classList.toggle('dark', t === 'dark');
      }
    };
    applyTheme(state.theme);
  }, [state.theme]);

  useEffect(() => {
    // Auto-save settings when changed
    if (state.autoSave) {
      localStorage.setItem(LS_SETTINGS, JSON.stringify(state));
    }
  }, [state]);

  const handleToggle = (key: keyof SettingsState) => {
    setState(prev => ({ ...prev, [key]: !prev[key] }));
    if (state.autoSave) {
      toast({
        description: "Settings updated",
        duration: 1500,
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground mt-2">Manage your preferences and account</p>
        </div>

        {/* Settings Cards */}
        <div className="space-y-4">
          {/* Appearance */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Palette className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Appearance</CardTitle>
              </div>
              <CardDescription>Customize how Ojas looks on your device</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <Label className="text-sm font-medium">Theme</Label>
                <div className="grid grid-cols-3 gap-2">
                  <Button 
                    variant={state.theme === 'light' ? 'default' : 'outline'} 
                    size="sm"
                    onClick={() => setState({ ...state, theme: 'light' })}
                    className="w-full"
                  >
                    <Sun className="h-4 w-4 mr-2" /> 
                    Light
                  </Button>
                  <Button 
                    variant={state.theme === 'dark' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setState({ ...state, theme: 'dark' })}
                    className="w-full"
                  >
                    <Moon className="h-4 w-4 mr-2" /> 
                    Dark
                  </Button>
                  <Button 
                    variant={state.theme === 'system' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setState({ ...state, theme: 'system' })}
                    className="w-full"
                  >
                    <Monitor className="h-4 w-4 mr-2" /> 
                    Auto
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Preferences */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Preferences</CardTitle>
              </div>
              <CardDescription>Control your Ojas experience</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="flex items-center justify-between py-3">
                <div className="space-y-1">
                  <Label className="text-sm font-medium">Notifications</Label>
                  <p className="text-xs text-muted-foreground">Get alerts for important updates</p>
                </div>
                <Switch 
                  checked={state.notifications} 
                  onCheckedChange={() => handleToggle('notifications')}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between py-3">
                <div className="space-y-1">
                  <Label className="text-sm font-medium">Auto-save</Label>
                  <p className="text-xs text-muted-foreground">Automatically save settings changes</p>
                </div>
                <Switch 
                  checked={state.autoSave} 
                  onCheckedChange={() => handleToggle('autoSave')}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between py-3">
                <div className="space-y-1">
                  <Label className="text-sm font-medium">Sound effects</Label>
                  <p className="text-xs text-muted-foreground">Play sounds for interactions</p>
                </div>
                <Switch 
                  checked={state.soundEffects} 
                  onCheckedChange={() => handleToggle('soundEffects')}
                />
              </div>
            </CardContent>
          </Card>

          {/* Account */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Account</CardTitle>
              </div>
              <CardDescription>Manage your account and security</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              {user && (
                <div className="py-3">
                  <Label className="text-sm font-medium">Email</Label>
                  <p className="text-sm text-muted-foreground mt-1">{user.email}</p>
                </div>
              )}
              <Separator />
              <button className="flex items-center justify-between w-full py-3 hover:bg-muted/50 rounded-lg px-2 -mx-2 transition-colors">
                <div className="flex items-center gap-3">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <div className="text-left">
                    <p className="text-sm font-medium">Privacy & Security</p>
                    <p className="text-xs text-muted-foreground">Manage data and privacy settings</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
              <Separator />
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button className="flex items-center justify-between w-full py-3 hover:bg-muted/50 rounded-lg px-2 -mx-2 transition-colors text-red-600 dark:text-red-400">
                    <div className="flex items-center gap-3">
                      <LogOut className="h-4 w-4" />
                      <p className="text-sm font-medium">Sign out</p>
                    </div>
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Sign out of Ojas?</AlertDialogTitle>
                    <AlertDialogDescription>
                      You'll need to sign in again to access your chats and preferences.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => signOut(auth)} className="bg-red-600 hover:bg-red-700">
                      Sign out
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>

          {/* About */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Info className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">About</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Version</span>
                  <span className="font-medium">1.0.0</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Model</span>
                  <span className="font-medium">Gemini 2.0 Flash</span>
                </div>
                <Separator />
                <p className="text-xs text-muted-foreground">
                  Ojas AI Assistant by MedTrack • © 2025
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
