'use client';

import { useFormStatus } from 'react-dom';
import { Loader2, LogOut } from 'lucide-react';
import { logout } from '@/app/admin/actions';

function LogoutSubmit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-colors disabled:opacity-60 disabled:cursor-wait"
    >
      {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
      {pending ? 'Signing out…' : 'Logout'}
    </button>
  );
}

export default function AdminLogoutButton() {
  return (
    <form action={logout}>
      <LogoutSubmit />
    </form>
  );
}
