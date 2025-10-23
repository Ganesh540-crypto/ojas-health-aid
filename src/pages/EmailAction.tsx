import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { applyActionCode, checkActionCode } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export default function EmailAction() {
  const nav = useNavigate();
  const loc = useLocation();
  const [status, setStatus] = useState<'working'|'success'|'error'>('working');
  const [message, setMessage] = useState<string>('Verifying your email…');

  useEffect(() => {
    const params = new URLSearchParams(loc.search);
    const mode = params.get('mode');
    const oobCode = params.get('oobCode');
    if (!mode || !oobCode) { setStatus('error'); setMessage('Invalid verification link.'); return; }

    const run = async () => {
      try {
        if (mode === 'verifyEmail') {
          // Optional pre-check helps show clearer errors before apply
          await checkActionCode(auth, oobCode);
          await applyActionCode(auth, oobCode);
          await auth.currentUser?.reload().catch(() => {});
          setStatus('success');
          setMessage('Email verified. Redirecting…');
          // If already signed in, go straight to onboarding; else ask to login then continue
          setTimeout(() => {
            if (auth.currentUser) nav('/onboarding', { replace: true });
            else nav('/login?verified=1', { replace: true, state: { next: '/onboarding' } });
          }, 600);
          return;
        }
        setStatus('error');
        setMessage('Unsupported action.');
      } catch (e) {
        setStatus('error');
        setMessage('This link is invalid or expired.');
      }
    };
    run();
  }, [loc.search, nav]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm text-center">
        {status === 'working' && (
          <div className="oj-loader mx-auto mb-4" aria-label="Loading" role="status" />
        )}
        {status === 'success' && (
          <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-green-600 text-white flex items-center justify-center text-2xl" aria-hidden>✓</div>
        )}
        {status === 'error' && (
          <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-red-600 text-white flex items-center justify-center text-2xl" aria-hidden>!</div>
        )}
        <p className={status === 'error' ? 'text-destructive' : 'text-muted-foreground'}>{message}</p>
        <style>{`
          .oj-loader{width:60px;display:flex;align-items:flex-start;aspect-ratio:1}
          .oj-loader:before,.oj-loader:after{content:"";flex:1;aspect-ratio:1;--g:conic-gradient(from -90deg at 10px 10px,hsl(var(--primary)) 90deg,#0000 0);background:var(--g),var(--g),var(--g);filter:drop-shadow(30px 30px 0 hsl(var(--primary)));animation:l20 1s infinite}
          .oj-loader:after{transform:scaleX(-1)}
          @keyframes l20{0%{background-position:0 0,10px 10px,20px 20px}33%{background-position:10px 10px}66%{background-position:0 20px,10px 10px,20px 0}100%{background-position:0 0,10px 10px,20px 20px}}
        `}</style>
      </div>
    </div>
  );
}
