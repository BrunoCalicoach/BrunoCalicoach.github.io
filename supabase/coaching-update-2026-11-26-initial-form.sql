-- Update for the coaching app (26 Nov 2026, third one): the Initial Form inside the app.
-- Athletes fill it in once before using the app (answers saved as they go, so they can finish later);
-- Bruno reads it in the athlete's Overview tab.
-- Paste into Supabase: SQL Editor > New query > Run. Run it once. It only adds one new table.

create table if not exists public.coaching_intake (
  client_id uuid primary key references public.coaching_clients (user_id) on delete cascade,
  answers jsonb not null default '{}'::jsonb check (jsonb_typeof(answers) = 'object' and pg_column_size(answers) < 30000),
  submitted_at timestamptz, -- empty while the athlete is still filling it in
  updated_at timestamptz not null default now()
);

alter table public.coaching_intake enable row level security;
revoke all on public.coaching_intake from anon;
grant select, insert, update, delete on public.coaching_intake to authenticated;

-- Bruno reads (and can correct or reset) every athlete's form
create policy "Coach manages intake" on public.coaching_intake for all to authenticated
  using (public.is_coach()) with check (public.is_coach());

-- An athlete fills in and updates only their own form
create policy "Athlete manages own intake" on public.coaching_intake for all to authenticated
  using ((select auth.uid()) = client_id)
  with check ((select auth.uid()) = client_id and public.is_client());
