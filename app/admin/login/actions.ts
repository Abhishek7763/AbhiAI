'use server'

import { revalidatePath } from 'next/cache'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { isApprovedAdmin } from '@/lib/security/admin-auth'
import {
  ADMIN_SESSION_COOKIE,
  createAdminSessionCookieValue,
  verifyMasterAdminCredentials,
} from '@/lib/security/admin-session'
import { isSupabaseAdminConfigured } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

async function setAdminCookie(email: string, id = 'local-admin-owner') {
  const cookieStore = await cookies()
  const headerStore = await headers()
  const isHttps = headerStore.get('x-forwarded-proto') === 'https'

  cookieStore.set(ADMIN_SESSION_COOKIE, createAdminSessionCookieValue(email, id), {
    httpOnly: true,
    path: '/',
    maxAge: 7 * 24 * 60 * 60,
    sameSite: isHttps ? 'none' : 'lax',
    secure: isHttps,
  })
}

export async function login(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')

  if (!email || !password) {
    redirect('/admin/login?error=Email%20and%20password%20are%20required.')
  }

  if (verifyMasterAdminCredentials(email, password)) {
    await setAdminCookie(email, 'local-admin-owner')
    revalidatePath('/', 'layout')
    redirect('/admin')
  }

  if (!isSupabaseAdminConfigured()) {
    redirect(
      '/admin/login?error=Invalid%20admin%20credentials.%20Use%20abhigt6t%40gmail.com%20%2F%20admin123',
    )
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error || !data.user) {
    redirect('/admin/login?error=Invalid%20email%20or%20password.')
  }

  const approvedAdmin = await isApprovedAdmin(data.user.id, data.user.email)

  if (!approvedAdmin) {
    await supabase.auth.signOut()
    redirect('/admin/login?error=This%20account%20does%20not%20have%20admin%20access.')
  }

  await setAdminCookie(data.user.email || email, data.user.id)
  revalidatePath('/', 'layout')
  redirect('/admin')
}
