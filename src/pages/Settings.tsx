import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sun, Moon, Monitor, Bell, Save, LogOut, Check } from "lucide-react";
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
};

export default function Settings() {
  const [state, setState] = useState<SettingsState>({ notifications: true, theme: 'system' });
  const [saved, setSaved] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_SETTINGS);
      if (raw) setState(JSON.parse(raw) as SettingsState);
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

  const save = () => {
    localStorage.setItem(LS_SETTINGS, JSON.stringify(state));
    setSaved(true);
    toast({
      title: "Settings saved",
      description: "Your preferences have been updated.",
    });
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
        <Card className="shadow-lg border">
          <CardHeader className="pb-6">
            <CardTitle className="font-hero text-2xl sm:text-3xl">Settings</CardTitle>
            <CardDescription>Customize your Ojas experience</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Notifications Section */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg bg-muted/30">
              <div className="space-y-1">
                <Label className="flex items-center gap-2 text-base">
                  <Bell className="h-4 w-4" /> 
                  Notifications
                </Label>
                <p className="text-sm text-muted-foreground">Enable important alerts and updates</p>
              </div>
              <Switch 
                checked={state.notifications} 
                onCheckedChange={(v) => setState({ ...state, notifications: v })} 
                className="ml-auto"
              />
            </div>

            <Separator />

            {/* Theme Section */}
            <div className="space-y-4">
              <Label className="text-base">Theme Preference</Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Button 
                  variant={state.theme === 'light' ? 'default' : 'outline'} 
                  className={`transition-all ${state.theme === 'light' ? 'ring-2 ring-primary ring-offset-2' : ''}`}
                  onClick={() => setState({ ...state, theme: 'light' })}
                >
                  <Sun className="h-4 w-4 mr-2" /> 
                  Light
                </Button>
                <Button 
                  variant={state.theme === 'dark' ? 'default' : 'outline'}
                  className={`transition-all ${state.theme === 'dark' ? 'ring-2 ring-primary ring-offset-2' : ''}`}
                  onClick={() => setState({ ...state, theme: 'dark' })}
                >
                  <Moon className="h-4 w-4 mr-2" /> 
                  Dark
                </Button>
                <Button 
                  variant={state.theme === 'system' ? 'default' : 'outline'}
                  className={`transition-all ${state.theme === 'system' ? 'ring-2 ring-primary ring-offset-2' : ''}`}
                  onClick={() => setState({ ...state, theme: 'system' })}
                >
                  <Monitor className="h-4 w-4 mr-2" /> 
                  System
                </Button>
              </div>
            </div>

            <Separator />

            {/* Save Section */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-lg bg-muted/10">
              <div className="space-y-1">
                <p className="text-sm font-medium">Save Preferences</p>
                <p className="text-xs text-muted-foreground">Apply your settings changes</p>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" className="flex-1 sm:flex-none">
                      Reset
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Reset Settings?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will reload the page and reset all settings to their defaults.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => window.location.reload()}>
                        Reset
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <Button 
                  onClick={save} 
                  className="flex-1 sm:flex-none transition-all"
                  disabled={saved}
                >
                  {saved ? (
                    <><Check className="h-4 w-4 mr-2" /> Saved</>
                  ) : (
                    <><Save className="h-4 w-4 mr-2" /> Save</>
                  )}
                </Button>
              </div>
            </div>

            <Separator />

            {/* Account Section */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-lg bg-muted/10">
              <div className="space-y-1">
                <Label className="text-base">Account</Label>
                <p className="text-sm text-muted-foreground">Manage your account settings</p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="w-full sm:w-auto">
                    <LogOut className="h-4 w-4 mr-2" /> 
                    Sign out
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Sign Out?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to sign out of your account?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => signOut(auth)}>
                      Sign Out
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
