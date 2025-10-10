import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ArrowLeftRight } from 'lucide-react';
import { loginWithEmail, loginWithGoogle, sendReset, signupWithEmail } from '@/lib/auth';

type Mode = 'login' | 'signup';

export default function Auth({ initialMode }: { initialMode?: Mode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const defaultMode: Mode = (initialMode || (location.pathname.includes('login') ? 'login' : 'signup')) as Mode;
  const [mode, setMode] = useState<Mode>(defaultMode);
  const [formSide, setFormSide] = useState<'left' | 'right'>(defaultMode === 'signup' ? 'right' : 'left');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = () => {
    const nextMode: Mode = mode === 'signup' ? 'login' : 'signup';
    setMode(nextMode);
    setFormSide((s) => (s === 'left' ? 'right' : 'left'));
    navigate(nextMode === 'signup' ? '/signup' : '/login', { replace: true });
  };

  const onGoogle = async () => {
    setLoading(true); setError(null);
    try { await loginWithGoogle(); navigate('/onboarding'); } catch (e: unknown) { const msg = (e as { message?: string })?.message || 'Google sign-in failed'; setError(msg); } finally { setLoading(false); }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError(null);
    try {
      if (mode === 'signup') {
        await signupWithEmail(email, password, name);
      } else {
        await loginWithEmail(email, password);
      }
      navigate('/onboarding');
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message || 'Authentication failed';
      setError(msg);
    } finally { setLoading(false); }
  };

  const onForgot = async () => { if (!email) return; try { await sendReset(email); alert('Password reset email sent'); } catch (e: unknown) { const msg = (e as { message?: string })?.message || 'Failed to send reset'; setError(msg); } };

  const title = mode === 'signup' ? 'Create your account' : 'Welcome back!';
  const desc = mode === 'signup' ? 'Join Ojas and start chatting.' : 'Sign in to continue your chats.';
  const submitLabel = mode === 'signup' ? (loading ? 'Creating…' : 'Create account') : (loading ? 'Signing in…' : 'Sign In');

  // React 19: No useMemo needed - React Compiler optimizes automatically
  const info = (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <img src="/logo-jas.svg" alt="Ojas logo" className="h-8 w-8" />
        <span className="font-hero text-lg leading-none">Ojas</span>
      </div>
      {mode === 'signup' ? (
        <>
          <h2 className="font-hero text-3xl md:text-4xl">Welcome to Ojas</h2>
          <p className="text-muted-foreground">Set up your account in seconds and get a smarter assistant for everyday tasks.</p>
          <ul className="text-sm list-disc pl-5 text-muted-foreground space-y-1">
            <li>Privacy-first chat</li>
            <li>Health-aware guidance</li>
            <li>Simple, fast, and helpful</li>
          </ul>
        </>
      ) : (
        <>
          <h2 className="font-hero text-3xl md:text-4xl">Rejoin your Ojas conversations</h2>
          <p className="text-muted-foreground">Pick up where you left off—securely, quickly, and with your preferences intact.</p>
          <div className="text-xs text-muted-foreground">Tip: You can switch sides with the slider in the middle.</div>
        </>
      )}
    </div>
  );

  return (
    <div className="relative min-h-screen grid grid-cols-1 md:grid-cols-2 bg-background">
      {/* Left info panel */}
      <div className={(formSide === 'left' ? 'order-2' : 'order-1') + ' hidden md:flex items-center justify-center p-10 bg-sidebar text-sidebar-foreground'}>
        <div className="max-w-lg">{info}</div>
        <div className="absolute inset-y-0 left-1/2 w-px bg-sidebar-border" aria-hidden />
      </div>

      {/* Right/left form panel */}
      <div className={(formSide === 'left' ? 'order-1' : 'order-2') + ' flex items-center justify-center p-6 md:p-10'}>
        <div className="w-full max-w-md">
          <Card>
            <CardHeader>
              <CardTitle>{title}</CardTitle>
              <CardDescription>{desc}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && <div className="text-sm text-destructive">{error}</div>}
              <form onSubmit={onSubmit} className="space-y-4">
                {mode === 'signup' && (
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" required />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    {mode === 'login' && (
                      <button type="button" onClick={onForgot} className="text-xs text-primary hover:text-[hsl(var(--primary-hover))]">Forgot?</button>
                    )}
                  </div>
                  <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
                </div>
                <Button className="w-full" disabled={loading} type="submit">{submitLabel}</Button>
              </form>
              <div className="flex items-center gap-2"><Separator className="flex-1" /><span className="text-xs text-muted-foreground">OR</span><Separator className="flex-1" /></div>
              <Button variant="outline" className="w-full" type="button" onClick={onGoogle}>Continue with Google</Button>
              {mode === 'signup' ? (
                <p className="text-sm text-center text-muted-foreground">Already have an account? <button onClick={toggle} className="text-primary hover:text-[hsl(var(--primary-hover))] underline underline-offset-4">Sign in</button></p>
              ) : (
                <p className="text-sm text-center text-muted-foreground">Don't have an account? <button onClick={toggle} className="text-primary hover:text-[hsl(var(--primary-hover))] underline underline-offset-4">Sign up</button></p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Center slider button (desktop) */}
      <div className="hidden md:flex absolute inset-y-0 left-1/2 -translate-x-1/2 items-center pointer-events-none">
        <Button variant="outline" size="icon" onClick={toggle} className="pointer-events-auto rounded-full shadow bg-background hover:bg-muted" aria-label="Swap sides">
          <ArrowLeftRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
