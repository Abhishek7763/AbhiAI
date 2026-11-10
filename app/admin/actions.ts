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

export async function login(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')

  if (!email || !password) {
    return { error: 'Email and password are required' }
  }

  const cookieStore = await cookies()
  const headerStore = await headers()
  const isHttps = headerStore.get('x-forwarded-proto') === 'https'

  if (verifyMasterAdminCredentials(email, password)) {
    cookieStore.set(ADMIN_SESSION_COOKIE, createAdminSessionCookieValue(email, 'local-admin-owner'), {
      httpOnly: true,
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
      sameSite: isHttps ? 'none' : 'lax',
      secure: isHttps,
    })
    revalidatePath('/', 'layout')
    redirect('/admin')
  }

  if (!isSupabaseAdminConfigured()) {
    return { error: 'Invalid admin credentials. Use abhigt6t@gmail.com / admin123' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error || !data.user) {
    return { error: 'Invalid email or password' }
  }

  if (!(await isApprovedAdmin(data.user.id, data.user.email))) {
    await supabase.auth.signOut()
    return { error: 'This account does not have admin access' }
  }

  cookieStore.set(ADMIN_SESSION_COOKIE, createAdminSessionCookieValue(data.user.email || email, data.user.id), {
    httpOnly: true,
    path: '/',
    maxAge: 7 * 24 * 60 * 60,
    sameSite: isHttps ? 'none' : 'lax',
    secure: isHttps,
  })
  revalidatePath('/', 'layout')
  redirect('/admin')
}

export async function logout() {
  const cookieStore = await cookies()
  cookieStore.delete(ADMIN_SESSION_COOKIE)
  try {
    if (isSupabaseAdminConfigured()) {
      const supabase = await createClient()
      await supabase.auth.signOut()
    }
  } catch {
    // Ignore Supabase signout error if unconfigured
  }
  revalidatePath('/', 'layout')
  redirect('/')
}
