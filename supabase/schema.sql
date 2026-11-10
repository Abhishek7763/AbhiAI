-- ============================================================================
-- AbhiAI Complete Unified Production Schema (Phases 1 - 13 Consolidated)
-- Run this entire file once in your Supabase SQL Editor.
-- ============================================================================

create extension if not exists pgcrypto;
create schema if not exists private;

-- ----------------------------------------------------------------------------
-- 1. Core Admin & Provider Tables
-- ----------------------------------------------------------------------------

create table if not exists public.admin_users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  created_at timestamptz not null default now()
);

-- Automatically grant admin access to the platform owner email (or first user)
create or replace function private.handle_new_admin_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if lower(coalesce(new.email, '')) in ('abhigt6t@gmail.com', 'abhishekbhardwaj7763@gmail.com')
     or not exists (select 1 from public.admin_users) then
    insert into public.admin_users (id, email)
    values (new.id, lower(new.email))
    on conflict (id) do update set email = excluded.email;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_admin on auth.users;
create trigger on_auth_user_created_admin
  after insert on auth.users
  for each row execute function private.handle_new_admin_user();

-- Backfill any existing matching user in auth.users
insert into public.admin_users (id, email)
select id, lower(email)
from auth.users
where lower(coalesce(email, '')) in ('abhigt6t@gmail.com', 'abhishekbhardwaj7763@gmail.com')
on conflict (id) do nothing;

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
  daily_request_quota bigint,
  quota_alert_percent smallint not null default 80
    check (quota_alert_percent between 1 and 100),
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
  input_cost_per_million numeric(12,6) not null default 0,
  output_cost_per_million numeric(12,6) not null default 0,
  limits jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider_id, model_id)
);

-- Ensure Phase 7 columns exist on older schemas
alter table public.ai_models
  add column if not exists input_cost_per_million numeric(12,6) not null default 0,
  add column if not exists output_cost_per_million numeric(12,6) not null default 0;

alter table public.ai_api_keys
  add column if not exists daily_request_quota bigint,
  add column if not exists quota_alert_percent smallint not null default 80;

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

