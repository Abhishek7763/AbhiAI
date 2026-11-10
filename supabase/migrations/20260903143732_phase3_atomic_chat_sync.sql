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
