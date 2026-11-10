alter table public.ai_agents
  add column if not exists memory_enabled boolean not null default true,
  add column if not exists max_tokens integer not null default 4096;

alter table public.ai_agents
  drop constraint if exists ai_agents_max_tokens_range;

alter table public.ai_agents
  add constraint ai_agents_max_tokens_range check (max_tokens between 256 and 32768);

update public.ai_agents
set allowed_tools = array_append(allowed_tools, 'image_generation')
where id = 'agent-writer'
  and not ('image_generation' = any(allowed_tools));
