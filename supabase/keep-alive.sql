-- Keep-awake table for the GitHub job .github/workflows/keep-supabase-awake.yml.
-- Run once in Supabase: SQL Editor -> New query -> paste -> Run.
-- It holds one harmless row that anyone may read (nothing else), so the daily ping is a real,
-- successful database query. Safe to run again: it skips what already exists.

create table if not exists public.keep_alive (
  id integer primary key,
  note text not null
);

insert into public.keep_alive (id, note)
values (1, 'Read daily by the GitHub keep-awake job')
on conflict (id) do nothing;

alter table public.keep_alive enable row level security;

drop policy if exists "Anyone can read keep_alive" on public.keep_alive;
create policy "Anyone can read keep_alive"
  on public.keep_alive for select
  to anon, authenticated
  using (true);

grant select on public.keep_alive to anon, authenticated;
