-- TermType Phase 3: profiles, test results, and a validating write path.
--
-- Clients may read both tables (public profiles and results feed profiles now
-- and leaderboards in Phase 4) but can never write test_results directly:
-- every run goes through submit_test_result(), which validates it server-side.

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null
    constraint profiles_username_format check (username ~ '^[A-Za-z0-9_]{3,20}$'),
  created_at timestamptz not null default now()
);

-- Usernames are unique regardless of case ("Ada" and "ada" can't both exist).
create unique index profiles_username_lower_key on public.profiles (lower(username));

alter table public.profiles enable row level security;

create policy "Profiles are viewable by everyone"
  on public.profiles for select
  to anon, authenticated
  using (true);

create policy "Users can create their own profile"
  on public.profiles for insert
  to authenticated
  with check ((select auth.uid()) = id);

create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

revoke delete, truncate on public.profiles from anon, authenticated;

-- ---------------------------------------------------------------------------
-- test_results
-- ---------------------------------------------------------------------------
create table public.test_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  mode text not null
    constraint test_results_mode_check check (mode in ('time', 'words', 'quote', 'code')),
  sub_mode text not null,
  modifiers jsonb not null default '{"punct": false, "nums": false, "strictness": "normal"}'::jsonb,
  wpm integer not null constraint test_results_wpm_check check (wpm between 0 and 260),
  raw_wpm integer not null constraint test_results_raw_wpm_check check (raw_wpm between 0 and 300),
  accuracy numeric(5, 2) not null
    constraint test_results_accuracy_check check (accuracy between 0 and 100),
  consistency integer not null
    constraint test_results_consistency_check check (consistency between 0 and 100),
  duration_sec integer not null
    constraint test_results_duration_check check (duration_sec between 1 and 3600),
  -- The client's run id; makes guest-to-account sync idempotent.
  client_run_id text not null
    constraint test_results_client_run_id_check check (char_length(client_run_id) between 1 and 64),
  created_at timestamptz not null default now(),
  constraint test_results_user_client_run_key unique (user_id, client_run_id)
);

create index test_results_leaderboard_idx
  on public.test_results (mode, sub_mode, wpm desc, created_at desc);
create index test_results_user_recent_idx
  on public.test_results (user_id, created_at desc);

alter table public.test_results enable row level security;

create policy "Test results are viewable by everyone"
  on public.test_results for select
  to anon, authenticated
  using (true);

-- No insert/update/delete policies: RLS denies direct writes. Drop the
-- privileges too, so the only way in is submit_test_result().
revoke insert, update, delete, truncate on public.test_results from anon, authenticated;

-- ---------------------------------------------------------------------------
-- submit_test_result: the only write path for test_results
-- ---------------------------------------------------------------------------
create function public.submit_test_result(
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
  v_user uuid := (select auth.uid());
  v_row public.test_results;
  v_played_at timestamptz;
begin
  if v_user is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;

  if not exists (select 1 from public.profiles where id = v_user) then
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

  -- Net WPM only counts correct characters, so it can never exceed raw WPM.
  if p_wpm is null or p_raw_wpm is null or p_wpm > p_raw_wpm then
    raise exception 'wpm cannot exceed raw wpm' using errcode = '22023';
  end if;

  -- Keep a synced run's real time, but never in the future or older than 30 days.
  v_played_at := least(now(), greatest(coalesce(p_played_at, now()), now() - interval '30 days'));

  -- Value ranges (wpm <= 260, raw <= 300, accuracy, consistency, duration)
  -- are enforced by the table's CHECK constraints.
  insert into public.test_results (
    user_id, mode, sub_mode, modifiers, wpm, raw_wpm, accuracy,
    consistency, duration_sec, client_run_id, created_at
  )
  values (
    v_user, p_mode, p_sub_mode, p_modifiers, p_wpm, p_raw_wpm, p_accuracy,
    p_consistency, p_duration_sec, p_client_run_id, v_played_at
  )
  on conflict (user_id, client_run_id) do nothing
  returning * into v_row;

  -- Already saved (e.g. a retried sync): return the existing row.
  if v_row.id is null then
    select * into v_row
    from public.test_results
    where user_id = v_user and client_run_id = p_client_run_id;
  end if;

  return v_row;
end;
$$;

revoke all on function public.submit_test_result(
  text, text, text, jsonb, integer, integer, numeric, integer, integer, timestamptz
) from public, anon;

grant execute on function public.submit_test_result(
  text, text, text, jsonb, integer, integer, numeric, integer, integer, timestamptz
) to authenticated;
