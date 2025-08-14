import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sun, Moon, Monitor, Bell, Save, LogOut } from "lucide-react";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";

const LS_SETTINGS = 'ojas.settings.v1';

type SettingsState = {
  notifications: boolean;
  theme: 'light' | 'dark' | 'system';
};

export default function Settings() {
  const [state, setState] = useState<SettingsState>({ notifications: true, theme: 'system' });

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

  const save = () => localStorage.setItem(LS_SETTINGS, JSON.stringify(state));

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="font-hero text-2xl md:text-3xl">Settings</CardTitle>
          <CardDescription>Customize your jas experience.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="flex items-center justify-between">
            <div>
              <Label className="flex items-center gap-2"><Bell className="h-4 w-4" /> Notifications</Label>
              <p className="text-sm text-muted-foreground">Enable important alerts</p>
            </div>
            <Switch checked={state.notifications} onCheckedChange={(v) => setState({ ...state, notifications: v })} />
          </div>

          <Separator />

          <div>
            <Label>Theme</Label>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <Button variant={state.theme === 'light' ? 'default' : 'outline'} className={state.theme === 'light' ? 'bg-primary text-primary-foreground' : ''} onClick={() => setState({ ...state, theme: 'light' })}>
                <Sun className="h-4 w-4 mr-2" /> Light
              </Button>
              <Button variant={state.theme === 'dark' ? 'default' : 'outline'} className={state.theme === 'dark' ? 'bg-primary text-primary-foreground' : ''} onClick={() => setState({ ...state, theme: 'dark' })}>
                <Moon className="h-4 w-4 mr-2" /> Dark
              </Button>
              <Button variant={state.theme === 'system' ? 'default' : 'outline'} className={state.theme === 'system' ? 'bg-primary text-primary-foreground' : ''} onClick={() => setState({ ...state, theme: 'system' })}>
                <Monitor className="h-4 w-4 mr-2" /> System
              </Button>
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">Save your preferences</div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => window.location.reload()}>Reset</Button>
              <Button onClick={save}><Save className="h-4 w-4 mr-2" /> Save</Button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Account</Label>
              <p className="text-sm text-muted-foreground">You can sign out anytime</p>
            </div>
            <Button variant="outline" onClick={() => signOut(auth)}><LogOut className="h-4 w-4 mr-2" /> Sign out</Button>
          </div>

        </CardContent>
      </Card>
    </div>
  );
}
