create table if not exists private.public_request_leases (
  identifier text not null,
  scope text not null check (scope in ('chat', 'image')),
  lease_id uuid not null,
  acquired_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null,
  primary key (identifier, scope, lease_id)
);

create index if not exists public_request_leases_expires_at_idx
  on private.public_request_leases (expires_at);

revoke all on table private.public_request_leases from public, anon, authenticated;

drop function if exists public.acquire_public_request_lease(text, text, uuid, integer, integer);
create function public.acquire_public_request_lease(
  p_identifier text,
  p_scope text,
  p_lease_id uuid,
  p_max_concurrent integer,
  p_lease_seconds integer
)
returns table (
  allowed boolean,
  active_count integer,
  concurrent_limit integer,
  retry_after_seconds integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_limit integer := greatest(1, least(coalesce(p_max_concurrent, 2), 20));
  v_lease_seconds integer := greatest(15, least(coalesce(p_lease_seconds, 120), 300));
  v_active integer := 0;
  v_earliest_expiry timestamptz;
begin
  if p_identifier is null or length(trim(p_identifier)) < 16 then
    raise exception 'invalid concurrency identifier';
  end if;
  if p_scope not in ('chat', 'image') then
    raise exception 'invalid concurrency scope';
  end if;
  if p_lease_id is null then
    raise exception 'invalid lease id';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_identifier || '|' || p_scope, 0)
  );

  delete from private.public_request_leases
  where identifier = p_identifier
    and scope = p_scope
    and expires_at <= v_now;

  select count(*)::integer, min(expires_at)
  into v_active, v_earliest_expiry
  from private.public_request_leases
  where identifier = p_identifier
    and scope = p_scope
    and expires_at > v_now;

  if v_active >= v_limit then
    return query
    select
      false,
      v_active,
      v_limit,
      greatest(
        1,
        ceil(extract(epoch from (coalesce(v_earliest_expiry, v_now + interval '1 second') - v_now)))::integer
      );
    return;
  end if;

  insert into private.public_request_leases (
    identifier,
    scope,
    lease_id,
    acquired_at,
    expires_at
  ) values (
    p_identifier,
    p_scope,
    p_lease_id,
    v_now,
    v_now + make_interval(secs => v_lease_seconds)
  )
  on conflict (identifier, scope, lease_id) do update
  set acquired_at = excluded.acquired_at,
      expires_at = excluded.expires_at;

  return query
  select true, v_active + 1, v_limit, 0;
end;
$$;

revoke all on function public.acquire_public_request_lease(text, text, uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.acquire_public_request_lease(text, text, uuid, integer, integer) to service_role;

drop function if exists public.release_public_request_lease(text, text, uuid);
create function public.release_public_request_lease(
  p_identifier text,
  p_scope text,
  p_lease_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer := 0;
begin
  if p_identifier is null or length(trim(p_identifier)) < 16 then
    return false;
  end if;
  if p_scope not in ('chat', 'image') or p_lease_id is null then
    return false;
  end if;

  delete from private.public_request_leases
  where identifier = p_identifier
    and scope = p_scope
    and lease_id = p_lease_id;

  get diagnostics v_deleted = row_count;
  return v_deleted > 0;
end;
$$;

revoke all on function public.release_public_request_lease(text, text, uuid) from public, anon, authenticated;
grant execute on function public.release_public_request_lease(text, text, uuid) to service_role;
