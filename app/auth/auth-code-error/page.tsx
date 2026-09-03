import Link from 'next/link';
import { AlertCircle, ArrowLeft } from 'lucide-react';

export default function AuthCodeErrorPage() {
  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 px-4 flex items-center justify-center">
      <div className="w-full max-w-md rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-7 text-center shadow-xl">
        <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Sign-in link could not be completed</h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">The link may have expired or the provider returned an invalid session. Start sign-in again.</p>
        <Link href="/auth" className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2.5 text-sm font-medium">
          <ArrowLeft className="w-4 h-4" />
          Return to sign in
        </Link>
      </div>
    </main>
  );
}
