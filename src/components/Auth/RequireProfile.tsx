import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { ref, get, child } from 'firebase/database';

export default function RequireProfile({ children }: { children: JSX.Element }) {
  const [user, setUser] = useState<User | null | undefined>(auth.currentUser ?? undefined);
  const [profileExists, setProfileExists] = useState<boolean | undefined>(() => {
    try {
      const v = sessionStorage.getItem('ojas.profile.exists');
      return v === null ? undefined : v === '1';
    } catch {
      return undefined;
    }
  });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        try {
          const snap = await get(child(ref(db), `users/${u.uid}/profile`));
          const exists = snap.exists();
          setProfileExists(exists);
          try { sessionStorage.setItem('ojas.profile.exists', exists ? '1' : '0'); } catch {}
        } catch {
          // Network/permission/transient error: don't redirect; keep loader until we know
          setProfileExists(undefined);
        }
      } else {
        setProfileExists(undefined);
        try { sessionStorage.removeItem('ojas.profile.exists'); } catch {}
      }
    });
    return () => unsub();
  }, []);

  if (user === undefined) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="oj-loader" aria-label="Loading" role="status" />
      <style>{`
        .oj-loader{width:60px;display:flex;align-items:flex-start;aspect-ratio:1}
        .oj-loader:before,.oj-loader:after{content:"";flex:1;aspect-ratio:1;--g:conic-gradient(from -90deg at 10px 10px,hsl(var(--primary)) 90deg,#0000 0);background:var(--g),var(--g),var(--g);filter:drop-shadow(30px 30px 0 hsl(var(--primary)));animation:l20 1s infinite}
        .oj-loader:after{transform:scaleX(-1)}
        @keyframes l20{0%{background-position:0 0,10px 10px,20px 20px}33%{background-position:10px 10px}66%{background-position:0 20px,10px 10px,20px 0}100%{background-position:0 0,10px 10px,20px 20px}}
      `}</style>
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  // If we have a cached positive profile, don't block UI; verify in the background above
  if (profileExists === undefined) {
    try {
      const cached = sessionStorage.getItem('ojas.profile.exists');
      if (cached === '1') {
        return children;
      }
    } catch {}
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="oj-loader" aria-label="Loading" role="status" />
        <style>{`
          .oj-loader{width:60px;display:flex;align-items:flex-start;aspect-ratio:1}
          .oj-loader:before,.oj-loader:after{content:"";flex:1;aspect-ratio:1;--g:conic-gradient(from -90deg at 10px 10px,hsl(var(--primary)) 90deg,#0000 0);background:var(--g),var(--g),var(--g);filter:drop-shadow(30px 30px 0 hsl(var(--primary)));animation:l20 1s infinite}
          .oj-loader:after{transform:scaleX(-1)}
          @keyframes l20{0%{background-position:0 0,10px 10px,20px 20px}33%{background-position:10px 10px}66%{background-position:0 20px,10px 10px,20px 0}100%{background-position:0 0,10px 10px,20px 20px}}
        `}</style>
      </div>
    );
  }
  if (!profileExists) return <Navigate to="/onboarding" replace />;
  return children;
}
