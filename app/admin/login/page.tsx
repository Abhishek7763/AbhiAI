import { AlertCircle, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import AdminLoginForm from '@/components/admin/admin-login-form'
import { AbhiLogo } from '@/components/brand/logo'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { getCurrentAdmin } from '@/lib/security/admin-auth'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const [admin, params] = await Promise.all([
    getCurrentAdmin(),
    searchParams,
  ])

  if (admin) {
    redirect('/admin')
  }

  const { error } = params

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50 flex flex-col items-center justify-center p-4 transition-colors">
      <div className="w-full max-w-md">
        <Link
          href="/"
          className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to AbhiAI
        </Link>

        <div className="bg-white/95 dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl p-8 backdrop-blur-sm transition-colors">
          <div className="flex flex-col items-center justify-center mb-6">
            <AbhiLogo
              variant="full"
              size="hero"
              priority
              className="justify-center"
            />
          </div>

          <h1 className="text-xl font-semibold text-center text-zinc-950 dark:text-zinc-100 mb-1">
            Admin Dashboard
          </h1>
          <p className="text-sm text-center text-zinc-500 dark:text-zinc-400 mb-6">
            Sign in securely to manage providers, models, routing and AbhiAI settings.
          </p>

          {error && (
            <div className="mb-6 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-xl flex items-center gap-2 text-red-700 dark:text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <AdminLoginForm />

          <div className="mt-6 pt-5 border-t border-zinc-200 dark:border-zinc-800">
            <ThemeToggle />
          </div>

          <div className="mt-5 pt-5 border-t border-zinc-200 dark:border-zinc-800 text-center text-xs text-zinc-500">
            Protected admin access only. Public registration is disabled.
          </div>
        </div>
      </div>
    </div>
  )
}
