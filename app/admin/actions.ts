'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { isApprovedAdmin } from '@/lib/security/admin-auth'
import { createClient } from '@/lib/supabase/server'

export async function login(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')

  if (!email || !password) {
    return { error: 'Email and password are required' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error || !data.user) {
    return { error: 'Invalid email or password' }
  }

  if (!(await isApprovedAdmin(data.user.id))) {
    await supabase.auth.signOut()
    return { error: 'This account does not have admin access' }
  }

  revalidatePath('/', 'layout')
  redirect('/admin')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/admin/login')
}
