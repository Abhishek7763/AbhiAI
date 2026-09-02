'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { isApprovedAdmin } from '@/lib/security/admin-auth'
import { createClient } from '@/lib/supabase/server'

export async function login(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')

  if (!email || !password) {
    redirect('/admin/login?error=Email%20and%20password%20are%20required.')
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error || !data.user) {
    redirect('/admin/login?error=Invalid%20email%20or%20password.')
  }

  const approvedAdmin = await isApprovedAdmin(data.user.id)

  if (!approvedAdmin) {
    await supabase.auth.signOut()
    redirect('/admin/login?error=This%20account%20does%20not%20have%20admin%20access.')
  }

  revalidatePath('/', 'layout')
  redirect('/admin')
}
