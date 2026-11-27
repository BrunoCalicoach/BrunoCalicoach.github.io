-- Update for the coaching app (28 Nov 2026): Bruno's own ready-made meals, used when the app makes meal plans
-- automatically ("Save as ready-made meal" in a meal's ⋮ menu). Only the coach can read or change them.
-- Paste into Supabase: SQL Editor > New query > Run. Run it once. It only adds one new table.
-- Until it is run, automatic plans use the starter meals only and "Save as ready-made meal" says so.

create table if not exists public.coaching_meal_templates (
  id text primary key check (char_length(id) <= 40),
  kind text not null check (kind in ('breakfast', 'main', 'snack')),
  name text not null check (char_length(name) between 1 and 120),
  items jsonb not null check (jsonb_typeof(items) = 'array' and pg_column_size(items) < 20000),
  updated_at timestamptz not null default now()
);

alter table public.coaching_meal_templates enable row level security;
revoke all on public.coaching_meal_templates from anon;
grant select, insert, update, delete on public.coaching_meal_templates to authenticated;

create policy "Coach manages meal templates" on public.coaching_meal_templates for all to authenticated
  using (public.is_coach()) with check (public.is_coach());
