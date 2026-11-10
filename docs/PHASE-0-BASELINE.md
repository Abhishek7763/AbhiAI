# AbhiAI Phase 0 Baseline

Baseline captured on 2026-09-02 from production commit
`a9078a4ee264fc1aedda7f84da57a03924151f3c`.

## Safety boundary

- Development branch: `improve/abhiai-stability`
- Production branch: `main`
- All repair work is verified on a Vercel Preview deployment first.
- Production is updated only after the relevant phase passes its checks.
- Secrets and production data must never be committed to Git.

## Connected services

- GitHub repository: `Abhishek7763/AbhiAI`
- Vercel project: `abhiai`
- Supabase project: `AbhiAI` (`ap-south-1`, healthy at baseline)

## Current technical baseline

- Next.js App Router application with TypeScript and Tailwind CSS.
- `npm run build` completes because lint and type validation are skipped.
- `npx tsc --noEmit` currently reports 8 errors.
- No automated test suite is present.
- Vercel runtime logs show missing Gemini credentials and read-only filesystem
  writes for JSON configuration and usage files.
- Supabase currently contains the `public.admin_users` application table.
- Admin authentication is intentionally bypassed until the final security phase.
- The manifest exists, but the service worker does not yet provide a complete
  offline/update strategy.

## Protected user-facing behaviour

The following behaviour must be checked after each phase:

- Homepage and public chat render on mobile and desktop.
- Dark, light, and system themes remain usable.
- Streaming responses and visible error states remain functional.
- Chat history can be created, reopened, renamed, pinned, and deleted.
- Model and agent selectors do not overflow the viewport.
- Admin routes render in Preview; mobile navigation can be opened and closed.
- No API key or server credential is returned to the browser or written to logs.
- PWA manifest and branding assets continue to resolve.

## Phase gate

Before merging any phase into `main`:

1. Run TypeScript, lint, and production-build checks.
2. Verify the affected flows on mobile and desktop in Vercel Preview.
3. Inspect Vercel runtime errors for new failures.
4. Run Supabase security advisors when database policies or schema change.
5. Confirm the commit contains no secret or generated build artifact.
