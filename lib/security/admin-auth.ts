import 'server-only';

import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export type AdminIdentity = {
  id: string;
  email: string | null;
};

export async function getApprovedAdminById(userId: string): Promise<AdminIdentity | null> {
  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from('admin_users')
    .select('id, email')
    .eq('id', userId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return {
    id: data.id,
    email: data.email ?? null,
  };
}

export async function isApprovedAdmin(userId: string): Promise<boolean> {
  return Boolean(await getApprovedAdminById(userId));
}

export async function getCurrentAdmin(): Promise<AdminIdentity | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (error || !userId) {
    return null;
  }

  return getApprovedAdminById(userId);
}

export async function requireAdminPage(): Promise<AdminIdentity> {
  const admin = await getCurrentAdmin();

  if (!admin) {
    redirect('/admin/login');
  }

  return admin;
}
