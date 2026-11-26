-- 1-on-1 coaching app (coaching.html + coach.html). Separate from the challenge tables.
-- Paste into Supabase: SQL Editor > New query > Run. Safe to run once; it only creates new things.
-- Row level security: every athlete reads and writes only their own rows; the coach reads everything.
-- Athletes can never change their own tier (REGULAR/PRO), plans, targets or meal plans.

-- ---------- Who is the coach ----------
create table public.coaches (
  user_id uuid primary key references auth.users (id) on delete cascade
);
alter table public.coaches enable row level security;
revoke all on public.coaches from anon, authenticated;

create or replace function public.is_coach() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.coaches where user_id = (select auth.uid()));
$$;

-- ---------- Athletes ----------
create table public.coaching_clients (
  user_id uuid primary key references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  tier text not null default 'regular' check (tier in ('regular', 'pro')),
  active boolean not null default true,
  start_date date not null default current_date,
  -- set by the coach: EU label allergens (gluten, milk, nuts...) and other foods to leave out of meal plans
  allergies text[] not null default '{}' check (cardinality(allergies) <= 14),
  avoid_foods text check (char_length(avoid_foods) <= 500),
  created_at timestamptz not null default now()
);

create or replace function public.is_pro(uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.coaching_clients where user_id = uid and tier = 'pro' and active);
$$;

create or replace function public.is_client() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.coaching_clients where user_id = (select auth.uid()) and active);
$$;

-- Athlete's own starting data for TDEE (they fill it in; the coach can correct it)
create table public.coaching_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  sex text check (sex in ('male', 'female')),
  birth_date date,
  height_cm numeric(5,1) check (height_cm between 100 and 250),
  start_weight numeric(5,1) check (start_weight between 30 and 300),
  activity numeric(4,3) check (activity between 1.1 and 2.0),
  goal text check (goal in ('cut', 'maintain', 'gain')),
  consent_at timestamptz,
  tour_seen_at timestamptz, -- the app tour opened once by itself; later only from the "?" button
  updated_at timestamptz not null default now()
);

-- ---------- Weekly plans ----------
-- The coach's working copy. Athletes never see this table.
create table public.coaching_drafts (
  client_id uuid not null references public.coaching_clients (user_id) on delete cascade,
  week_start date not null,
  label text not null default '' check (char_length(label) <= 80),
  content jsonb not null check (jsonb_typeof(content) = 'object' and pg_column_size(content) < 300000),
  updated_at timestamptz not null default now(),
  primary key (client_id, week_start)
);

-- What the athlete sees: written only by publish_week().
create table public.coaching_weeks (
  client_id uuid not null references public.coaching_clients (user_id) on delete cascade,
  week_start date not null,
  label text not null default '',
  content jsonb not null,
  published_at timestamptz not null default now(),
  primary key (client_id, week_start)
);

create or replace function public.publish_week(p_client uuid, p_week date) returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare stamp timestamptz := now();
begin
  if not public.is_coach() then raise exception 'Only the coach can publish'; end if;
  insert into public.coaching_weeks (client_id, week_start, label, content, published_at)
    select client_id, week_start, label, content, stamp from public.coaching_drafts
    where client_id = p_client and week_start = p_week
  on conflict (client_id, week_start)
    do update set label = excluded.label, content = excluded.content, published_at = excluded.published_at;
  if not found then raise exception 'No draft for that week'; end if;
  return stamp;
end $$;

create or replace function public.unpublish_week(p_client uuid, p_week date) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_coach() then raise exception 'Only the coach can unpublish'; end if;
  delete from public.coaching_weeks where client_id = p_client and week_start = p_week;
end $$;

