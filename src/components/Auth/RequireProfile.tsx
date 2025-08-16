import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { ref, get, child } from 'firebase/database';

export default function RequireProfile({ children }: { children: JSX.Element }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [profileExists, setProfileExists] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        try {
          const snap = await get(child(ref(db), `users/${u.uid}/profile`));
          setProfileExists(snap.exists());
        } catch {
          setProfileExists(false);
        }
      } else {
        setProfileExists(undefined);
      }
    });
    return () => unsub();
  }, []);

  if (user === undefined) return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (profileExists === undefined) return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">Loading profile…</div>;
  if (!profileExists) return <Navigate to="/onboarding" replace />;
  return children;
}
