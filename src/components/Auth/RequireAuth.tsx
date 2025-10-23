import { useEffect, useState } from 'react';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Navigate } from 'react-router-dom';

export default function RequireAuth({ children }: { children: JSX.Element }) {
  const [user, setUser] = useState<User | null | undefined>(auth.currentUser ?? undefined);
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, setUser);
    return () => unsub();
  }, []);
  useEffect(() => {
    const check = async () => {
      try { if (auth.currentUser) await auth.currentUser.reload(); } catch {}
    };
    check();
  }, [user?.uid]);
  // Force refresh token once to invalidate stale sessions
  useEffect(() => {
    const check = async () => {
      try {
        if (auth.currentUser) {
          await auth.currentUser.getIdToken(true);
        }
      } catch (e) {
        setUser(null);
      }
    };
    check();
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
  if (user && !user.emailVerified) return <Navigate to="/verify-email" replace />;
  return children;
}
