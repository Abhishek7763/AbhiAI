import 'server-only';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  ADMIN_SESSION_COOKIE,
  isOwnerAdminEmail,
  verifyAdminSessionCookieValue,
} from '@/lib/security/admin-session';
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

export async function ensureApprovedAdmin(userId: string, email?: string | null): Promise<boolean> {
  const existing = await getApprovedAdminById(userId);
  if (existing) return true;

  const adminClient = createAdminClient();
  const { data: allAdmins } = await adminClient.from('admin_users').select('id').limit(1);
  const isFirstAdmin = !allAdmins || allAdmins.length === 0;

  if (isFirstAdmin || (email && isOwnerAdminEmail(email))) {
    const { error } = await adminClient
      .from('admin_users')
      .upsert({ id: userId, email: email ?? '' }, { onConflict: 'id' });
    if (!error) return true;
  }

  return false;
}

export async function isApprovedAdmin(userId: string, email?: string | null): Promise<boolean> {
  return ensureApprovedAdmin(userId, email);
}

export async function getCurrentAdmin(): Promise<AdminIdentity | null> {
  const cookieStore = await cookies();
  const localSession = verifyAdminSessionCookieValue(
    cookieStore.get(ADMIN_SESSION_COOKIE)?.value,
  );
  if (localSession) {
    return {
      id: localSession.id,
      email: localSession.email,
    };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getClaims();
    const userId = data?.claims?.sub;

    if (error || !userId) {
      return null;
    }

    return getApprovedAdminById(userId);
  } catch {
    return null;
  }
}

export async function requireAdminPage(): Promise<AdminIdentity> {
  const admin = await getCurrentAdmin();

  if (!admin) {
    redirect('/admin/login');
  }

  return admin;
}
