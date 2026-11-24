-- Expose the tables to the Data API explicitly (this project does not grant
-- table privileges to anon/authenticated by default). RLS still applies on
-- top of these grants.

-- Anyone can read profiles and results (profile pages, later leaderboards).
grant select on public.profiles to anon, authenticated;
grant select on public.test_results to anon, authenticated;

-- Signed-in users may create their profile and change only their username;
-- id/created_at can't be rewritten. RLS limits both to their own row.
grant insert (id, username) on public.profiles to authenticated;
grant update (username) on public.profiles to authenticated;

-- test_results gets no write grants: submit_test_result() is the only way in.
