import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { signupWithEmail, loginWithGoogle } from '@/lib/auth';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, Check, X, ArrowLeftRight } from 'lucide-react';
import { auth } from '@/lib/firebase';

const GoogleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 48 48">
    <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s12-5.373 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-2.641-.21-5.236-.611-7.743z" />
    <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
    <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
    <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C42.022 35.026 44 30.038 44 24c0-2.641-.21-5.236-.611-7.743z" />
  </svg>
);

const GlassInputWrapper = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-xl border border-border bg-muted/20 backdrop-blur-sm transition-colors focus-within:border-primary/50 focus-within:bg-primary/5">
    {children}
  </div>
);

export default function Signup() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  // If the user is already signed in (persisted session), redirect immediately
  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => {
      if (user) navigate('/app', { replace: true });
    });
    return () => unsub();
  }, [navigate]);

  // Password strength validation
  const getPasswordStrength = (pwd: string) => {
    const checks = {
      length: pwd.length >= 8,
      uppercase: /[A-Z]/.test(pwd),
      lowercase: /[a-z]/.test(pwd),
      number: /\d/.test(pwd),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(pwd)
    };
    const score = Object.values(checks).filter(Boolean).length;
    return { checks, score, strength: score < 3 ? 'weak' : score < 5 ? 'medium' : 'strong' };
  };

  const passwordStrength = getPasswordStrength(password);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check password strength
    if (passwordStrength.score < 3) {
      setError('Please create a stronger password');
      return;
    }
    
    // Show confirmation dialog
    setShowConfirmDialog(true);
  };

  const handleConfirmSignup = async () => {
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    setLoading(true); setError(null);
    try { 
      await signupWithEmail(email, password, name); 
      navigate('/verify-email', { state: { email } }); 
    } catch (err: unknown) { 
      const msg = (err as { message?: string })?.message || 'Failed to sign up'; 
      setError(msg); 
    } finally { 
      setLoading(false); 
      setShowConfirmDialog(false);
    }
  };
  
  const onGoogle = async () => { 
    setLoading(true); setError(null); 
    try { await loginWithGoogle(); navigate('/app', { replace: true }); } catch (e: unknown) { 
      const msg = (e as { message?: string })?.message || 'Google sign-in failed'; 
      setError(msg); 
    } finally { setLoading(false); } 
  };

  return (
    <div className="relative min-h-screen grid grid-cols-1 md:grid-cols-2 bg-background">
      {/* Left info panel */}
      <div className="hidden md:flex items-center justify-center p-10 bg-sidebar text-sidebar-foreground order-1 relative">
        <div className="max-w-lg relative z-10">
          <div className="space-y-6">
            {/* Logo with exact onboarding structure */}
            <div className="flex items-center gap-0.5">
              <img src="/logo-jas.svg" alt="Ojas logo" className="h-8 w-8" />
              <span className="text-2xl font-hero mt-1">jas</span>
            </div>
            <h2 className="font-hero text-3xl md:text-4xl">Welcome to Ojas</h2>
            <p className="text-muted-foreground">Set up your account in seconds and get a smarter assistant for everyday tasks.</p>
            <ul className="text-sm list-disc pl-5 text-muted-foreground space-y-1">
              <li>Privacy-first chat</li>
              <li>Health-aware guidance</li>
              <li>Simple, fast, and helpful</li>
            </ul>
          </div>
        </div>
        <div className="absolute inset-0 bg-gradient-to-br from-sidebar to-sidebar/80" />
      </div>

      {/* Right/left form panel */}
      <div className="flex items-center justify-center p-6 md:p-10 order-2">
        <div className="w-full max-w-md">
          <div className="flex flex-col gap-6">
            <h1 className="text-4xl md:text-5xl font-semibold leading-tight">
              <span className="font-light text-foreground tracking-tighter">Join Ojas</span>
            </h1>
            <p className="text-muted-foreground">Create your account and start chatting</p>

            {error && <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">{error}</div>}

            <form className="space-y-5" onSubmit={onSubmit}>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Full Name</label>
                <GlassInputWrapper>
                  <input 
                    name="name" 
                    type="text" 
                    placeholder="Enter your full name" 
                    className="w-full bg-transparent text-sm p-4 rounded-xl focus:outline-none" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </GlassInputWrapper>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">Email Address</label>
                <GlassInputWrapper>
                  <input 
                    name="email" 
                    type="email" 
                    placeholder="Enter your email address" 
                    className="w-full bg-transparent text-sm p-4 rounded-xl focus:outline-none" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </GlassInputWrapper>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">Password</label>
                <GlassInputWrapper>
                  <div className="relative">
                    <input 
                      name="password" 
                      type={showPassword ? 'text' : 'password'} 
                      placeholder="Create a strong password" 
                      className="w-full bg-transparent text-sm p-4 pr-12 rounded-xl focus:outline-none" 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <button 
                      type="button" 
                      onClick={() => setShowPassword(!showPassword)} 
                      className="absolute inset-y-0 right-3 flex items-center"
                    >
                      {showPassword ? 
                        <EyeOff className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" /> : 
                        <Eye className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />
                      }
                    </button>
                  </div>
                </GlassInputWrapper>
                
                {/* Password Strength Indicator */}
                {password && (
                  <div className="mt-2 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-muted rounded-full h-1">
                        <div 
                          className={`h-1 rounded-full transition-all ${
                            passwordStrength.strength === 'weak' ? 'bg-red-500 w-1/3' :
                            passwordStrength.strength === 'medium' ? 'bg-yellow-500 w-2/3' :
                            'bg-green-500 w-full'
                          }`}
                        />
                      </div>
                      <span className={`text-xs font-medium ${
                        passwordStrength.strength === 'weak' ? 'text-red-500' :
                        passwordStrength.strength === 'medium' ? 'text-yellow-500' :
                        'text-green-500'
                      }`}>
                        {passwordStrength.strength.charAt(0).toUpperCase() + passwordStrength.strength.slice(1)}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-xs">
                      <div className={`flex items-center gap-1 ${passwordStrength.checks.length ? 'text-green-500' : 'text-muted-foreground'}`}>
                        {passwordStrength.checks.length ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                        8+ characters
                      </div>
                      <div className={`flex items-center gap-1 ${passwordStrength.checks.uppercase ? 'text-green-500' : 'text-muted-foreground'}`}>
                        {passwordStrength.checks.uppercase ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                        Uppercase
                      </div>
                      <div className={`flex items-center gap-1 ${passwordStrength.checks.lowercase ? 'text-green-500' : 'text-muted-foreground'}`}>
                        {passwordStrength.checks.lowercase ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                        Lowercase
                      </div>
                      <div className={`flex items-center gap-1 ${passwordStrength.checks.number ? 'text-green-500' : 'text-muted-foreground'}`}>
                        {passwordStrength.checks.number ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                        Number
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="text-sm">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" name="terms" className="rounded border-border" required />
                  <span className="text-foreground/90">I agree to the <Link to="/terms" className="text-primary hover:underline">Terms of Service</Link> and <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link></span>
                </label>
              </div>

              <Button type="submit" disabled={loading} className="w-full rounded-xl py-4 font-medium">
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="oj-loader-small" aria-label="Loading" role="status" />
                    Creating account...
                  </div>
                ) : 'Create Account'}
              </Button>
            </form>

            <div className="relative flex items-center justify-center">
              <span className="w-full border-t border-border"></span>
              <span className="px-4 text-sm text-muted-foreground bg-background absolute">Or continue with</span>
            </div>

            <Button 
              onClick={onGoogle} 
              variant="outline" 
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 border border-border rounded-xl py-4 hover:bg-secondary transition-colors"
            >
              <GoogleIcon />
              Continue with Google
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Already have an account? <Link to="/login" className="text-primary hover:underline transition-colors">Sign In</Link>
            </p>
          </div>
        </div>
      </div>

      {/* Password Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-background rounded-xl p-6 w-full max-w-md border border-border">
            <h3 className="text-lg font-semibold mb-4">Confirm Your Password</h3>
            <p className="text-sm text-muted-foreground mb-4">Please re-enter your password to confirm account creation.</p>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Confirm Password</label>
                <GlassInputWrapper>
                  <input 
                    type="password" 
                    placeholder="Re-enter your password" 
                    className="w-full bg-transparent text-sm p-4 rounded-xl focus:outline-none" 
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleConfirmSignup()}
                  />
                </GlassInputWrapper>
                {confirmPassword && password !== confirmPassword && (
                  <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
                )}
              </div>
              
              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setShowConfirmDialog(false);
                    setConfirmPassword('');
                    setError(null);
                  }}
                  className="flex-1"
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleConfirmSignup}
                  disabled={loading || !confirmPassword || password !== confirmPassword}
                  className="flex-1"
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="oj-loader-small" aria-label="Loading" role="status" />
                      Creating...
                    </div>
                  ) : 'Create Account'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Center slider button (desktop) */}
      <div className="hidden md:flex absolute inset-y-0 left-1/2 -translate-x-1/2 items-center pointer-events-none z-10">
        <Link to="/login">
          <Button 
            variant="outline" 
            size="icon" 
            className="pointer-events-auto rounded-full shadow-lg bg-background/95 backdrop-blur-sm border-border/50 hover:bg-muted/80 transition-all" 
            aria-label="Go to login"
          >
            <ArrowLeftRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>

      <style>{`
        .oj-loader-small{width:20px;display:flex;align-items:flex-start;aspect-ratio:1}
        .oj-loader-small:before,.oj-loader-small:after{content:"";flex:1;aspect-ratio:1;--g:conic-gradient(from -90deg at 3px 3px,hsl(var(--primary-foreground)) 90deg,#0000 0);background:var(--g),var(--g),var(--g);filter:drop-shadow(10px 10px 0 hsl(var(--primary-foreground)));animation:l20-small 1s infinite}
        .oj-loader-small:after{transform:scaleX(-1)}
        @keyframes l20-small{0%{background-position:0 0,3px 3px,6px 6px}33%{background-position:3px 3px}66%{background-position:0 6px,3px 3px,6px 0}100%{background-position:0 0,3px 3px,6px 6px}}
      `}</style>
    </div>
  );
}
