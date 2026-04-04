import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { motion } from 'framer-motion';
import { Sparkles, ArrowRight, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

type Tab = 'signin' | 'signup' | 'admin';

export default function Auth() {
  const [tab, setTab]                     = useState<Tab>('signin');
  const [email, setEmail]                 = useState('');
  const [password, setPassword]           = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName]           = useState('');
  const [phone, setPhone]                 = useState('');
  const [showPassword, setShowPassword]   = useState(false);
  const [loading, setLoading]             = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const { signIn, signUp, signInWithGoogle } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const resetForm = () => {
    setEmail(''); setPassword(''); setConfirmPassword('');
    setFullName(''); setPhone(''); setShowPassword(false);
  };

  const switchTab = (t: Tab) => { setTab(t); resetForm(); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (tab === 'signup') {
      if (password !== confirmPassword) {
        toast({ title: 'Passwords do not match', variant: 'destructive' }); return;
      }
      if (password.length < 6) {
        toast({ title: 'Password must be at least 6 characters', variant: 'destructive' }); return;
      }
    }
    setLoading(true);
    try {
      if (tab === 'signup') {
        await signUp(email, password, { full_name: fullName, phone });
        toast({ title: 'Account created!', description: 'Check your email to confirm.' });
      } else {
        // both 'signin' and 'admin' use signIn
        await signIn(email, password);
        if (tab === 'admin') navigate('/admin');
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    try {
      // Store which tab triggered Google login so we can redirect after OAuth callback
      if (tab === 'admin') sessionStorage.setItem('google_login_intent', 'admin');
      else sessionStorage.removeItem('google_login_intent');
      await signInWithGoogle();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <Card className="glass-card shadow-2xl">
          <CardHeader className="text-center space-y-3 pb-4">
            <div className="mx-auto w-12 h-12 rounded-xl gradient-primary flex items-center justify-center">
              {tab === 'admin'
                ? <ShieldCheck className="w-6 h-6 text-primary-foreground" />
                : <Sparkles className="w-6 h-6 text-primary-foreground" />}
            </div>
            <CardTitle className="text-2xl font-bold gradient-text">AI Todo Planner</CardTitle>
            <CardDescription>
              {tab === 'signup' ? 'Create your account' : tab === 'admin' ? 'Admin access only' : 'Welcome back'}
            </CardDescription>
          </CardHeader>

          <CardContent className="px-6 pb-6 space-y-4">
            {/* Tab switcher */}
            <div className="flex gap-1 p-1 bg-muted rounded-lg">
              {([
                { key: 'signin', label: 'Sign In' },
                { key: 'signup', label: 'Sign Up' },
                { key: 'admin',  label: '🛡️ Admin' },
              ] as { key: Tab; label: string }[]).map(t => (
                <button
                  key={t.key}
                  onClick={() => switchTab(t.key)}
                  className={cn(
                    'flex-1 text-xs py-1.5 rounded-md font-medium transition-all',
                    tab === t.key
                      ? 'bg-background shadow-sm text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Google button — all tabs */}
            <Button
              type="button"
              variant="outline"
              className="w-full h-10 gap-3 font-medium"
              onClick={handleGoogle}
              disabled={googleLoading}
            >
              {googleLoading ? (
                <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              )}
              Continue with Google
            </Button>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground">or</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Admin notice */}
            {tab === 'admin' && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
                <p className="text-xs text-amber-400">Super Admin & Admin login. Restricted access only.</p>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-3">
              {tab === 'signup' && (
                <>
                  <div className="space-y-1.5">
                    <Label>Full Name</Label>
                    <Input placeholder="John Doe" value={fullName}
                      onChange={e => setFullName(e.target.value)} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Phone Number</Label>
                    <Input type="tel" placeholder="+91 9876543210" value={phone}
                      onChange={e => setPhone(e.target.value)} required />
                  </div>
                </>
              )}

              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" placeholder="you@example.com" value={email}
                  onChange={e => setEmail(e.target.value)} required />
              </div>

              <div className="space-y-1.5">
                <Label>Password</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Min 6 characters"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required minLength={6}
                    className="pr-10"
                  />
                  <button type="button" onClick={() => setShowPassword(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {tab === 'signup' && (
                <div className="space-y-1.5">
                  <Label>Confirm Password</Label>
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Re-enter password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    required minLength={6}
                  />
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className={cn(
                  'w-full h-10 font-medium mt-1',
                  tab === 'admin'
                    ? 'bg-amber-500 hover:bg-amber-600 text-white'
                    : 'gradient-primary text-primary-foreground'
                )}
              >
                {loading ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    {tab === 'signup' ? 'Create Account' : tab === 'admin' ? 'Admin Sign In' : 'Sign In'}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </form>

            {tab !== 'admin' && (
              <p className="text-center text-xs text-muted-foreground">
                {tab === 'signup' ? 'Already have an account? ' : "Don't have an account? "}
                <button
                  onClick={() => switchTab(tab === 'signup' ? 'signin' : 'signup')}
                  className="text-primary hover:underline font-semibold"
                >
                  {tab === 'signup' ? 'Sign In' : 'Sign Up'}
                </button>
              </p>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
