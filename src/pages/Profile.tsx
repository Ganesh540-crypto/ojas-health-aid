import { useEffect, useState } from "react";
import { profileStore, type UserProfile } from "@/lib/profileStore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User as UserIcon, Mail, Ruler, Scale, Pill, AlertTriangle, Activity, Save, X, RotateCcw, CheckCircle2 } from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { ref, set, get, child } from 'firebase/database';

const avatarOptions = [
  '/avatars/cat-1.svg',
  '/avatars/dog-1.svg',
  '/avatars/robot-1.svg',
  '/avatars/alien-1.svg',
  '/avatars/koala-1.svg',
] as const;

export default function Profile() {
  type ProfileWithAvatar = UserProfile & { avatar?: string };
  const [profile, setProfile] = useState<ProfileWithAvatar>({});
  const [allergyText, setAllergyText] = useState("");
  const [conditionText, setConditionText] = useState("");
  const [medText, setMedText] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const user = auth.currentUser;
      if (user) {
        try {
          const snap = await get(child(ref(db), `users/${user.uid}/profile`));
          if (snap.exists()) {
            setProfile(snap.val() as ProfileWithAvatar);
            return;
          }
        } catch (e) {
          console.warn('Profile fetch failed', e);
        }
      }
      setProfile(profileStore.get());
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    profileStore.set(profile);
    const user = auth.currentUser;
    if (user) {
      try { await set(ref(db, `users/${user.uid}/profile`), profile); } catch (e) { console.warn('Profile save failed', e); }
    }
    setSaving(false);
  };

  const addTag = (key: 'allergies' | 'preexisting' | 'medications', value: string) => {
    const v = value.trim();
    if (!v) return;
    setProfile(prev => ({ ...prev, [key]: [...(prev[key] || []), v] }));
  };

  const removeTag = (key: 'allergies' | 'preexisting' | 'medications', idx: number) => {
    setProfile(prev => ({ ...prev, [key]: (prev[key] || []).filter((_, i) => i !== idx) }));
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* Header / Hero */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="font-hero text-2xl md:text-3xl">Profile</CardTitle>
          <CardDescription>Keep your details up to date for more personalized answers.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
            <div className="flex flex-col items-center gap-3">
              <div className="rounded-full p-1 ring-2 ring-primary/50">
                <Avatar className="h-24 w-24">
                  <AvatarImage src={profile.avatar} alt="Avatar" />
                  <AvatarFallback>
                    <UserIcon className="h-8 w-8" />
                  </AvatarFallback>
                </Avatar>
              </div>
              <div className="text-xs text-muted-foreground">Current avatar</div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 w-full">
              <div>
                <Label htmlFor="name" className="flex items-center gap-2"><UserIcon className="h-4 w-4" /> Name</Label>
                <Input id="name" value={profile.name || ''} onChange={(e) => setProfile({ ...profile, name: e.target.value })} placeholder="Your name" />
              </div>
              <div>
                <Label htmlFor="email" className="flex items-center gap-2"><Mail className="h-4 w-4" /> Email</Label>
                <Input id="email" type="email" value={profile.email || ''} onChange={(e) => setProfile({ ...profile, email: e.target.value })} placeholder="you@example.com" />
              </div>
              <div>
                <Label htmlFor="height" className="flex items-center gap-2"><Ruler className="h-4 w-4" /> Height (cm)</Label>
                <Input id="height" type="number" value={profile.heightCm ?? ''} onChange={(e) => setProfile({ ...profile, heightCm: Number(e.target.value || 0) || undefined })} placeholder="e.g., 170" />
              </div>
              <div>
                <Label htmlFor="weight" className="flex items-center gap-2"><Scale className="h-4 w-4" /> Weight (kg)</Label>
                <Input id="weight" type="number" value={profile.weightKg ?? ''} onChange={(e) => setProfile({ ...profile, weightKg: Number(e.target.value || 0) || undefined })} placeholder="e.g., 65" />
              </div>
              <div>
                <Label htmlFor="age" className="flex items-center gap-2"><Activity className="h-4 w-4" /> Age</Label>
                <Input id="age" type="number" value={profile.age ?? ''} onChange={(e) => setProfile({ ...profile, age: Number(e.target.value || 0) || undefined })} placeholder="e.g., 24" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Avatar chooser */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="font-hero text-2xl">Choose an avatar</CardTitle>
          <CardDescription>Select an image to represent you in chats.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {avatarOptions.map((src) => (
              <button key={src} type="button" className={`relative rounded-xl p-2 border transition-all hover:shadow-sm bg-muted/30 ${profile.avatar === src ? 'border-primary shadow-sm' : 'border-border'}`} onClick={() => setProfile(prev => ({ ...prev, avatar: src }))}>
                <img src={src} alt="avatar option" className="h-14 w-14 object-contain" />
                {profile.avatar === src && (
                  <span className="absolute -top-2 -right-2 text-primary bg-background rounded-full">
                    <CheckCircle2 className="h-5 w-5" />
                  </span>
                )}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Health info and tags */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="font-hero text-2xl">Health details</CardTitle>
          <CardDescription>These help tailor safer, more useful responses.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Allergies</Label>
            <div className="flex gap-2">
              <Input placeholder="e.g., penicillin" value={allergyText} onChange={(e) => setAllergyText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag('allergies', allergyText); setAllergyText(''); } }} />
              <Button type="button" onClick={() => { addTag('allergies', allergyText); setAllergyText(''); }}>Add</Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {(profile.allergies || []).map((a, i) => (
                <Badge key={`${a}-${i}`} variant="secondary" className="flex items-center gap-1">
                  {a}
                  <button type="button" className="ml-1 text-muted-foreground hover:text-foreground" aria-label={`Remove ${a}`} data-action="close" onClick={() => removeTag('allergies', i)}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2"><Activity className="h-4 w-4" /> Pre‑existing conditions</Label>
            <div className="flex gap-2">
              <Input placeholder="e.g., diabetes" value={conditionText} onChange={(e) => setConditionText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag('preexisting', conditionText); setConditionText(''); } }} />
              <Button type="button" onClick={() => { addTag('preexisting', conditionText); setConditionText(''); }}>Add</Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {(profile.preexisting || []).map((a, i) => (
                <Badge key={`${a}-${i}`} variant="secondary" className="flex items-center gap-1">
                  {a}
                  <button type="button" className="ml-1 text-muted-foreground hover:text-foreground" aria-label={`Remove ${a}`} data-action="close" onClick={() => removeTag('preexisting', i)}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2"><Pill className="h-4 w-4" /> Medications</Label>
            <div className="flex gap-2">
              <Input placeholder="e.g., metformin" value={medText} onChange={(e) => setMedText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag('medications', medText); setMedText(''); } }} />
              <Button type="button" onClick={() => { addTag('medications', medText); setMedText(''); }}>Add</Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {(profile.medications || []).map((a, i) => (
                <Badge key={`${a}-${i}`} variant="secondary" className="flex items-center gap-1">
                  {a}
                  <button type="button" className="ml-1 text-muted-foreground hover:text-foreground" aria-label={`Remove ${a}`} data-action="close" onClick={() => removeTag('medications', i)}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>

          <Separator />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={() => setProfile(profileStore.get())}>
              <RotateCcw className="h-4 w-4 mr-2" /> Reset
            </Button>
            <Button type="button" onClick={save} disabled={saving}>
              <Save className="h-4 w-4 mr-2" /> {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
