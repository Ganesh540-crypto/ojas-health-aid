import { useEffect, useState } from 'react';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { Navigate } from 'react-router-dom';

export default function RequireAuth({ children }: { children: JSX.Element }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, setUser);
    return () => unsub();
  }, []);
  // Force refresh token once to invalidate stale sessions
  useEffect(() => {
    const check = async () => {
      try {
        if (auth.currentUser) {
          await auth.currentUser.getIdToken(true);
        }
      } catch (e) {
        await signOut(auth);
        setUser(null);
      }
    };
    check();
  }, []);
  if (user === undefined) return null; // TODO: optional spinner
  if (!user) return <Navigate to="/login" replace />;
  return children;
}
