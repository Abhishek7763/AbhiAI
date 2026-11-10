-- AbhiAI persistent configuration schema
-- API keys are encrypted in the Next.js server before they reach this schema.

create extension if not exists pgcrypto;
create schema if not exists private;

create table if not exists public.admin_users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_providers (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  adapter_type text not null default 'openai-compatible'
    check (adapter_type in ('google', 'openai-compatible')),
  base_url text not null,
  is_active boolean not null default true,
  free_only boolean not null default true,
  priority integer not null default 100 check (priority >= 0),
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_api_keys (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.ai_providers(id) on delete cascade,
  label text not null,
  encrypted_key text not null,
  encryption_iv text not null,
  encryption_tag text not null,
  encryption_version smallint not null default 1 check (encryption_version > 0),
  key_fingerprint text not null,
  masked_key text not null,
  status text not null default 'active'
    check (status in ('active', 'cooldown', 'disabled', 'invalid')),
  priority integer not null default 100 check (priority >= 0),
  cooldown_until timestamptz,
  last_used_at timestamptz,
  last_success_at timestamptz,
  last_error_code text,
  last_error_message text,
  consecutive_failures integer not null default 0 check (consecutive_failures >= 0),
  request_count bigint not null default 0 check (request_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider_id, key_fingerprint)
);

create table if not exists public.ai_models (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.ai_providers(id) on delete cascade,
  model_id text not null,
  name text not null,
  alias text,
  capabilities text[] not null default array['text']::text[],
  is_active boolean not null default true,
  is_public boolean not null default false,
  is_free boolean not null default true,
  priority integer not null default 100 check (priority >= 0),
  limits jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider_id, model_id)
);

create table if not exists public.routing_rules (
  id uuid primary key default gen_random_uuid(),
  alias text not null unique,
  name text not null,
  required_capabilities text[] not null default array['text']::text[],
  strategy text not null default 'priority'
    check (strategy in ('priority', 'round-robin', 'least-used')),
  max_fallbacks smallint not null default 3 check (max_fallbacks between 0 and 10),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.routing_rule_models (
  routing_rule_id uuid not null references public.routing_rules(id) on delete cascade,
  model_id uuid not null references public.ai_models(id) on delete cascade,
  position smallint not null check (position >= 0),
  primary key (routing_rule_id, model_id),
  unique (routing_rule_id, position)
);

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  description text,
  updated_at timestamptz not null default now()
);

