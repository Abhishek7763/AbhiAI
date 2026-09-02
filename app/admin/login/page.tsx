import { login } from './actions'
import { AlertCircle } from 'lucide-react'
import Image from 'next/image'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams;
  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-3xl shadow-2xl p-8 backdrop-blur-sm">
          <div className="flex flex-col items-center justify-center mb-6">
            <Image
              src="/branding/abhiai-logo.png"
              alt="AbhiAI"
              width={900}
              height={300}
              quality={100}
              priority
              referrerPolicy="no-referrer"
              className="h-auto w-[240px] sm:w-[280px] object-contain mb-4 select-none"
            />
          </div>
          
          <h1 className="text-xl font-semibold text-center text-zinc-100 mb-1">
            Admin Access
          </h1>
          <p className="text-sm text-center text-zinc-400 mb-6">
            Sign in to manage AI settings, connections and API keys.
          </p>

          {error && (
            <div className="mb-6 p-3 bg-red-950/40 border border-red-900/60 rounded-xl flex items-center gap-2 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4" />
              <span>{error}</span>
            </div>
          )}

          <form className="space-y-4" action={login}>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5" htmlFor="email">
                Email Address
              </label>
              <input 
                id="email" 
                name="email" 
                type="email" 
                required 
                placeholder="admin@example.com"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm outline-none text-zinc-100 focus:ring-2 focus:ring-zinc-400 transition-all placeholder:text-zinc-600"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5" htmlFor="password">
                Password
              </label>
              <input 
                id="password" 
                name="password" 
                type="password" 
                required 
                placeholder="••••••••"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm outline-none text-zinc-100 focus:ring-2 focus:ring-zinc-400 transition-all placeholder:text-zinc-600"
              />
            </div>

            <button 
              type="submit"
              className="w-full bg-white hover:bg-zinc-200 text-zinc-950 font-medium py-2.5 rounded-xl transition-all shadow-sm mt-2"
            >
              Sign In
            </button>
          </form>
          
          <div className="mt-6 text-center text-xs text-zinc-500">
            <p>Don&apos;t have an account set up?</p>
            <p>Create a user in your Supabase project dashboard.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
