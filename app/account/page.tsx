import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { AccountDashboard } from '@/components/auth/account-dashboard';
import { AbhiLogo } from '@/components/brand/logo';

export default async function AccountPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  const user = data.user;

  if (error || !user) redirect('/auth');

  const name =
    (typeof user.user_metadata?.full_name === 'string' && user.user_metadata.full_name) ||
    (typeof user.user_metadata?.name === 'string' && user.user_metadata.name) ||
    user.email ||
    'AbhiAI User';
  const provider =
    (typeof user.app_metadata?.provider === 'string' && user.app_metadata.provider) || 'email';

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 px-4 py-6 sm:py-10">
      <div className="w-full max-w-5xl mx-auto mb-5 flex items-center justify-between gap-3">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to chat
        </Link>
        <AbhiLogo variant="full" size="sm" href="/" />
      </div>
      <AccountDashboard
        identity={{
          id: user.id,
          email: user.email ?? null,
          name,
          provider,
        }}
      />
    </main>
  );
}