create table if not exists public.system_instructions (
  id text primary key,
  system_prompt text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_agents (
  id text primary key,
  name text not null,
  description text not null default '',
  icon text not null default 'bot',
  system_prompt text not null,
  preferred_model_alias text,
  fallback_model_alias text,
  required_capabilities text[] not null default array['text']::text[],
  visibility text not null default 'admin_only'
    check (visibility in ('public', 'admin_only', 'disabled')),
  temperature numeric(3,2) not null default 0.7 check (temperature between 0 and 2),
  sample_starters text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.usage_events (
  id bigint generated always as identity primary key,
  request_id uuid not null default gen_random_uuid(),
  provider_id uuid references public.ai_providers(id) on delete set null,
  api_key_id uuid references public.ai_api_keys(id) on delete set null,
  model_id uuid references public.ai_models(id) on delete set null,
  model_or_alias text not null,
  status text not null check (status in ('success', 'error', 'aborted')),
  prompt_length integer not null default 0 check (prompt_length >= 0),
  response_length integer not null default 0 check (response_length >= 0),
  duration_ms integer not null default 0 check (duration_ms >= 0),
  failover_used boolean not null default false,
  is_public boolean not null default true,
  error_code text,
  created_at timestamptz not null default now()
);

create index if not exists ai_providers_active_priority_idx
  on public.ai_providers (priority, id) where is_active;
create index if not exists ai_api_keys_routing_idx
  on public.ai_api_keys (provider_id, status, priority, cooldown_until);
create index if not exists ai_models_public_priority_idx
  on public.ai_models (priority, id) where is_active and is_public and is_free;
create index if not exists usage_events_created_at_idx
  on public.usage_events (created_at desc);
create index if not exists usage_events_provider_created_idx
  on public.usage_events (provider_id, created_at desc);
create index if not exists usage_events_key_created_idx
  on public.usage_events (api_key_id, created_at desc);
create index if not exists routing_rule_models_model_id_idx
  on public.routing_rule_models (model_id);
create index if not exists usage_events_model_created_idx
  on public.usage_events (model_id, created_at desc);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.set_updated_at() from public, anon, authenticated;

drop trigger if exists ai_providers_set_updated_at on public.ai_providers;
create trigger ai_providers_set_updated_at before update on public.ai_providers
for each row execute function private.set_updated_at();
drop trigger if exists ai_api_keys_set_updated_at on public.ai_api_keys;
create trigger ai_api_keys_set_updated_at before update on public.ai_api_keys
for each row execute function private.set_updated_at();
drop trigger if exists ai_models_set_updated_at on public.ai_models;
create trigger ai_models_set_updated_at before update on public.ai_models
for each row execute function private.set_updated_at();
drop trigger if exists routing_rules_set_updated_at on public.routing_rules;
create trigger routing_rules_set_updated_at before update on public.routing_rules
for each row execute function private.set_updated_at();
drop trigger if exists app_settings_set_updated_at on public.app_settings;
create trigger app_settings_set_updated_at before update on public.app_settings
for each row execute function private.set_updated_at();
drop trigger if exists system_instructions_set_updated_at on public.system_instructions;
create trigger system_instructions_set_updated_at before update on public.system_instructions
for each row execute function private.set_updated_at();
drop trigger if exists ai_agents_set_updated_at on public.ai_agents;
create trigger ai_agents_set_updated_at before update on public.ai_agents
for each row execute function private.set_updated_at();

alter table public.admin_users enable row level security;
alter table public.ai_providers enable row level security;
alter table public.ai_api_keys enable row level security;
alter table public.ai_models enable row level security;
alter table public.routing_rules enable row level security;
alter table public.routing_rule_models enable row level security;
alter table public.app_settings enable row level security;
alter table public.system_instructions enable row level security;
alter table public.ai_agents enable row level security;
alter table public.usage_events enable row level security;

drop policy if exists "Admins can view admin_users" on public.admin_users;
create policy "Admins can view admin_users"
  on public.admin_users
  for select
  to authenticated
  using ((select auth.uid()) in (select id from public.admin_users));

revoke all on table public.ai_providers from anon, authenticated;
revoke all on table public.ai_api_keys from anon, authenticated;
revoke all on table public.ai_models from anon, authenticated;
revoke all on table public.routing_rules from anon, authenticated;
revoke all on table public.routing_rule_models from anon, authenticated;
revoke all on table public.app_settings from anon, authenticated;
revoke all on table public.system_instructions from anon, authenticated;
revoke all on table public.ai_agents from anon, authenticated;
revoke all on table public.usage_events from anon, authenticated;

grant select, insert, update, delete on table public.ai_providers to service_role;
grant select, insert, update, delete on table public.ai_api_keys to service_role;
grant select, insert, update, delete on table public.ai_models to service_role;
grant select, insert, update, delete on table public.routing_rules to service_role;
grant select, insert, update, delete on table public.routing_rule_models to service_role;
grant select, insert, update, delete on table public.app_settings to service_role;
grant select, insert, update, delete on table public.system_instructions to service_role;
grant select, insert, update, delete on table public.ai_agents to service_role;
grant select, insert on table public.usage_events to service_role;
grant usage, select on all sequences in schema public to service_role;

insert into public.ai_providers (slug, name, adapter_type, base_url, priority)
values ('google', 'Google Gemini', 'google', 'https://generativelanguage.googleapis.com', 10)
on conflict (slug) do nothing;

insert into public.ai_models (provider_id, model_id, name, alias, capabilities, is_public, is_free, priority)
select id, 'gemini-2.5-flash', 'Gemini 2.5 Flash', 'abhiai-fast',
  array['text', 'vision', 'fast'], true, true, 10
from public.ai_providers where slug = 'google'
on conflict (provider_id, model_id) do nothing;
insert into public.ai_models (provider_id, model_id, name, alias, capabilities, is_public, is_free, priority)
select id, 'gemini-2.5-pro', 'Gemini 2.5 Pro', 'abhiai-reasoning',
  array['text', 'vision', 'reasoning'], true, true, 20
from public.ai_providers where slug = 'google'
on conflict (provider_id, model_id) do nothing;

insert into public.app_settings (key, value, description)
values
  ('general', '{"appName":"AbhiAI","creatorName":"Abhishek","enablePublicAI":true,"enablePWA":true}'::jsonb,
    'Public application identity and feature flags'),
  ('limits', '{"freeOnlyMode":true,"rateLimitRPM":30,"maxDailyRequestsPerIP":200,"maxPromptLength":4000}'::jsonb,
    'Free-only and request safety limits')
on conflict (key) do nothing;

insert into public.system_instructions (id, system_prompt)
values ('global', 'You are AbhiAI, a helpful, intelligent AI assistant created by Abhishek.')
on conflict (id) do nothing;

insert into public.routing_rules (alias, name, required_capabilities, strategy, max_fallbacks)
values
  ('default', 'AbhiAI Default', array['text'], 'priority', 3),
  ('abhiai-fast', 'AbhiAI Fast', array['text', 'fast'], 'priority', 3),
  ('abhiai-reasoning', 'AbhiAI Reasoning', array['text', 'reasoning'], 'priority', 3)
on conflict (alias) do nothing;
