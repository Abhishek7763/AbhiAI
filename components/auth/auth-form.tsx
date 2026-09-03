'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Loader2, Mail, Lock } from 'lucide-react';
import { AbhiLogo } from '@/components/brand/logo';

export default function AuthForm() {
  const [supabase] = useState(() => createClient());
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (isLogin) {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
        router.push('/');
        router.refresh();
      } else {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${location.origin}/auth/callback` },
        });
        if (signUpError) throw signUpError;
        setMessage('Check your email for the confirmation link.');
      }
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'An error occurred during authentication.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setError(null);
    setMessage(null);
    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${location.origin}/auth/callback` },
      });
      if (oauthError) throw oauthError;
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Google sign-in could not be started.');
      setGoogleLoading(false);
    }
  };

  const busy = loading || googleLoading;

  return (
    <div className="w-full max-w-md mx-auto p-7 sm:p-8 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-xl">
      <div className="flex flex-col items-center mb-7">
        <div className="mb-5"><AbhiLogo variant="full" size="lg" /></div>
        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
          {isLogin ? 'Welcome back to AbhiAI' : 'Create your AbhiAI Account'}
        </h2>
        <p className="text-sm text-zinc-500 mt-1.5 text-center">
          {isLogin ? 'Sign in to sync chats and creations across your devices' : 'Create an account for private cloud sync and AI history'}
        </p>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-xl border border-red-200 dark:border-red-900/30">{error}</div>}
      {message && <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 text-sm rounded-xl border border-green-200 dark:border-green-900/30">{message}</div>}

      <button
        type="button"
        disabled={busy}
        onClick={() => void handleGoogleSignIn()}
        className="w-full py-3 px-4 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-xl font-medium transition-colors flex items-center justify-center gap-2.5 disabled:opacity-60"
      >
        {googleLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span className="w-5 h-5 rounded-full border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-xs font-bold">G</span>}
        Continue with Google
      </button>

      <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-wider text-zinc-400">
        <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
        or use email
        <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1.5">Email address</label>
          <div className="relative">
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required disabled={busy} className="w-full pl-10 pr-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 outline-none text-zinc-900 dark:text-zinc-100 disabled:opacity-60" placeholder="you@example.com" />
            <Mail className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3.5" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1.5">Password</label>
          <div className="relative">
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={6} disabled={busy} className="w-full pl-10 pr-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 outline-none text-zinc-900 dark:text-zinc-100 disabled:opacity-60" placeholder="••••••••" />
            <Lock className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3.5" />
          </div>
        </div>

        <button type="submit" disabled={busy} className="w-full py-3.5 px-4 bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 rounded-xl font-medium transition-all flex items-center justify-center gap-2 shadow-sm active:scale-[0.99] disabled:opacity-60">
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {isLogin ? 'Sign In to AbhiAI' : 'Create Account'}
        </button>
      </form>

      <div className="mt-6 text-center">
        <button type="button" disabled={busy} onClick={() => { setIsLogin((value) => !value); setError(null); setMessage(null); }} className="text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors disabled:opacity-60">
          {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
        </button>
      </div>
    </div>
  );
}
