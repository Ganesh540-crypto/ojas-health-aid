import { useState } from 'react';
import AuthLayout from '@/components/Auth/AuthLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { loginWithEmail, loginWithGoogle, sendReset } from '@/lib/auth';
import { useNavigate, Link } from 'react-router-dom';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      await loginWithEmail(email, password);
      navigate('/');
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message || 'Failed to sign in';
      setError(msg);
    } finally { setLoading(false); }
  };

  const onGoogle = async () => {
    setLoading(true); setError(null);
  try { await loginWithGoogle(); navigate('/'); } catch (err: unknown) { const msg = (err as { message?: string })?.message || 'Google sign-in failed'; setError(msg); } finally { setLoading(false); }
  };

  const onForgot = async () => { if (!email) return; try { await sendReset(email); alert('Password reset email sent'); } catch (e: unknown) { const msg = (e as { message?: string })?.message || 'Failed to send reset'; setError(msg); } };

  const form = (
    <Card>
      <CardHeader>
        <CardTitle>Welcome Back!</CardTitle>
        <CardDescription>Sign in to continue your chats.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <div className="text-sm text-destructive">{error}</div>}
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <button type="button" onClick={onForgot} className="text-xs text-primary hover:text-[hsl(var(--primary-hover))]">Forgot?</button>
            </div>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
          </div>
          <Button className="w-full" disabled={loading} type="submit">{loading ? 'Signing in…' : 'Sign In'}</Button>
        </form>
        <div className="flex items-center gap-2"><Separator className="flex-1" /><span className="text-xs text-muted-foreground">OR</span><Separator className="flex-1" /></div>
        <Button variant="outline" className="w-full" type="button" onClick={onGoogle}>Continue with Google</Button>
        <p className="text-sm text-center text-muted-foreground">Don't have an account? <Link to="/signup" className="text-primary hover:text-[hsl(var(--primary-hover))] underline underline-offset-4">Sign up</Link></p>
      </CardContent>
    </Card>
  );

  const info = (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <img src="/logo-jas.svg" alt="Ojas logo" className="h-8 w-8" />
        <span className="font-hero text-lg leading-none">Ojas</span>
      </div>
      <h2 className="font-hero text-3xl md:text-4xl">Chat smarter with Ojas</h2>
      <p className="text-muted-foreground">Private, fast, and helpful conversations tailored to you. Your health and daily tasks—simplified.</p>
      <div className="text-xs text-muted-foreground">Join thousands using Ojas for everyday assistance.</div>
    </div>
  );

  return <AuthLayout form={form} info={info} initialSide="left" />;
}
