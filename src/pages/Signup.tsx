import { useState } from 'react';
import AuthLayout from '@/components/Auth/AuthLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { signupWithEmail, loginWithGoogle } from '@/lib/auth';
import { useNavigate, Link } from 'react-router-dom';

export default function Signup() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError(null);
    try { await signupWithEmail(email, password, name); navigate('/'); } catch (err: unknown) { const msg = (err as { message?: string })?.message || 'Failed to sign up'; setError(msg); } finally { setLoading(false); }
  };
  const onGoogle = async () => { setLoading(true); setError(null); try { await loginWithGoogle(); navigate('/'); } catch (e: unknown) { const msg = (e as { message?: string })?.message || 'Google sign-in failed'; setError(msg); } finally { setLoading(false); } };

  const form = (
    <Card>
      <CardHeader>
        <CardTitle>Create your account</CardTitle>
  <CardDescription>Join Ojas and start chatting.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <div className="text-sm text-destructive">{error}</div>}
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
          </div>
          <Button className="w-full" disabled={loading} type="submit">{loading ? 'Creating…' : 'Create account'}</Button>
        </form>
        <div className="flex items-center gap-2"><Separator className="flex-1" /><span className="text-xs text-muted-foreground">OR</span><Separator className="flex-1" /></div>
        <Button variant="outline" className="w-full" type="button" onClick={onGoogle}>Continue with Google</Button>
        <p className="text-sm text-center text-muted-foreground">Already have an account? <Link to="/login" className="text-primary hover:text-[hsl(var(--primary-hover))] underline underline-offset-4">Sign in</Link></p>
      </CardContent>
    </Card>
  );

  const info = (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <img src="/logo-jas.svg" alt="Ojas logo" className="h-8 w-8" />
        <span className="font-hero text-lg leading-none">Ojas</span>
      </div>
      <h2 className="font-hero text-3xl md:text-4xl">Welcome to Ojas</h2>
      <p className="text-muted-foreground">Set up your account in seconds and get a smarter assistant for everyday tasks.</p>
      <ul className="text-sm list-disc pl-5 text-muted-foreground space-y-1">
        <li>Privacy-first chat</li>
        <li>Health-aware guidance</li>
        <li>Simple, fast, and helpful</li>
      </ul>
    </div>
  );

  return <AuthLayout form={form} info={info} initialSide="right" />;
}
