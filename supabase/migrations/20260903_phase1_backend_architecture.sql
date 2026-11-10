-- Phase 1: unify image-generation provider metadata with the Supabase AI config.
-- Secrets remain in ai_api_keys; this migration stores metadata only.

update public.ai_providers
set config = coalesce(config, '{}'::jsonb) || jsonb_build_object(
  'image_generation',
  jsonb_build_object(
    'supported', true,
    'engine', 'gemini',
    'model', 'gemini-3.1-flash-image',
    'free_tier', false
  )
)
where slug = 'google';

insert into public.ai_providers (
  slug,
  name,
  adapter_type,
  base_url,
  is_active,
  free_only,
  priority,
  config
)
values
  (
    'openai',
    'OpenAI',
    'openai-compatible',
    'https://api.openai.com/v1',
    false,
    false,
    80,
    '{"image_generation":{"supported":true,"engine":"openai","model":"gpt-image-2","free_tier":false}}'::jsonb
  ),
  (
    'stability',
    'Stability AI',
    'openai-compatible',
    'https://api.stability.ai',
    false,
    false,
    85,
    '{"image_generation":{"supported":true,"engine":"stability","model":"stable-image-core","free_tier":false}}'::jsonb
  ),
  (
    'pollinations',
    'Pollinations',
    'openai-compatible',
    'https://image.pollinations.ai',
    true,
    true,
    90,
    '{"image_generation":{"supported":true,"engine":"flux","model":"flux","free_tier":true,"fallback_only":true}}'::jsonb
  )
on conflict (slug) do update
set
  name = excluded.name,
  base_url = excluded.base_url,
  config = coalesce(public.ai_providers.config, '{}'::jsonb) || excluded.config;
