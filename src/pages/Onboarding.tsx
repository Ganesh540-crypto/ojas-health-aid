import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
 
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
  const MAX_STEP = 4;
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<UserProfile>({});
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);

  useEffect(() => {
    const sub = auth.onAuthStateChanged(async (u) => {
      if (!u) {
        nav('/login', { replace: true });
        return;
      }
      
      // Don't redirect if we're in the process of completing onboarding
      if (isCompleting) return;
      
      try {
        const snap = await get(child(ref(db), `users/${u.uid}/profile`));
        if (snap.exists()) {
          // Profile already completed -> skip onboarding entirely
            nav('/app', { replace: true });
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
  }, [nav, isCompleting]);

  const next = () => setStep((s) => Math.min(MAX_STEP, s + 1));
  const back = () => setStep((s) => Math.max(1, s - 1));

  const saveAll = async () => {
    const user = auth.currentUser;
    if (!user) return;
    
    setSaving(true);
    setIsCompleting(true);
    setError(null);
    
    // Filter out undefined values to prevent Firebase errors
    const data: UserProfile = Object.fromEntries(
      Object.entries(profile).filter(([_, value]) => value !== undefined)
    ) as UserProfile;
    
    try {
      // Save local
      profileStore.set(data);
      // Save remote
      await set(ref(db, `users/${user.uid}/profile`), data);
      try { window.dispatchEvent(new Event('ojas-profile-changed')); } catch {}
      
      // Small delay to ensure the save is complete before navigation
      await new Promise(resolve => setTimeout(resolve, 500));
      nav('/app', { replace: true });
    } catch (e: unknown) {
      const msg = (e as { message?: string })?.message || 'Failed to save your profile. Please try again.';
      setError(msg);
      setIsCompleting(false);
    } finally {
      setSaving(false);
    }
  };

  const steps = [
    { id: 1, label: 'Your details', desc: 'Provide your basic details' },
    { id: 2, label: 'Health basics', desc: 'Key health information' },
    { id: 3, label: 'Interests & Pulse', desc: 'Topics and notifications' },
    { id: 4, label: 'Finish', desc: 'Photo & complete' },
  ];

  return (
    <div className="relative min-h-screen bg-background flex" aria-busy={saving ? true : undefined} data-loading={saving ? 'true' : undefined}>
      {/* Left Panel - Grey Background */}
      <div className="hidden md:flex md:w-[35%] bg-muted/60 flex-col min-h-screen">
        {/* Logo at top-left */}
        <div className="flex items-center gap-0.5 p-6">
          <img src="/logo-jas.svg" alt="Ojas logo" className="h-8 w-8" />
          <span className="text-2xl font-medium mt-1">jas</span>
        </div>
        
        {/* Steps positioned to align with right content */}
        <div className="flex-1 flex items-start justify-center px-6 pt-20">
          <div className="w-full max-w-sm">
            <div className="mb-8 text-center">
              <div className="text-2xl font-semibold">Set up your account</div>
              <div className="text-sm text-muted-foreground">Follow the steps to complete your profile</div>
            </div>
            <div className="space-y-1">
              {steps.map((st, idx) => {
                const active = st.id === step; const completed = st.id < step; const last = idx === steps.length - 1;
                return (
                  <div key={st.id} className={`relative flex items-start gap-3 rounded-md p-1.5 ${active ? 'bg-transparent' : 'hover:bg-muted/40 transition-colors'}`}>
                    <div className="relative w-7 flex-shrink-0 flex flex-col items-center">
                      <div className={`h-5 w-5 rounded-full flex items-center justify-center ${completed ? 'bg-primary text-primary-foreground' : active ? 'border-2 border-dotted border-primary text-primary' : 'border border-dotted border-muted-foreground/50 text-transparent'}`}>
                        {completed ? (
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M2 6l2.2 2.2L10 2.8" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        ) : null}
                      </div>
                      {!last && (
                        <div className="mt-1 flex-1 flex flex-col items-center">
                          {Array.from({ length: 6 }).map((_, i) => (
                            <span key={i} className="w-px h-1 bg-border/70 rounded-full mb-0.5" />
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <div className={`text-sm ${active ? 'font-semibold text-foreground' : 'text-foreground'}`}>{st.label}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{st.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Content */}
      <div className="flex-1 flex flex-col justify-center p-6 md:p-12 min-h-screen">
        <div className="w-full max-w-2xl mx-auto">
          <div className="mb-8">
            <h1 className="text-2xl font-semibold">{steps.find(s => s.id === step)?.label}</h1>
            <p className="text-sm text-muted-foreground mt-2">{steps.find(s => s.id === step)?.desc}</p>
          </div>
          <div className="space-y-6 mb-8">
          {error && (
            <div className="text-sm text-destructive" role="alert">
              {error}
            </div>
          )}
          {step === 1 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Row 1 */}
              <div className="space-y-1.5">
                <Label htmlFor="name">Name</Label>
                <Input className="rounded-sm" id="name" value={profile.name || ''} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input className="rounded-sm" id="email" type="email" value={profile.email || ''} onChange={(e) => setProfile({ ...profile, email: e.target.value })} />
              </div>
              {/* Row 2 */}
              <div className="space-y-1.5">
                <Label htmlFor="language">Preferred language</Label>
                <Input className="rounded-sm" id="language" placeholder="e.g., en, hi" value={profile.language || ''} onChange={(e) => setProfile({ ...profile, language: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="location">Location</Label>
                <Input className="rounded-sm" id="location" placeholder="City or region" value={profile.location || ''} onChange={(e) => setProfile({ ...profile, location: e.target.value })} />
              </div>
              {/* Row 3 */}
              <div className="space-y-1.5">
                <Label htmlFor="age">Age</Label>
                <Input className="rounded-sm w-24" id="age" type="number" placeholder="25" value={profile.age ?? ''} onChange={(e) => setProfile({ ...profile, age: e.target.value === '' ? undefined : Number(e.target.value) })} />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="height">Height (cm)</Label>
                  <Input className="rounded-sm w-32" id="height" type="number" placeholder="170" value={profile.heightCm ?? ''} onChange={(e) => setProfile({ ...profile, heightCm: e.target.value === '' ? undefined : Number(e.target.value) })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="weight">Weight (kg)</Label>
                  <Input className="rounded-sm w-32" id="weight" type="number" placeholder="70" value={profile.weightKg ?? ''} onChange={(e) => setProfile({ ...profile, weightKg: e.target.value === '' ? undefined : Number(e.target.value) })} />
                </div>
              </div>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="allergies">Allergies (comma separated)</Label>
                  <Input className="rounded-sm" id="allergies" placeholder="e.g., penicillin, peanuts" onChange={(e) => setProfile({ ...profile, allergies: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="conditions">Pre-existing Conditions</Label>
                  <Input className="rounded-sm" id="conditions" placeholder="e.g., diabetes" onChange={(e) => setProfile({ ...profile, preexisting: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="medications">Medications</Label>
                  <Input className="rounded-sm" id="medications" placeholder="e.g., metformin" onChange={(e) => setProfile({ ...profile, medications: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} />
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div>
                <Label>Interests</Label>
                <div className="flex flex-wrap gap-2 pt-2">
                  {['Fitness','Nutrition','Mental health','Productivity','Tech','Travel','Finance'].map((tag) => (
                    <button key={tag} type="button" className={`px-3 py-1.5 rounded-full text-xs ${profile.interests?.includes(tag) ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'}`} onClick={() => {
                      const set = new Set(profile.interests || []);
                      set.has(tag) ? set.delete(tag) : set.add(tag);
                      setProfile({ ...profile, interests: Array.from(set) });
                    }}>{tag}</button>
                  ))}
                </div>
              </div>
              <div>
                <Label>Pulse topics</Label>
                <div className="flex flex-wrap gap-2 pt-2">
                  {['Health','Science','AI','Business','Startups','Sports','World'].map((tag) => (
                    <button key={tag} type="button" className={`px-3 py-1.5 rounded-full text-xs ${profile.pulseTopics?.includes(tag) ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'}`} onClick={() => {
                      const set = new Set(profile.pulseTopics || []);
                      set.has(tag) ? set.delete(tag) : set.add(tag);
                      setProfile({ ...profile, pulseTopics: Array.from(set) });
                    }}>{tag}</button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between border rounded-lg p-3">
                  <div>
                    <div className="text-sm font-medium">Daily digest</div>
                    <div className="text-xs text-muted-foreground">Morning summary tailored to you</div>
                  </div>
                  <input type="checkbox" checked={!!profile.notifications?.dailyDigest} onChange={(e) => setProfile({ ...profile, notifications: { ...profile.notifications, dailyDigest: e.target.checked } })} />
                </div>
                <div className="flex items-center justify-between border rounded-lg p-3">
                  <div>
                    <div className="text-sm font-medium">Breaking news</div>
                    <div className="text-xs text-muted-foreground">Critical updates in your topics</div>
                  </div>
                  <input type="checkbox" checked={!!profile.notifications?.breakingNews} onChange={(e) => setProfile({ ...profile, notifications: { ...profile.notifications, breakingNews: e.target.checked } })} />
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <div>
                <Label>Review your details</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 text-sm">
                  <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Name</div><div className="font-medium">{profile.name || '-'}</div></div>
                  <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Email</div><div className="font-medium">{profile.email || '-'}</div></div>
                  <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Preferred language</div><div className="font-medium">{profile.language || '-'}</div></div>
                  <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Location</div><div className="font-medium">{profile.location || '-'}</div></div>
                  <div className="rounded-lg border p-3 md:col-span-2"><div className="text-xs text-muted-foreground">Age</div><div className="font-medium">{profile.age ?? '-'}</div></div>
                </div>
              </div>

              <div>
                <Label>Profile photo</Label>
                <div className="flex items-center gap-4 pt-2">
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
                    <Button variant="outline" type="button" onClick={() => document.getElementById('onb-photo')?.click()} disabled={uploading}>{uploading ? 'Uploading…' : 'Upload photo (optional)'}</Button>
                    {auth.currentUser?.photoURL && (
                      <Button type="button" variant="secondary" onClick={() => setProfile(prev => ({ ...prev, photoUrl: auth.currentUser?.photoURL || prev.photoUrl }))}>Use Gmail photo</Button>
                    )}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">You can change this anytime in Settings.</p>
              </div>
            </div>
          )}

          </div>
          
          <div className="flex justify-between pt-8 border-t border-border/20">
            {step > 1 ? <Button variant="outline" onClick={back} disabled={saving}>Back</Button> : <span />}
            {step < MAX_STEP ? (
              <Button onClick={next}>Next</Button>
            ) : (
              <Button onClick={saveAll} disabled={saving}>
                {saving ? (
                  <div className="flex items-center gap-3">
                    <div className="oj-loader-small" aria-label="Loading" role="status" />
                    Completing setup...
                  </div>
                ) : 'Finish'}
              </Button>
            )}
          </div>
        </div>
      </div>
      <style>{`
        .oj-loader{width:60px;display:flex;align-items:flex-start;aspect-ratio:1}
        .oj-loader:before,.oj-loader:after{content:"";flex:1;aspect-ratio:1;--g:conic-gradient(from -90deg at 10px 10px,hsl(var(--primary)) 90deg,#0000 0);background:var(--g),var(--g),var(--g);filter:drop-shadow(30px 30px 0 hsl(var(--primary)));animation:l20 1s infinite}
        .oj-loader:after{transform:scaleX(-1)}
        .oj-loader-small{width:20px;display:flex;align-items:flex-start;aspect-ratio:1}
        .oj-loader-small:before,.oj-loader-small:after{content:"";flex:1;aspect-ratio:1;--g:conic-gradient(from -90deg at 3px 3px,hsl(var(--primary-foreground)) 90deg,#0000 0);background:var(--g),var(--g),var(--g);filter:drop-shadow(10px 10px 0 hsl(var(--primary-foreground)));animation:l20-small 1s infinite}
        .oj-loader-small:after{transform:scaleX(-1)}
        @keyframes l20{0%{background-position:0 0,10px 10px,20px 20px}33%{background-position:10px 10px}66%{background-position:0 20px,10px 10px,20px 0}100%{background-position:0 0,10px 10px,20px 20px}}
        @keyframes l20-small{0%{background-position:0 0,3px 3px,6px 6px}33%{background-position:3px 3px}66%{background-position:0 6px,3px 3px,6px 0}100%{background-position:0 0,3px 3px,6px 6px}}
      `}</style>
    </div>
  );
}
