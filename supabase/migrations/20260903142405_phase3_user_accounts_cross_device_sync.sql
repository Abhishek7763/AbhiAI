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

alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;
alter table public.generated_images enable row level security;

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

revoke all on table public.chat_sessions from anon;
revoke all on table public.chat_messages from anon;
revoke all on table public.generated_images from anon;

grant select, insert, update, delete on table public.chat_sessions to authenticated;
grant select, insert, update, delete on table public.chat_messages to authenticated;
grant select, insert, update, delete on table public.generated_images to authenticated;
