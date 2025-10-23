import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { auth } from '@/lib/firebase';
import { sendEmailVerification } from 'firebase/auth';

export default function VerifyEmail() {
  const nav = useNavigate();
  const location = useLocation() as any;
  const [sending, setSending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const email = useMemo(() => auth.currentUser?.email || location?.state?.email || '', [location?.state?.email]);

  useEffect(() => {
    // If already verified (e.g., came back after link), go to onboarding
    const run = async () => {
      try {
        if (auth.currentUser) {
          await auth.currentUser.reload();
          if (auth.currentUser.emailVerified) {
            nav('/onboarding', { replace: true });
          }
        }
      } catch {}
    };
    run();
  }, [nav]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>Verify your email</CardTitle>
            <CardDescription>
              We sent a verification link to {email ? <span className="font-medium">{email}</span> : 'your email'}.
              Click the link, then return here.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {info && <div className="text-sm text-muted-foreground">{info}</div>}
            <div className="grid grid-cols-1 gap-3">
              <Button
                disabled={sending}
                onClick={async () => {
                  if (!auth.currentUser) { setInfo('Please sign in again to resend the link.'); return; }
                  setSending(true);
                  try {
                    await sendEmailVerification(auth.currentUser, {
                      url: `https://app.ojasai.co.in/email-action`,
                      handleCodeInApp: true,
                    } as any);
                    setInfo('Verification link sent. Check your inbox.');
                  } catch {
                    setInfo('Failed to send link. Please try again.');
                  } finally { setSending(false); }
                }}
              >{sending ? 'Sending…' : 'Resend verification link'}</Button>

              <Button variant="outline" onClick={() => window.open('https://mail.google.com', '_blank')}>Open Gmail</Button>

              <Button
                variant="secondary"
                disabled={checking}
                onClick={async () => {
                  setChecking(true);
                  try {
                    await auth.currentUser?.reload();
                    if (auth.currentUser?.emailVerified) nav('/onboarding', { replace: true });
                    else setInfo('Still not verified. Click the link in your email, then try again.');
                  } finally { setChecking(false); }
                }}
              >{checking ? 'Checking…' : 'I verified, continue'}</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
