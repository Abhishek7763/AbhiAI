alter table public.ai_agents
add column if not exists allowed_tools text[] not null default array['web_search','document_qa']::text[];

update public.ai_agents
set allowed_tools = array['web_search','document_qa']::text[]
where allowed_tools is null or cardinality(allowed_tools) = 0;