-- Links an existing account (the athlete signed up on coaching.html first) by email.
create or replace function public.coach_add_client(p_email text, p_name text, p_tier text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare uid uuid;
begin
  if not public.is_coach() then raise exception 'Only the coach can add athletes'; end if;
  select id into uid from auth.users where lower(email) = lower(trim(p_email));
  if uid is null then raise exception 'No account with that email yet. Ask the athlete to create one on the coaching page first.'; end if;
  insert into public.coaching_clients (user_id, name, tier) values (uid, p_name, p_tier)
    on conflict (user_id) do update set name = excluded.name, tier = excluded.tier, active = true;
  return uid;
end $$;

-- ---------- Athlete logs ----------
create table public.coaching_logs (
  client_id uuid not null references public.coaching_clients (user_id) on delete cascade,
  week_start date not null,
  day_index integer not null check (day_index between 0 and 13),
  entries jsonb not null default '{}' check (jsonb_typeof(entries) = 'object' and pg_column_size(entries) < 100000),
  note text check (char_length(note) <= 3000),
  difficulty integer check (difficulty between 1 and 10),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (client_id, week_start, day_index)
);

-- Bruno's "YOUR FEEDBACK - DAY n"
create table public.coaching_feedback (
  client_id uuid not null references public.coaching_clients (user_id) on delete cascade,
  week_start date not null,
  day_index integer not null check (day_index between -1 and 13), -- -1 = whole week
  body text not null check (char_length(body) <= 3000),
  updated_at timestamptz not null default now(),
  primary key (client_id, week_start, day_index)
);

create table public.coaching_checkins (
  client_id uuid not null references public.coaching_clients (user_id) on delete cascade,
  week_start date not null,
  ratings jsonb not null default '{}' check (jsonb_typeof(ratings) = 'object'),
  avg_kcal integer check (avg_kcal between 0 and 10000),
  impression text check (char_length(impression) <= 4000),
  questions text check (char_length(questions) <= 3000),
  feedback text check (char_length(feedback) <= 3000),
  activities jsonb not null default '[]' check (jsonb_typeof(activities) = 'array'),
  updated_at timestamptz not null default now(),
  primary key (client_id, week_start)
);

create table public.coaching_daily (
  client_id uuid not null references public.coaching_clients (user_id) on delete cascade,
  day date not null,
  weight numeric(5,2) check (weight between 30 and 300),
  steps integer check (steps between 0 and 150000),
  water_ml integer check (water_ml between 0 and 10000),
  updated_at timestamptz not null default now(),
  primary key (client_id, day)
);

create table public.coaching_measurements (
  client_id uuid not null references public.coaching_clients (user_id) on delete cascade,
  day date not null,
  chest numeric(5,1), waist_narrow numeric(5,1), waist_navel numeric(5,1),
  hips numeric(5,1), biceps numeric(5,1), thigh numeric(5,1),
  updated_at timestamptz not null default now(),
  primary key (client_id, day)
);

-- ---------- Nutrition ----------
-- Coach-set calories and macros (all tiers). Without a row the app shows its own estimate.
create table public.coaching_targets (
  client_id uuid primary key references public.coaching_clients (user_id) on delete cascade,
  kcal integer check (kcal between 800 and 8000),
  protein integer, fat integer, carbs integer,
  water_ml integer check (water_ml between 500 and 8000),
  note text check (char_length(note) <= 2000),
  updated_at timestamptz not null default now()
);

-- Bruno's own foods (branded products from the label), next to the built-in USDA library in coaching-foods.js
create table public.coaching_foods (
  id text primary key check (char_length(id) <= 40),
  name text not null check (char_length(name) between 1 and 120),
  cat text not null default 'other' check (char_length(cat) <= 20),
  per100 jsonb not null check (jsonb_typeof(per100) = 'object' and pg_column_size(per100) < 4000),
  allergens text[] not null default '{}',
  note text check (char_length(note) <= 300),
  updated_at timestamptz not null default now()
);

-- PRO only: the meal plan (days of 3 meals, each food with grams and its values per 100 g copied in,
-- so a published plan never changes when the food library does)
create table public.coaching_meal_plans (
  client_id uuid primary key references public.coaching_clients (user_id) on delete cascade,
  plans jsonb not null default '[]' check (jsonb_typeof(plans) = 'array' and pg_column_size(plans) < 200000),
  split jsonb check (split is null or jsonb_typeof(split) = 'array'),
  note text check (char_length(note) <= 3000),
  updated_at timestamptz not null default now()
);

-- PRO athlete's own swaps in the meal plan: { dayId: { mealIndex: { basedOn, from, items } } }.
-- Each swap is checked in the app to stay within that meal's share of the daily targets.
create table public.coaching_meal_choices (
  client_id uuid primary key references public.coaching_clients (user_id) on delete cascade,
  choices jsonb not null default '{}' check (jsonb_typeof(choices) = 'object' and pg_column_size(choices) < 200000),
  updated_at timestamptz not null default now()
);

-- Guideline texts (RPE scale, training, nutrition, supplements, lifestyle). pro_only hides one from REGULAR.
create table public.coaching_guides (
  key text primary key check (char_length(key) <= 40),
  title text not null check (char_length(title) <= 120),
  body text not null default '' check (char_length(body) <= 20000),
  pro_only boolean not null default false,
  sort integer not null default 0,
  updated_at timestamptz not null default now()
);

-- ---------- Row level security ----------
alter table public.coaching_clients enable row level security;
alter table public.coaching_profiles enable row level security;
alter table public.coaching_drafts enable row level security;
alter table public.coaching_weeks enable row level security;
alter table public.coaching_logs enable row level security;
alter table public.coaching_feedback enable row level security;
alter table public.coaching_checkins enable row level security;
alter table public.coaching_daily enable row level security;
alter table public.coaching_measurements enable row level security;
alter table public.coaching_targets enable row level security;
alter table public.coaching_meal_plans enable row level security;
alter table public.coaching_foods enable row level security;
alter table public.coaching_meal_choices enable row level security;
alter table public.coaching_guides enable row level security;

revoke all on public.coaching_clients, public.coaching_profiles, public.coaching_drafts, public.coaching_weeks,
  public.coaching_logs, public.coaching_feedback, public.coaching_checkins, public.coaching_daily,
  public.coaching_measurements, public.coaching_targets, public.coaching_meal_plans, public.coaching_guides, public.coaching_foods, public.coaching_meal_choices from anon;
grant select, insert, update, delete on public.coaching_clients, public.coaching_profiles, public.coaching_drafts,
  public.coaching_weeks, public.coaching_logs, public.coaching_feedback, public.coaching_checkins, public.coaching_daily,
  public.coaching_measurements, public.coaching_targets, public.coaching_meal_plans, public.coaching_guides, public.coaching_foods, public.coaching_meal_choices to authenticated;
grant execute on function public.publish_week(uuid, date), public.unpublish_week(uuid, date),
  public.coach_add_client(text, text, text), public.is_coach(), public.is_client(), public.is_pro(uuid) to authenticated;
revoke execute on function public.publish_week(uuid, date), public.unpublish_week(uuid, date),
  public.coach_add_client(text, text, text) from anon, public;

-- Coach: everything
create policy "Coach manages clients" on public.coaching_clients for all to authenticated using (public.is_coach()) with check (public.is_coach());
create policy "Coach manages profiles" on public.coaching_profiles for all to authenticated using (public.is_coach()) with check (public.is_coach());
create policy "Coach manages drafts" on public.coaching_drafts for all to authenticated using (public.is_coach()) with check (public.is_coach());
create policy "Coach reads weeks" on public.coaching_weeks for select to authenticated using (public.is_coach());
create policy "Coach reads logs" on public.coaching_logs for select to authenticated using (public.is_coach());
create policy "Coach manages feedback" on public.coaching_feedback for all to authenticated using (public.is_coach()) with check (public.is_coach());
create policy "Coach reads checkins" on public.coaching_checkins for select to authenticated using (public.is_coach());
create policy "Coach reads daily" on public.coaching_daily for select to authenticated using (public.is_coach());
create policy "Coach reads measurements" on public.coaching_measurements for select to authenticated using (public.is_coach());
create policy "Coach manages targets" on public.coaching_targets for all to authenticated using (public.is_coach()) with check (public.is_coach());
create policy "Coach manages meal plans" on public.coaching_meal_plans for all to authenticated using (public.is_coach()) with check (public.is_coach());
create policy "Coach manages guides" on public.coaching_guides for all to authenticated using (public.is_coach()) with check (public.is_coach());
create policy "Coach manages foods" on public.coaching_foods for all to authenticated using (public.is_coach()) with check (public.is_coach());
create policy "Coach reads meal choices" on public.coaching_meal_choices for select to authenticated using (public.is_coach());

-- Athletes: their own rows only
create policy "Athlete reads own client row" on public.coaching_clients for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Athlete manages own profile" on public.coaching_profiles for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id and public.is_client());
create policy "Athlete reads own published weeks" on public.coaching_weeks for select to authenticated
  using ((select auth.uid()) = client_id);
create policy "Athlete manages own logs" on public.coaching_logs for all to authenticated
  using ((select auth.uid()) = client_id) with check ((select auth.uid()) = client_id and public.is_client());
create policy "Athlete reads own feedback" on public.coaching_feedback for select to authenticated
  using ((select auth.uid()) = client_id);
create policy "Athlete manages own checkins" on public.coaching_checkins for all to authenticated
  using ((select auth.uid()) = client_id) with check ((select auth.uid()) = client_id and public.is_client());
create policy "Athlete manages own daily" on public.coaching_daily for all to authenticated
  using ((select auth.uid()) = client_id) with check ((select auth.uid()) = client_id and public.is_client());
create policy "Athlete manages own measurements" on public.coaching_measurements for all to authenticated
  using ((select auth.uid()) = client_id) with check ((select auth.uid()) = client_id and public.is_client());
create policy "Athlete reads own targets" on public.coaching_targets for select to authenticated
  using ((select auth.uid()) = client_id);
create policy "PRO athlete reads own meal plans" on public.coaching_meal_plans for select to authenticated
  using ((select auth.uid()) = client_id and public.is_pro(client_id));
create policy "PRO athlete manages own meal choices" on public.coaching_meal_choices for all to authenticated
  using ((select auth.uid()) = client_id) with check ((select auth.uid()) = client_id and public.is_pro(client_id));
create policy "Athletes read guides" on public.coaching_guides for select to authenticated
  using (public.is_client() and (not pro_only or public.is_pro((select auth.uid()))));

-- ---------- Foods PRO athletes add themselves (scanned or from a label) ----------
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

-- ---------- Initial Form (filled in once inside the app before anything else) ----------
create table if not exists public.coaching_intake (
  client_id uuid primary key references public.coaching_clients (user_id) on delete cascade,
  answers jsonb not null default '{}'::jsonb check (jsonb_typeof(answers) = 'object' and pg_column_size(answers) < 30000),
  submitted_at timestamptz, -- empty while the athlete is still filling it in
  updated_at timestamptz not null default now()
);

alter table public.coaching_intake enable row level security;
revoke all on public.coaching_intake from anon;
grant select, insert, update, delete on public.coaching_intake to authenticated;

create policy "Coach manages intake" on public.coaching_intake for all to authenticated
  using (public.is_coach()) with check (public.is_coach());
create policy "Athlete manages own intake" on public.coaching_intake for all to authenticated
  using ((select auth.uid()) = client_id)
  with check ((select auth.uid()) = client_id and public.is_client());

-- ---------- Progress photos (private storage, 3 MB max per photo) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('coaching-photos', 'coaching-photos', false, 3145728, array['image/jpeg', 'image/webp'])
on conflict (id) do nothing;

-- Files live under <athlete user id>/<date>-<pose>.jpg
create policy "Athlete uploads own photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'coaching-photos' and (storage.foldername(name))[1] = (select auth.uid())::text and public.is_client());
create policy "Athlete reads own photos" on storage.objects for select to authenticated
  using (bucket_id = 'coaching-photos' and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_coach()));
create policy "Athlete replaces own photos" on storage.objects for update to authenticated
  using (bucket_id = 'coaching-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Athlete deletes own photos" on storage.objects for delete to authenticated
  using (bucket_id = 'coaching-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------- Last step: make Bruno the coach ----------
-- Replace the email below with the email of Bruno's own login (create it on coaching.html first), then run:
-- insert into public.coaches (user_id) select id from auth.users where email = 'YOUR-LOGIN-EMAIL';
