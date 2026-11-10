# Phase 2: Supabase persistence

AbhiAI configuration now uses Supabase for providers, encrypted API keys,
models, routing rules, settings, instructions, agents, and usage events.

## Secret boundary

- Provider keys are encrypted by the Next.js server with AES-256-GCM before insertion.
- The browser receives only a masked value and key count.
- `anon` and `authenticated` have no table grants for configuration tables.
- Only the server-side Supabase secret can access these tables.
- `AI_KEYS_ENCRYPTION_KEY` must be a base64-encoded 32-byte value and must be backed up securely.
  Losing it makes saved provider keys impossible to decrypt.

## Required Vercel variables

Set the four Supabase/encryption variables shown in `.env.example` for Preview first.
After Preview verification, set the same variable names for Production using the
appropriate Production values. Do not commit their values.

Generate the encryption secret once with:

```bash
openssl rand -base64 32
```

## Database source

`supabase/schema.sql` is the idempotent canonical schema. Run it only against the
intended Supabase project, then run the Supabase security and performance advisors.
