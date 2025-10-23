import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Settings as Cog, User as UserIcon } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { languageStore } from '@/lib/languageStore';
import { GLOBAL_LANGUAGES, INDIAN_LANGUAGES, DEFAULT_LANGUAGE } from '@/lib/languages';
import { profileStore, type UserProfile } from '@/lib/profileStore';
import { auth, storage, db } from '@/lib/firebase';
import { deleteMyAccount } from '@/lib/auth';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { ref as dbRef, set as dbSet, get as dbGet, remove as dbRemove } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';

// Compact two-column settings dialog with a left nav (General, Profile) and right panel content
// Matches the reference look-and-feel but adapts to our theme

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type TabKey = 'general' | 'profile' | 'memory';

const SectionRow: React.FC<{ label: string; description?: string; right?: React.ReactNode; children?: React.ReactNode }>
  = ({ label, description, right, children }) => {
  return (
    <div className="flex items-center justify-between py-3">
      <div>
        <div className="text-sm font-medium text-foreground">{label}</div>
        {description && <div className="text-xs text-muted-foreground mt-0.5">{description}</div>}
        {children}
      </div>
      {right && <div className="flex-shrink-0 ml-4">{right}</div>}
    </div>
  );
};

const SettingsDialog: React.FC<Props> = ({ open, onOpenChange }) => {
  const { toast } = useToast();
  const [active, setActive] = useState<TabKey>('general');
  const [profile, setProfile] = useState<UserProfile>(() => profileStore.get() || {});
  const [language, setLanguage] = useState(() => languageStore.get());
  const [uploading, setUploading] = useState(false);
  const [loadingMem, setLoadingMem] = useState(false);
  const [archival, setArchival] = useState<Record<string, any>>({});
  const [summaries, setSummaries] = useState<Record<string, any>>({});
  const [profileMem, setProfileMem] = useState<any>(null);

  useEffect(() => {
    setProfile(profileStore.get() || {});
  }, [open]);

  useEffect(() => {
    const loadMem = async () => {
      const user = auth.currentUser; if (!user) return;
      setLoadingMem(true);
      try {
        const [a, s, p] = await Promise.all([
          dbGet(dbRef(db, `users/${user.uid}/memory/archival`)),
          dbGet(dbRef(db, `users/${user.uid}/memory/summaries`)),
          dbGet(dbRef(db, `users/${user.uid}/memory/profile`)),
        ]);
        setArchival((a.exists() ? a.val() : {}) || {});
        setSummaries((s.exists() ? s.val() : {}) || {});
        setProfileMem((p.exists() ? p.val() : null));
      } catch {}
      setLoadingMem(false);
    };
    if (open && active === 'memory') { void loadMem(); }
  }, [open, active]);

  // React 19: No useMemo needed - React Compiler optimizes
  const languages = [DEFAULT_LANGUAGE, ...INDIAN_LANGUAGES, ...GLOBAL_LANGUAGES].filter((v, i, a) => a.findIndex(x => x.code === v.code) === i);

  const displayName = profile.name || (auth.currentUser?.displayName ?? auth.currentUser?.email?.split('@')[0] ?? '');
  const email = auth.currentUser?.email || '';
  const initial = (displayName?.[0] || 'U').toUpperCase();

  const handleLanguageSave = () => {
    languageStore.set(language.code);
    toast({ title: 'Language updated' });
  };

  const uploadPhoto = async (file: File) => {
    const user = auth.currentUser;
    if (!user) { toast({ title: 'Please sign in to upload a photo' }); return; }
    try {
      setUploading(true);
      // Basic guardrails to align with Storage rules and UX
      if (!file.type.startsWith('image/')) {
        toast({ title: 'Only images are allowed', description: 'Please choose a PNG or JPG image.' });
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast({ title: 'Image too large', description: 'Please choose an image under 5 MB.' });
        return;
      }
      const path = `users/${user.uid}/profile/avatar_${Date.now()}`;
      const sRef = storageRef(storage, path);
      await uploadBytes(sRef, file);
      const url = await getDownloadURL(sRef);
      const next = { ...profile, photoUrl: url, email: email } as UserProfile;
      setProfile(next);
      profileStore.set(next);
      window.dispatchEvent(new Event('ojas-profile-changed'));
      toast({ title: 'Profile photo updated' });
      try {
        await dbSet(dbRef(db, `users/${user.uid}/profile`), next);
      } catch (err) {
        console.warn('Cloud sync failed after photo upload', err);
        toast({ title: 'Saved locally', description: 'Cloud sync will retry automatically.' });
      }
    } catch (e) {
      console.error('Photo upload failed', e);
      toast({ title: 'Upload failed', description: 'Please check your internet and try again.' });
    } finally {
      setUploading(false);
    }
  };

  const saveProfile = async () => {
    const user = auth.currentUser;
    try {
      profileStore.set({ ...profile, email: email });
      if (user) await dbSet(dbRef(db, `users/${user.uid}/profile`), { ...profile, email: email });
      window.dispatchEvent(new Event('ojas-profile-changed'));
      toast({ title: 'Profile saved' });
      onOpenChange(false);
    } catch {
      toast({ title: 'Failed to save', description: 'Please try again.' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] p-0 overflow-hidden rounded-2xl" aria-describedby="settings-desc">
        <DialogHeader className="sr-only">
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription id="settings-desc">Manage app language, profile and memory</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-12">
          {/* Left rail */}
          <div className="col-span-4 border-r bg-muted/30 p-4">
            <div className="rounded-xl bg-background p-2">
              <div className="flex flex-col gap-1">
                <button className={`w-full text-left flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition ${active==='general' ? 'bg-muted text-foreground' : 'hover:bg-muted hover:text-foreground'}`} onClick={() => setActive('general')}>
                  <Cog className="h-4 w-4" />
                  <span>General</span>
                </button>
                <button className={`w-full text-left flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition ${active==='profile' ? 'bg-muted text-foreground' : 'hover:bg-muted hover:text-foreground'}`} onClick={() => setActive('profile')}>
                  <UserIcon className="h-4 w-4" />
                  <span>Profile</span>
                </button>
                <button className={`w-full text-left flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition ${active==='memory' ? 'bg-muted text-foreground' : 'hover:bg-muted hover:text-foreground'}`} onClick={() => setActive('memory')}>
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><path d="M3 9h18M9 21V9"></path></svg>
                  <span>Memory</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right panel */}
          <div className="col-span-8">
            <ScrollArea className="h-[75vh] pr-2">
              <div className="p-6">
                {active === 'general' && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">General</h3>
                    <div className="rounded-xl border">
                      <div className="px-4">
                        <SectionRow label="Language" description="Choose your preferred response language" right={
                          <select
                            value={language.code}
                            onChange={(e) => {
                              const next = languages.find(l => l.code === e.target.value) || DEFAULT_LANGUAGE;
                              setLanguage(next);
                            }}
                            className="rounded-lg border bg-background px-3 py-1.5 text-sm"
                          >
                            {languages.map(l => (
                              <option key={l.code} value={l.code}>{l.label}</option>
                            ))}
                          </select>
                        }/>
                      </div>
                      <Separator />
                      <div className="flex justify-end px-4 py-3">
                        <Button onClick={handleLanguageSave} className="rounded-xl">Save</Button>
                      </div>
                    </div>
                  </div>
                )}

                {active === 'memory' && (
                  <div className="space-y-6">
                    <h3 className="text-lg font-semibold">Memory</h3>
                    <div className="rounded-xl border divide-y">
                      <div className="flex items-center justify-between p-4">
                        <div>
                          <div className="text-sm font-medium">Conversation summaries</div>
                          <div className="text-xs text-muted-foreground">Recent auto-saved summaries</div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-xl"
                          disabled={loadingMem || !auth.currentUser || Object.keys(summaries || {}).length === 0}
                          onClick={async () => {
                            if (!auth.currentUser) return;
                            await dbRemove(dbRef(db, `users/${auth.currentUser.uid}/memory/summaries`));
                            setSummaries({});
                          }}
                        >
                          Delete all
                        </Button>
                      </div>
                      <div className="p-4 space-y-3">
                        {loadingMem && <div className="text-xs text-muted-foreground">Loading…</div>}
                        {!loadingMem && Object.keys(summaries || {}).length === 0 && (
                          <div className="text-xs text-muted-foreground">No summaries yet.</div>
                        )}
                        {!loadingMem && Object.entries(summaries || {})
                          .sort((a,b) => Number(b[1]?.timestamp || 0) - Number(a[1]?.timestamp || 0))
                          .map(([key, val]) => (
                          <div key={key} className="flex items-start justify-between gap-4 p-3 rounded-lg bg-muted/30">
                            <div className="min-w-0">
                              <div className="text-sm text-foreground break-words">{String(val?.summary || '')}</div>
                              {Array.isArray(val?.keyPoints) && val.keyPoints.length > 0 && (
                                <ul className="list-disc pl-5 mt-2 space-y-1">
                                  {val.keyPoints.map((kp: any, i: number) => (
                                    <li key={i} className="text-xs text-foreground/80 break-words">{String(kp)}</li>
                                  ))}
                                </ul>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={async () => {
                                if (!auth.currentUser) return;
                                await dbRemove(dbRef(db, `users/${auth.currentUser.uid}/memory/summaries/${key}`));
                                const next = { ...(summaries || {}) } as any; delete next[key]; setSummaries(next);
                              }}
                            >
                              Delete
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-xl border divide-y">
                      <div className="flex items-center justify-between p-4">
                        <div>
                          <div className="text-sm font-medium">Saved facts</div>
                          <div className="text-xs text-muted-foreground">Long-term archival memory</div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-xl"
                          disabled={loadingMem || !auth.currentUser || Object.keys(archival || {}).length === 0}
                          onClick={async () => {
                            if (!auth.currentUser) return;
                            await dbRemove(dbRef(db, `users/${auth.currentUser.uid}/memory/archival`));
                            setArchival({});
                          }}
                        >
                          Delete all
                        </Button>
                      </div>
                      <div className="p-4 space-y-3">
                        {loadingMem && <div className="text-xs text-muted-foreground">Loading…</div>}
                        {!loadingMem && Object.keys(archival || {}).length === 0 && (
                          <div className="text-xs text-muted-foreground">No saved facts yet.</div>
                        )}
                        {!loadingMem && Object.entries(archival || {})
                          .sort((a,b) => Number(b[1]?.timestamp || 0) - Number(a[1]?.timestamp || 0))
                          .map(([key, val]) => (
                          <div key={key} className="flex items-start justify-between gap-4 p-3 rounded-lg bg-muted/30">
                            <div className="min-w-0">
                              <div className="text-xs text-muted-foreground">{String(val?.type || 'fact')} · {String(val?.importance || 'medium')}</div>
                              <div className="text-sm text-foreground break-words">{String(val?.summary || val?.content || '')}</div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={async () => {
                                if (!auth.currentUser) return;
                                await dbRemove(dbRef(db, `users/${auth.currentUser.uid}/memory/archival/${key}`));
                                const next = { ...(archival || {}) } as any; delete next[key]; setArchival(next);
                              }}
                            >
                              Delete
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-xl border divide-y">
                      <div className="flex items-center justify-between p-4">
                        <div>
                          <div className="text-sm font-medium">Profile memory</div>
                          <div className="text-xs text-muted-foreground">AI-generated profile summary</div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-xl"
                          disabled={loadingMem || !auth.currentUser || !profileMem}
                          onClick={async () => {
                            if (!auth.currentUser) return;
                            await dbRemove(dbRef(db, `users/${auth.currentUser.uid}/memory/profile`));
                            setProfileMem(null);
                          }}
                        >
                          Delete all
                        </Button>
                      </div>
                      <div className="p-4 space-y-2">
                        {loadingMem && <div className="text-xs text-muted-foreground">Loading…</div>}
                        {!loadingMem && !profileMem && (
                          <div className="text-xs text-muted-foreground">No profile memory yet.</div>
                        )}
                        {!loadingMem && profileMem && (
                          <div className="space-y-2 text-sm">
                            {profileMem.personalDetails && (<div><span className="text-xs text-muted-foreground">Personal:</span> {String(profileMem.personalDetails)}</div>)}
                            {profileMem.healthSummary && (<div><span className="text-xs text-muted-foreground">Health:</span> {String(profileMem.healthSummary)}</div>)}
                            {profileMem.importantPreferences && (<div><span className="text-xs text-muted-foreground">Preferences:</span> {String(profileMem.importantPreferences)}</div>)}
                            {profileMem.communicationStyle && (<div><span className="text-xs text-muted-foreground">Style:</span> {String(profileMem.communicationStyle)}</div>)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {active === 'profile' && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Profile</h3>
                    <div className="rounded-xl border divide-y">
                      <div className="p-4 flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium">Avatar</div>
                          <div className="text-xs text-muted-foreground">PNG/JPG, square recommended</div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-12 w-12">
                            <AvatarImage src={profile.photoUrl || auth.currentUser?.photoURL || undefined} alt="avatar" />
                            <AvatarFallback>{initial}</AvatarFallback>
                          </Avatar>
                          <div>
                            <input id="profile-photo-input" type="file" accept="image/*" className="hidden" onChange={(e) => {
                              const f = e.target.files?.[0]; if (f) void uploadPhoto(f);
                            }}/>
                            <Button variant="outline" size="sm" className="rounded-xl" onClick={() => document.getElementById('profile-photo-input')?.click()} disabled={uploading}>
                              {uploading ? 'Uploading…' : 'Change photo'}
                            </Button>
                          </div>
                        </div>
                      </div>

                      <div className="p-4 grid gap-4">
                        <div>
                          <Label htmlFor="display-name" className="text-xs text-muted-foreground">Display name</Label>
                          <Input id="display-name" value={profile.name || ''} onChange={(e) => setProfile({ ...profile, name: e.target.value })} className="rounded-xl" />
                        </div>
                        <div>
                          <Label htmlFor="username" className="text-xs text-muted-foreground">Username</Label>
                          <Input id="username" value={profile.username || ''} onChange={(e) => setProfile({ ...profile, username: e.target.value.trim() })} placeholder="e.g., sophie" className="rounded-xl" />
                        </div>
                        <div>
                          <Label htmlFor="email" className="text-xs text-muted-foreground">Email</Label>
                          <Input id="email" value={email} disabled className="rounded-xl bg-muted/40" />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <Label htmlFor="age" className="text-xs text-muted-foreground">Age</Label>
                            <Input id="age" type="number" value={profile.age ?? ''} onChange={(e) => setProfile({ ...profile, age: e.target.value === '' ? undefined : Number(e.target.value) })} className="rounded-xl" />
                          </div>
                          <div>
                            <Label htmlFor="height" className="text-xs text-muted-foreground">Height (cm)</Label>
                            <Input id="height" type="number" value={profile.heightCm ?? ''} onChange={(e) => setProfile({ ...profile, heightCm: e.target.value === '' ? undefined : Number(e.target.value) })} className="rounded-xl" />
                          </div>
                          <div>
                            <Label htmlFor="weight" className="text-xs text-muted-foreground">Weight (kg)</Label>
                            <Input id="weight" type="number" value={profile.weightKg ?? ''} onChange={(e) => setProfile({ ...profile, weightKg: e.target.value === '' ? undefined : Number(e.target.value) })} className="rounded-xl" />
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="allergies" className="text-xs text-muted-foreground">Allergies (comma separated)</Label>
                          <Input id="allergies" value={(profile.allergies || []).join(', ')} onChange={(e) => setProfile({ ...profile, allergies: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} className="rounded-xl" />
                        </div>
                        <div>
                          <Label htmlFor="preexisting" className="text-xs text-muted-foreground">Pre-existing conditions</Label>
                          <Input id="preexisting" value={(profile.preexisting || []).join(', ')} onChange={(e) => setProfile({ ...profile, preexisting: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} className="rounded-xl" />
                        </div>
                        <div>
                          <Label htmlFor="medications" className="text-xs text-muted-foreground">Medications</Label>
                          <Input id="medications" value={(profile.medications || []).join(', ')} onChange={(e) => setProfile({ ...profile, medications: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} className="rounded-xl" />
                        </div>
                      </div>

                      <div className="p-4 flex justify-end sticky bottom-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75">
                        <Button onClick={saveProfile} className="rounded-xl">Save</Button>
                      </div>
                    </div>

                    <div className="rounded-xl border mt-4">
                      <div className="p-4 flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium text-destructive">Delete account</div>
                          <div className="text-xs text-muted-foreground">Permanently delete your account and cloud data. This action cannot be undone.</div>
                        </div>
                        <Button
                          variant="destructive"
                          className="rounded-xl"
                          onClick={async () => {
                            if (!auth.currentUser) { toast({ title: 'Please sign in' }); return; }
                            const ok = window.confirm('Are you sure you want to permanently delete your account?');
                            if (!ok) return;
                            const res = await deleteMyAccount();
                            if (res.ok) {
                              toast({ title: 'Account deleted' });
                              try { await auth.signOut(); } catch {}
                              window.location.href = '/login';
                              return;
                            }
                            if (res.requiresRecentLogin) {
                              toast({ title: 'Please sign in again', description: 'For security, please re-login and then delete your account.' });
                              return;
                            }
                            toast({ title: 'Deletion failed', description: 'Please try again later.' });
                          }}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SettingsDialog;
