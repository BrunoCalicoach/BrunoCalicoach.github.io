-- Update for the coaching app (26 Nov 2026, second one): foods that PRO athletes add themselves
-- (scanned or typed from a label), so Bruno can use their local products in their meal plans.
-- Paste into Supabase: SQL Editor > New query > Run. Run it once. It only adds one new table.

create table if not exists public.coaching_athlete_foods (
  client_id uuid not null references public.coaching_clients (user_id) on delete cascade,
  id text not null check (char_length(id) <= 40),
  name text not null check (char_length(name) between 1 and 120),
  cat text not null default 'other' check (char_length(cat) <= 20),
  per100 jsonb not null check (jsonb_typeof(per100) = 'object' and pg_column_size(per100) < 4000),
  allergens text[] not null default '{}',
  note text check (char_length(note) <= 300),
  updated_at timestamptz not null default now(),
  primary key (client_id, id)
);

alter table public.coaching_athlete_foods enable row level security;
revoke all on public.coaching_athlete_foods from anon;
grant select, insert, update, delete on public.coaching_athlete_foods to authenticated;

-- Bruno sees (and can tidy up) every athlete's foods
create policy "Coach manages athlete foods" on public.coaching_athlete_foods for all to authenticated
  using (public.is_coach()) with check (public.is_coach());

-- A PRO athlete adds, changes and removes only their own foods
create policy "PRO athlete manages own foods" on public.coaching_athlete_foods for all to authenticated
  using ((select auth.uid()) = client_id)
  with check ((select auth.uid()) = client_id and public.is_pro(client_id));
