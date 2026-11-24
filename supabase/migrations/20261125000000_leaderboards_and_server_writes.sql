-- TermType Phase 4: server-only writes and personal-best leaderboards.
--
-- Runs are now saved only by the Next.js route /api/results, which checks the
-- session and runs the anti-cheat validation, then calls record_test_result()
-- with the server-only service key. Browsers can no longer write directly.

-- ---------------------------------------------------------------------------
-- record_test_result: the only write path (service_role only)
-- ---------------------------------------------------------------------------
create function public.record_test_result(
  p_user_id uuid,
  p_client_run_id text,
  p_mode text,
  p_sub_mode text,
  p_modifiers jsonb,
  p_wpm integer,
  p_raw_wpm integer,
  p_accuracy numeric,
  p_consistency integer,
  p_duration_sec integer,
  p_played_at timestamptz default null
)
returns public.test_results
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.test_results;
  v_played_at timestamptz;
begin
  if p_user_id is null then
    raise exception 'missing user' using errcode = '22023';
  end if;

  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'choose a username before saving runs' using errcode = 'P0001';
  end if;

  if p_client_run_id is null or char_length(p_client_run_id) not between 1 and 64 then
    raise exception 'invalid run id' using errcode = '22023';
  end if;

  if not coalesce(
    (p_mode = 'time' and p_sub_mode in ('15', '30', '60', '120'))
    or (p_mode = 'words' and p_sub_mode in ('10', '25', '50', '100'))
    or (p_mode = 'quote' and p_sub_mode in ('short', 'medium', 'long', 'all'))
    or (p_mode = 'code' and p_sub_mode in ('code_15', 'code_30', 'code_60')),
    false
  ) then
    raise exception 'invalid mode or sub-mode' using errcode = '22023';
  end if;

  if p_modifiers is null
    or jsonb_typeof(p_modifiers) <> 'object'
    or coalesce(jsonb_typeof(p_modifiers -> 'punct'), '') <> 'boolean'
    or coalesce(jsonb_typeof(p_modifiers -> 'nums'), '') <> 'boolean'
    or coalesce(p_modifiers ->> 'strictness', '') not in ('normal', 'expert', 'master')
    or (select count(*) from jsonb_object_keys(p_modifiers)) <> 3
  then
    raise exception 'invalid modifiers' using errcode = '22023';
  end if;

  -- Completed timed tests always last exactly their configured length.
  -- (CASE keeps the integer casts away from non-numeric quote sub-modes.)
  if p_duration_sec is distinct from (
    case p_mode
      when 'time' then p_sub_mode::integer
      when 'code' then replace(p_sub_mode, 'code_', '')::integer
      else p_duration_sec
    end
  ) then
    raise exception 'duration does not match the test length' using errcode = '22023';
  end if;

  if p_wpm is null or p_raw_wpm is null or p_wpm > p_raw_wpm then
    raise exception 'wpm cannot exceed raw wpm' using errcode = '22023';
  end if;

  v_played_at := least(now(), greatest(coalesce(p_played_at, now()), now() - interval '30 days'));

  -- Value ranges are enforced by the table's CHECK constraints.
  insert into public.test_results (
    user_id, mode, sub_mode, modifiers, wpm, raw_wpm, accuracy,
    consistency, duration_sec, client_run_id, created_at
  )
  values (
    p_user_id, p_mode, p_sub_mode, p_modifiers, p_wpm, p_raw_wpm, p_accuracy,
    p_consistency, p_duration_sec, p_client_run_id, v_played_at
  )
  on conflict (user_id, client_run_id) do nothing
  returning * into v_row;

  if v_row.id is null then
    select * into v_row
    from public.test_results
    where user_id = p_user_id and client_run_id = p_client_run_id;
  end if;

  return v_row;
end;
$$;

revoke all on function public.record_test_result(
  uuid, text, text, text, jsonb, integer, integer, numeric, integer, integer, timestamptz
) from public, anon, authenticated;

grant execute on function public.record_test_result(
  uuid, text, text, text, jsonb, integer, integer, numeric, integer, integer, timestamptz
) to service_role;

-- The Phase 3 browser-callable write path is retired.
drop function public.submit_test_result(
  text, text, text, jsonb, integer, integer, numeric, integer, integer, timestamptz
);

-- ---------------------------------------------------------------------------
-- Leaderboards
-- ---------------------------------------------------------------------------

-- Serves DISTINCT ON (user_id) per category, ordered the way bests are picked.
create index test_results_board_idx
  on public.test_results (mode, sub_mode, user_id, wpm desc, accuracy desc, created_at);

-- One personal best per user in a ranked category, top p_limit plus the
-- requesting user's own row (with its real rank) if it falls outside.
create function public.get_leaderboard(
  p_mode text,
  p_sub_mode text,
  p_window text default 'all',
  p_limit integer default 50,
  p_user_id uuid default null
)
returns table (
  rank bigint,
  user_id uuid,
  username text,
  wpm integer,
  raw_wpm integer,
  accuracy numeric,
  created_at timestamptz
)
language plpgsql
stable
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not coalesce(
    (p_mode = 'time' and p_sub_mode in ('15', '30', '60'))
    or (p_mode = 'code' and p_sub_mode = 'code_30'),
    false
  ) then
    raise exception 'not a ranked category' using errcode = '22023';
  end if;

  if coalesce(p_window, '') not in ('daily', 'all') then
    raise exception 'window must be daily or all' using errcode = '22023';
  end if;

  return query
  with eligible as (
    select r.user_id, r.wpm, r.raw_wpm, r.accuracy, r.created_at
    from public.test_results r
    where r.mode = p_mode
      and r.sub_mode = p_sub_mode
      and r.accuracy >= 90
      and r.modifiers ->> 'strictness' in ('normal', 'expert', 'master')
      and (p_window = 'all' or r.created_at >= now() - interval '24 hours')
  ),
  best as (
    select distinct on (e.user_id) e.user_id, e.wpm, e.raw_wpm, e.accuracy, e.created_at
    from eligible e
    order by e.user_id, e.wpm desc, e.accuracy desc, e.created_at asc
  ),
  ranked as (
    select
      row_number() over (order by b.wpm desc, b.accuracy desc, b.created_at asc) as rank,
      b.user_id, p.username, b.wpm, b.raw_wpm, b.accuracy, b.created_at
    from best b
    join public.profiles p on p.id = b.user_id
  )
  select ranked.rank, ranked.user_id, ranked.username, ranked.wpm, ranked.raw_wpm,
         ranked.accuracy, ranked.created_at
  from ranked
  where ranked.rank <= least(greatest(coalesce(p_limit, 50), 1), 100)
     or ranked.user_id = p_user_id
  order by ranked.rank;
end;
$$;

revoke all on function public.get_leaderboard(text, text, text, integer, uuid) from public;
grant execute on function public.get_leaderboard(text, text, text, integer, uuid)
  to anon, authenticated, service_role;
