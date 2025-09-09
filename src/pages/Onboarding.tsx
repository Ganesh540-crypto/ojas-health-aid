import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { profileStore, type UserProfile } from '@/lib/profileStore';
import { auth, db } from '@/lib/firebase';
import { ref, set, get, child } from 'firebase/database';

const avatars = [
  '/avatars/cat-1.svg',
  '/avatars/dog-1.svg',
  '/avatars/robot-1.svg',
  '/avatars/alien-1.svg',
  '/avatars/koala-1.svg',
  '/avatars/user-1.svg',
];

type ProfileWithAvatar = UserProfile & { avatar?: string };

export default function Onboarding() {
  const nav = useNavigate();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<UserProfile>({});
  const [selectedAvatar, setSelectedAvatar] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sub = auth.onAuthStateChanged(async (u) => {
      if (!u) {
        nav('/login', { replace: true });
        return;
      }
      try {
        const snap = await get(child(ref(db), `users/${u.uid}/profile`));
        if (snap.exists()) {
          // Profile already completed -> skip onboarding entirely
            nav('/', { replace: true });
            return;
        }
      } catch (e) {
        // ignore fetch failure; fall through to local fallback
      }
      // Fallback: prefill from local / auth display
      const local = profileStore.get();
      setProfile({ ...local, name: u.displayName || local.name, email: u.email || local.email });
    });
    return () => sub();
  }, [nav]);

  const next = () => setStep((s) => Math.min(3, s + 1));
  const back = () => setStep((s) => Math.max(1, s - 1));

  const saveAll = async () => {
    const user = auth.currentUser;
    if (!user) return;
    setSaving(true);
    setError(null);
    const data: ProfileWithAvatar = { ...profile, avatar: selectedAvatar };
    try {
      // Save local
      profileStore.set(data);
      // Save remote
      await set(ref(db, `users/${user.uid}/profile`), data);
      nav('/', { replace: true });
    } catch (e: unknown) {
      const msg = (e as { message?: string })?.message || 'Failed to save your profile. Please try again.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background grid place-items-center p-6" aria-busy={saving ? true : undefined} data-loading={saving ? 'true' : undefined}>
      <Card className="w-full max-w-3xl">
        <CardHeader>
          <CardTitle>Welcome to Ojas</CardTitle>
          <CardDescription>Let's personalize your experience. Step {step} of 3</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          {error && (
            <div className="text-sm text-destructive" role="alert">
              {error}
            </div>
          )}
          {step === 1 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input id="name" value={profile.name || ''} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={profile.email || ''} onChange={(e) => setProfile({ ...profile, email: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="age">Age</Label>
                <Input id="age" type="number" value={profile.age ?? ''} onChange={(e) => setProfile({ ...profile, age: e.target.value === '' ? undefined : Number(e.target.value) })} />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="height">Height (cm)</Label>
                <Input id="height" type="number" value={profile.heightCm ?? ''} onChange={(e) => setProfile({ ...profile, heightCm: e.target.value === '' ? undefined : Number(e.target.value) })} />
              </div>
              <div>
                <Label htmlFor="weight">Weight (kg)</Label>
                <Input id="weight" type="number" value={profile.weightKg ?? ''} onChange={(e) => setProfile({ ...profile, weightKg: e.target.value === '' ? undefined : Number(e.target.value) })} />
              </div>
              <div>
                <Label htmlFor="allergies">Allergies (comma separated)</Label>
                <Input id="allergies" placeholder="e.g., penicillin, peanuts" onChange={(e) => setProfile({ ...profile, allergies: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} />
              </div>
              <div>
                <Label htmlFor="conditions">Pre-existing Conditions</Label>
                <Input id="conditions" placeholder="e.g., diabetes" onChange={(e) => setProfile({ ...profile, preexisting: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} />
              </div>
              <div>
                <Label htmlFor="medications">Medications</Label>
                <Input id="medications" placeholder="e.g., metformin" onChange={(e) => setProfile({ ...profile, medications: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} />
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <Label>Choose your avatar</Label>
              <div className="mt-3 grid grid-cols-5 gap-3">
                {avatars.map((src) => (
                  <button key={src} type="button" className={`border rounded-md p-1 hover:border-primary ${selectedAvatar === src ? 'ring-2 ring-primary' : 'border-border'}`} onClick={() => setSelectedAvatar(src)}>
                    <img src={src} alt="avatar" className="h-16 w-16 object-contain" />
                  </button>
                ))}
              </div>
            </div>
          )}

          <Separator />
          <div className="flex justify-between">
            <Button variant="outline" onClick={back} disabled={step === 1}>Back</Button>
            {step < 3 ? (
              <Button onClick={next}>Next</Button>
            ) : (
              <Button onClick={saveAll} disabled={saving}>{saving ? 'Saving…' : 'Finish'}</Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
