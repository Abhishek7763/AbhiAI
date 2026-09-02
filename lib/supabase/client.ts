import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  // We use non-null assertions (!) here because we expect these to be defined in a real environment.
  // In a production app, you might want to add runtime checks and throw helpful errors if they are missing.
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!
  )
}
