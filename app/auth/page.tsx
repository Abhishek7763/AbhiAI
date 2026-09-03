import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import AuthForm from '@/components/auth/auth-form';

export default function AuthPage() {
  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 px-4 py-6 sm:py-10 flex flex-col">
      <div className="w-full max-w-md mx-auto mb-4">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to chat
        </Link>
      </div>
      <div className="flex-1 flex items-center justify-center w-full">
        <AuthForm />
      </div>
    </main>
  );
}
