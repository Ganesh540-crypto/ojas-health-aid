import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { profileStore, type UserProfile } from '@/lib/profileStore';
import { auth, db, storage } from '@/lib/firebase';
import { ref, set, get, child } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

// Onboarding now uses Gmail photo by default or lets the user upload a photo to Storage (photoUrl)

export default function Onboarding() {
  const nav = useNavigate();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<UserProfile>({});
  const [uploading, setUploading] = useState(false);
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
      setProfile({
        ...local,
        name: u.displayName || local.name,
        email: u.email || local.email,
        photoUrl: local.photoUrl || u.photoURL || undefined,
      });
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
    const data: UserProfile = { ...profile };
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
            <div className="space-y-4">
              <Label>Profile photo</Label>
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={profile.photoUrl || auth.currentUser?.photoURL || undefined} alt="profile" />
                  <AvatarFallback>{(profile.name?.[0] || auth.currentUser?.displayName?.[0] || (profile.email || auth.currentUser?.email || 'U')[0] || 'U').toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="space-x-2">
                  <input id="onb-photo" type="file" accept="image/*" className="hidden" onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    if (!f.type.startsWith('image/')) { return; }
                    if (f.size > 5 * 1024 * 1024) { return; }
                    const user = auth.currentUser; if (!user) return;
                    setUploading(true);
                    try {
                      const path = `users/${user.uid}/profile/avatar_${Date.now()}`;
                      const sRef = storageRef(storage, path);
                      await uploadBytes(sRef, f);
                      const url = await getDownloadURL(sRef);
                      setProfile(prev => ({ ...prev, photoUrl: url }));
                    } finally {
                      setUploading(false);
                    }
                  }} />
                  <Button variant="outline" type="button" onClick={() => document.getElementById('onb-photo')?.click()} disabled={uploading}>{uploading ? 'Uploading…' : 'Upload photo'}</Button>
                  {auth.currentUser?.photoURL && (
                    <Button type="button" variant="secondary" onClick={() => setProfile(prev => ({ ...prev, photoUrl: auth.currentUser?.photoURL || prev.photoUrl }))}>Use Gmail photo</Button>
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">You can change this anytime in Settings.</p>
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
