'use client';

import { useFormStatus } from 'react-dom';
import { Loader2, LogIn } from 'lucide-react';
import { login } from '@/app/admin/login/actions';

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full bg-white hover:bg-zinc-200 text-zinc-950 font-semibold py-2.5 rounded-xl transition-all shadow-sm mt-2 disabled:opacity-60 disabled:cursor-wait inline-flex items-center justify-center gap-2"
    >
      {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
      {pending ? 'Signing in…' : 'Sign In to Dashboard'}
    </button>
  );
}

export default function AdminLoginForm() {
  return (
    <form className="space-y-4" action={login}>
      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-1.5" htmlFor="email">
          Email Address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="admin@example.com"
          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm outline-none text-zinc-100 focus:ring-2 focus:ring-zinc-400 transition-all placeholder:text-zinc-600"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-1.5" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          placeholder="••••••••"
          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm outline-none text-zinc-100 focus:ring-2 focus:ring-zinc-400 transition-all placeholder:text-zinc-600"
        />
      </div>

      <SubmitButton />
    </form>
  );
}
