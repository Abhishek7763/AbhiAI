-- Phase 13: Agent System
-- Persist an ordered model/alias pool for each agent. Existing agents fall back
-- to their preferred model when no explicit pool has been configured yet.

alter table if exists public.ai_agents
  add column if not exists model_pool text[] not null default '{}'::text[];

update public.ai_agents
set model_pool = array[preferred_model_alias]
where coalesce(array_length(model_pool, 1), 0) = 0
  and preferred_model_alias is not null
  and btrim(preferred_model_alias) <> '';
