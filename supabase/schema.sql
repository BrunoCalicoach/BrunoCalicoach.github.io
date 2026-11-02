-- 12-week challenge database. Paste into Supabase: SQL Editor > New query > Run.
-- Row level security means every member can only read and change their own rows.
-- Payment access must go in a separate table members cannot write to, never in these.

create table public.challenge_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  pullups integer not null check (pullups between 0 and 200),
  pushups integer not null check (pushups between 0 and 500),
  dips integer not null check (dips between 0 and 200),
  level text not null check (char_length(level) <= 30),
  program jsonb not null check (jsonb_typeof(program) = 'object'),
  started_on date not null default current_date,
  created_at timestamptz not null default now()
);

create table public.session_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  week integer not null check (week between 1 and 12),
  day integer not null check (day between 1 and 3),
  results jsonb not null check (jsonb_typeof(results) = 'object'),
  notes text check (char_length(notes) <= 1000),
  completed_on date not null default current_date,
  updated_at timestamptz not null default now(),
  unique (user_id, week, day)
);

alter table public.challenge_profiles enable row level security;
alter table public.session_logs enable row level security;

revoke all on public.challenge_profiles, public.session_logs from anon;
grant select, insert, update, delete on public.challenge_profiles, public.session_logs to authenticated;

create policy "Members manage their own profile"
  on public.challenge_profiles for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Members manage their own sessions"
  on public.session_logs for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
