create index if not exists public_rate_limits_expires_at_idx
  on private.public_rate_limits (expires_at);

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