create table if not exists public.instruction_revisions (
  id bigint generated always as identity primary key,
  scope text not null check (scope in ('global', 'public', 'admin', 'agent')),
  target_id text not null default '',
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists instruction_revisions_lookup_idx
  on public.instruction_revisions (scope, target_id, created_at desc);

create table if not exists public.ai_agents (
  id text primary key,
  name text not null,
  description text not null default '',
  icon text not null default 'bot',
  system_prompt text not null,
  preferred_model_alias text,
  fallback_model_alias text,
  model_pool text[] not null default '{}'::text[],
  required_capabilities text[] not null default array['text']::text[],
  allowed_tools text[] not null default array['web_search','document_qa']::text[],
  memory_enabled boolean not null default true,
  max_tokens integer not null default 4096 check (max_tokens between 256 and 32768),
  visibility text not null default 'admin_only'
    check (visibility in ('public', 'admin_only', 'disabled')),
  temperature numeric(3,2) not null default 0.7 check (temperature between 0 and 2),
  sample_starters text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Ensure Phase 5 & Phase 13 columns exist on older schemas
alter table public.ai_agents
  add column if not exists allowed_tools text[] not null default array['web_search','document_qa']::text[],
  add column if not exists memory_enabled boolean not null default true,
  add column if not exists max_tokens integer not null default 4096,
  add column if not exists model_pool text[] not null default '{}'::text[];

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

create table if not exists public.ops_alerts (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('provider_failures', 'quota_near_limit')),
  severity text not null default 'warning' check (severity in ('warning', 'critical')),
  provider_id uuid references public.ai_providers(id) on delete set null,
  api_key_id uuid references public.ai_api_keys(id) on delete set null,
  message text not null,
  dedupe_key text not null,
  notified_at timestamptz,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 2. Phase 2: Public Rate Limits & Abuse Protection
-- ----------------------------------------------------------------------------

create table if not exists private.public_rate_limits (
  identifier text not null,
  window_kind text not null check (window_kind in ('minute', 'day')),
  window_start timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  expires_at timestamptz not null,
  primary key (identifier, window_kind)
);

create index if not exists public_rate_limits_expires_at_idx
  on private.public_rate_limits (expires_at);

revoke all on table private.public_rate_limits from public, anon, authenticated;

create or replace function public.check_public_rate_limit(
  p_identifier text,
  p_rpm integer,
  p_daily integer
)
returns table (
  allowed boolean,
  minute_count integer,
  daily_count integer,
  minute_limit integer,
  daily_limit integer,
  retry_after_seconds integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_minute_start timestamptz := date_trunc('minute', v_now);
  v_day_start timestamptz := date_trunc('day', v_now);
  v_minute_count integer;
  v_daily_count integer;
  v_rpm integer := greatest(1, least(coalesce(p_rpm, 30), 1000));
  v_daily integer := greatest(1, least(coalesce(p_daily, 200), 100000));
begin
  if p_identifier is null or length(trim(p_identifier)) < 16 then
    raise exception 'invalid rate-limit identifier';
  end if;

  if random() < 0.02 then
    delete from private.public_rate_limits where expires_at < v_now;
  end if;

  insert into private.public_rate_limits as rl (
    identifier,
    window_kind,
    window_start,
    request_count,
    expires_at
  ) values (
    p_identifier,
    'minute',
    v_minute_start,
    1,
    v_minute_start + interval '2 minutes'
  )
  on conflict (identifier, window_kind) do update
  set request_count = case
        when rl.window_start = excluded.window_start then rl.request_count + 1
        else 1
      end,
      window_start = excluded.window_start,
      expires_at = excluded.expires_at
  returning request_count into v_minute_count;

  insert into private.public_rate_limits as rl (
    identifier,
    window_kind,
    window_start,
    request_count,
    expires_at
  ) values (
    p_identifier,
    'day',
    v_day_start,
    1,
    v_day_start + interval '2 days'
  )
  on conflict (identifier, window_kind) do update
  set request_count = case
        when rl.window_start = excluded.window_start then rl.request_count + 1
        else 1
      end,
      window_start = excluded.window_start,
      expires_at = excluded.expires_at
  returning request_count into v_daily_count;

  return query
  select
    v_minute_count <= v_rpm and v_daily_count <= v_daily,
    v_minute_count,
    v_daily_count,
    v_rpm,
    v_daily,
    case
      when v_minute_count > v_rpm then greatest(
        1,
        ceil(extract(epoch from (v_minute_start + interval '1 minute' - v_now)))::integer
      )
      when v_daily_count > v_daily then greatest(
        1,
        ceil(extract(epoch from (v_day_start + interval '1 day' - v_now)))::integer
      )
      else 0
    end;
end;
$$;

revoke all on function public.check_public_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.check_public_rate_limit(text, integer, integer) to service_role;

-- ----------------------------------------------------------------------------
-- 3. Phase 3: User Accounts, Cross-Device Chat Sync & Generated Images
-- ----------------------------------------------------------------------------

create table if not exists public.chat_sessions (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  title text not null default 'New Chat',
  is_pinned boolean not null default false,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists chat_sessions_user_updated_idx
  on public.chat_sessions (user_id, updated_at desc);

create table if not exists public.chat_messages (
  user_id uuid not null,
  session_id text not null,
  id text not null,
  position integer not null default 0,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, session_id, id),
  constraint chat_messages_session_fk
    foreign key (user_id, session_id)
    references public.chat_sessions(user_id, id)
    on delete cascade,
  constraint chat_messages_payload_object
    check (jsonb_typeof(payload) = 'object')
);

create index if not exists chat_messages_session_position_idx
  on public.chat_messages (user_id, session_id, position);

create table if not exists public.generated_images (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  prompt text not null,
  enhanced_prompt text,
  url text not null,
  storage_path text,
  provider text not null default 'unknown',
  style text,
  aspect_ratio text,
  created_at timestamptz not null default now()
);

create index if not exists generated_images_user_created_idx
  on public.generated_images (user_id, created_at desc);

create or replace function public.sync_chat_session(
  p_session_id text,
  p_title text,
  p_is_pinned boolean,
  p_updated_at timestamptz,
  p_messages jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'authentication required';
  end if;

  insert into public.chat_sessions (
    user_id,
    id,
    title,
    is_pinned,
    updated_at
  ) values (
    v_user_id,
    p_session_id,
    coalesce(nullif(trim(p_title), ''), 'New Chat'),
    coalesce(p_is_pinned, false),
    coalesce(p_updated_at, now())
  )
  on conflict (user_id, id) do update
  set title = excluded.title,
      is_pinned = excluded.is_pinned,
      updated_at = excluded.updated_at;

  delete from public.chat_messages
  where user_id = v_user_id
    and session_id = p_session_id;

  insert into public.chat_messages (
    user_id,
    session_id,
    id,
    position,
    payload
  )
  select
    v_user_id,
    p_session_id,
    item.message ->> 'id',
    (item.ordinality - 1)::integer,
    item.message
  from jsonb_array_elements(coalesce(p_messages, '[]'::jsonb))
    with ordinality as item(message, ordinality)
  where jsonb_typeof(item.message) = 'object'
    and nullif(item.message ->> 'id', '') is not null;
end;
$$;

revoke all on function public.sync_chat_session(text, text, boolean, timestamptz, jsonb) from public, anon;
grant execute on function public.sync_chat_session(text, text, boolean, timestamptz, jsonb) to authenticated;

-- Storage Bucket for Generated Images
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'generated-images',
  'generated-images',
  false,
  10485760,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists generated_images_storage_select on storage.objects;
create policy generated_images_storage_select
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'generated-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists generated_images_storage_insert on storage.objects;
create policy generated_images_storage_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'generated-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists generated_images_storage_update on storage.objects;
create policy generated_images_storage_update
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'generated-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'generated-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists generated_images_storage_delete on storage.objects;
create policy generated_images_storage_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'generated-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- ----------------------------------------------------------------------------
-- 4. Indexes & Updated-At Triggers
-- ----------------------------------------------------------------------------

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
create index if not exists idx_ops_alerts_created_at
  on public.ops_alerts (created_at desc);
create index if not exists idx_ops_alerts_dedupe_key
  on public.ops_alerts (dedupe_key, created_at desc);

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

-- ----------------------------------------------------------------------------
-- 5. Row Level Security (RLS) & Grants
-- ----------------------------------------------------------------------------

alter table public.admin_users enable row level security;
alter table public.ai_providers enable row level security;
alter table public.ai_api_keys enable row level security;
alter table public.ai_models enable row level security;
alter table public.routing_rules enable row level security;
alter table public.routing_rule_models enable row level security;
alter table public.app_settings enable row level security;
alter table public.system_instructions enable row level security;
alter table public.instruction_revisions enable row level security;
alter table public.ai_agents enable row level security;
alter table public.usage_events enable row level security;
alter table public.ops_alerts enable row level security;
alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;
alter table public.generated_images enable row level security;

drop policy if exists "Admins can view admin_users" on public.admin_users;
create policy "Admins can view admin_users"
  on public.admin_users
  for select
  to authenticated
  using ((select auth.uid()) in (select id from public.admin_users));

drop policy if exists users_manage_own_chat_sessions on public.chat_sessions;
create policy users_manage_own_chat_sessions
  on public.chat_sessions
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists users_manage_own_chat_messages on public.chat_messages;
create policy users_manage_own_chat_messages
  on public.chat_messages
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists users_manage_own_generated_images on public.generated_images;
create policy users_manage_own_generated_images
  on public.generated_images
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on table public.ai_providers from anon, authenticated;
revoke all on table public.ai_api_keys from anon, authenticated;
revoke all on table public.ai_models from anon, authenticated;
revoke all on table public.routing_rules from anon, authenticated;
revoke all on table public.routing_rule_models from anon, authenticated;
revoke all on table public.app_settings from anon, authenticated;
revoke all on table public.system_instructions from anon, authenticated;
revoke all on table public.instruction_revisions from anon, authenticated;
revoke all on table public.ai_agents from anon, authenticated;
revoke all on table public.usage_events from anon, authenticated;
revoke all on table public.ops_alerts from anon, authenticated;
revoke all on table public.chat_sessions from anon;
revoke all on table public.chat_messages from anon;
revoke all on table public.generated_images from anon;

grant select, insert, update, delete on table public.admin_users to service_role;
grant select, insert, update, delete on table public.ai_providers to service_role;
grant select, insert, update, delete on table public.ai_api_keys to service_role;
grant select, insert, update, delete on table public.ai_models to service_role;
grant select, insert, update, delete on table public.routing_rules to service_role;
grant select, insert, update, delete on table public.routing_rule_models to service_role;
grant select, insert, update, delete on table public.app_settings to service_role;
grant select, insert, update, delete on table public.system_instructions to service_role;
grant select, insert, update, delete on table public.instruction_revisions to service_role;
grant select, insert, update, delete on table public.ai_agents to service_role;
grant select, insert on table public.usage_events to service_role;
grant select, insert, update, delete on table public.ops_alerts to service_role;
grant select, insert, update, delete on table public.chat_sessions to authenticated, service_role;
grant select, insert, update, delete on table public.chat_messages to authenticated, service_role;
grant select, insert, update, delete on table public.generated_images to authenticated, service_role;
grant usage, select on all sequences in schema public to service_role;

-- ----------------------------------------------------------------------------
-- 6. Default Providers, Models, Routing Pools, Agents & Settings Seed
-- ----------------------------------------------------------------------------

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
values
  ('global', 'You are AbhiAI, a helpful, intelligent AI assistant created by Abhishek.'),
  ('public', 'Keep answers safe, accurate, and friendly for public visitors.'),
  ('admin', 'Provide detailed technical diagnostics and administrative assistance.')
on conflict (id) do nothing;

insert into public.routing_rules (alias, name, required_capabilities, strategy, max_fallbacks)
values
  ('default', 'AbhiAI Default', array['text'], 'priority', 3),
  ('abhiai-fast', 'AbhiAI Fast', array['text', 'fast'], 'priority', 3),
  ('abhiai-reasoning', 'AbhiAI Reasoning', array['text', 'reasoning'], 'priority', 3)
on conflict (alias) do nothing;

insert into public.ai_agents (
  id, name, description, icon, system_prompt, preferred_model_alias, fallback_model_alias,
  model_pool, required_capabilities, allowed_tools, memory_enabled, max_tokens, visibility, temperature, sample_starters
)
values
  (
    'agent-coder',
    'AbhiAI Coder',
    'Full-stack TypeScript, React, Next.js, and system architecture specialist.',
    'code',
    'You are AbhiAI Coder, an expert software engineer focusing on clean, secure, production-ready code.',
    'abhiai-reasoning',
    'abhiai-fast',
    array['abhiai-reasoning', 'abhiai-fast'],
    array['text', 'code'],
    array['web_search', 'document_qa'],
    true,
    4096,
    'public',
    0.3,
    array['Fix my Next.js API route', 'Design a Supabase schema']
  ),
  (
    'agent-writer',
    'AbhiAI Writer',
    'Creative writing, Hinglish/Hindi copywriting, and visual content assistant.',
    'sparkles',
    'You are AbhiAI Writer, a creative assistant fluent in English, Hindi, and Hinglish.',
    'abhiai-fast',
    'default',
    array['abhiai-fast', 'default'],
    array['text'],
    array['web_search', 'document_qa', 'image_generation'],
    true,
    4096,
    'public',
    0.7,
    array['Write a YouTube script in Hinglish', 'Create a product launch post']
  )
on conflict (id) do nothing;
