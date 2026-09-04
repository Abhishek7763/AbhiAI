alter table public.ai_models
  add column if not exists input_cost_per_million numeric(12,6) not null default 0,
  add column if not exists output_cost_per_million numeric(12,6) not null default 0;

alter table public.ai_api_keys
  add column if not exists daily_request_quota bigint,
  add column if not exists quota_alert_percent smallint not null default 80;

alter table public.ai_api_keys
  drop constraint if exists ai_api_keys_quota_alert_percent_check;

alter table public.ai_api_keys
  add constraint ai_api_keys_quota_alert_percent_check
  check (quota_alert_percent between 1 and 100);

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

create index if not exists idx_ops_alerts_created_at on public.ops_alerts(created_at desc);
create index if not exists idx_ops_alerts_dedupe_key on public.ops_alerts(dedupe_key, created_at desc);

alter table public.ops_alerts enable row level security;

comment on table public.ops_alerts is 'Server-side admin/ops incidents. Access is intentionally service-role only.';
comment on column public.ai_models.input_cost_per_million is 'Optional USD input-token price per 1M tokens. Zero keeps free-tier models at zero estimated cost.';
comment on column public.ai_models.output_cost_per_million is 'Optional USD output-token price per 1M tokens.';
comment on column public.ai_api_keys.daily_request_quota is 'Optional request quota used only for near-limit alerting. Null disables quota alerts for this key.';
