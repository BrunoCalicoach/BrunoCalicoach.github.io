-- Update for the coaching app (26 Nov 2026): daily water tracking, plus saving the meal split.
-- Paste into Supabase: SQL Editor > New query > Run. Run it once, after coaching.sql (already done).
-- It only adds three columns; existing data and security rules stay as they are.

-- What the athlete drank each day (ml), saved with the +/- 250 ml buttons
alter table public.coaching_daily
  add column if not exists water_ml integer check (water_ml between 0 and 10000);

-- Bruno's own daily water target for an athlete (ml). Empty = the app's estimate.
alter table public.coaching_targets
  add column if not exists water_ml integer check (water_ml between 500 and 8000);

-- Fix: the meal split per athlete (e.g. 30/35/35 %) had nowhere to be saved, so it always fell back to the default
alter table public.coaching_meal_plans
  add column if not exists split jsonb check (split is null or jsonb_typeof(split) = 'array');
