create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  avatar_url text,
  home_city text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  source_url text,
  image_url text,
  location_name text,
  address text,
  lat numeric,
  lng numeric,
  category text not null default 'other',
  price_level text not null default 'unknown',
  estimated_price numeric,
  duration text,
  indoor_outdoor text not null default 'unknown',
  suitable_for text[] not null default '{}',
  tags text[] not null default '{}',
  status text not null default 'saved',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint activities_category_check check (
    category in ('food', 'drinks', 'outdoor', 'culture', 'event', 'date', 'trip', 'other')
  ),
  constraint activities_price_level_check check (
    price_level in ('free', 'low', 'medium', 'high', 'unknown')
  ),
  constraint activities_indoor_outdoor_check check (
    indoor_outdoor in ('indoor', 'outdoor', 'both', 'unknown')
  ),
  constraint activities_status_check check (
    status in ('saved', 'planned', 'done', 'archived')
  )
);

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities(id) on delete cascade,
  creator_id uuid not null references auth.users(id) on delete cascade,
  planned_for timestamptz,
  note text,
  status text not null default 'proposed',
  share_token text unique not null default encode(gen_random_bytes(16), 'hex'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint plans_status_check check (
    status in ('proposed', 'confirmed', 'cancelled')
  )
);

create table if not exists public.rsvps (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  guest_name text not null,
  response text not null,
  created_at timestamptz not null default now(),

  constraint rsvps_response_check check (
    response in ('yes', 'maybe', 'no')
  )
);

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_activities_updated_at on public.activities;
create trigger set_activities_updated_at
before update on public.activities
for each row execute function public.set_updated_at();

drop trigger if exists set_plans_updated_at on public.plans;
create trigger set_plans_updated_at
before update on public.plans
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.activities enable row level security;
alter table public.plans enable row level security;
alter table public.rsvps enable row level security;

-- Re-runnable policy setup for the Supabase SQL Editor.
drop policy if exists "Users can view own profile" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Users can view own activities" on public.activities;
drop policy if exists "Users can insert own activities" on public.activities;
drop policy if exists "Users can update own activities" on public.activities;
drop policy if exists "Users can delete own activities" on public.activities;
drop policy if exists "Users can view own plans" on public.plans;
drop policy if exists "Users can insert own plans" on public.plans;
drop policy if exists "Users can update own plans" on public.plans;
drop policy if exists "Users can delete own plans" on public.plans;
drop policy if exists "Users can view RSVPs for own plans" on public.rsvps;

create policy "Users can view own profile"
on public.profiles for select
to authenticated
using (auth.uid() = id);

create policy "Users can insert own profile"
on public.profiles for insert
to authenticated
with check (auth.uid() = id);

create policy "Users can update own profile"
on public.profiles for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "Users can view own activities"
on public.activities for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own activities"
on public.activities for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own activities"
on public.activities for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own activities"
on public.activities for delete
to authenticated
using (auth.uid() = user_id);

create policy "Users can view own plans"
on public.plans for select
to authenticated
using (auth.uid() = creator_id);

create policy "Users can insert own plans"
on public.plans for insert
to authenticated
with check (
  auth.uid() = creator_id
  and exists (
    select 1 from public.activities
    where activities.id = plans.activity_id
    and activities.user_id = auth.uid()
  )
);

create policy "Users can update own plans"
on public.plans for update
to authenticated
using (auth.uid() = creator_id)
with check (auth.uid() = creator_id);

create policy "Users can delete own plans"
on public.plans for delete
to authenticated
using (auth.uid() = creator_id);

create policy "Users can view RSVPs for own plans"
on public.rsvps for select
to authenticated
using (
  exists (
    select 1
    from public.plans
    where plans.id = rsvps.plan_id
    and plans.creator_id = auth.uid()
  )
);

-- No direct anon table policies are created. Public sharing is intentionally
-- constrained to the two security-definer RPC functions below.

create or replace function public.get_shared_plan(token text)
returns table (
  plan_id uuid,
  planned_for timestamptz,
  note text,
  plan_status text,
  activity_title text,
  activity_description text,
  location_name text,
  address text,
  category text,
  price_level text,
  image_url text
)
language sql
security definer
set search_path = public
as $$
  select
    p.id as plan_id,
    p.planned_for,
    p.note,
    p.status as plan_status,
    a.title as activity_title,
    a.description as activity_description,
    a.location_name,
    a.address,
    a.category,
    a.price_level,
    a.image_url
  from public.plans p
  join public.activities a on a.id = p.activity_id
  where p.share_token = token
    and p.status <> 'cancelled'
  limit 1;
$$;

create or replace function public.create_rsvp(token text, guest_name text, response text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  matched_plan_id uuid;
  new_rsvp_id uuid;
begin
  if token is null or length(trim(token)) = 0 then
    raise exception 'Missing share token';
  end if;

  if guest_name is null or length(trim(guest_name)) = 0 or length(trim(guest_name)) > 80 then
    raise exception 'Please provide a valid guest name';
  end if;

  if response not in ('yes', 'maybe', 'no') then
    raise exception 'Invalid RSVP response';
  end if;

  select id into matched_plan_id
  from public.plans
  where share_token = token
    and status <> 'cancelled'
  limit 1;

  if matched_plan_id is null then
    raise exception 'Shared plan not found';
  end if;

  insert into public.rsvps (plan_id, guest_name, response)
  values (matched_plan_id, trim(guest_name), response)
  returning id into new_rsvp_id;

  return new_rsvp_id;
end;
$$;

revoke all on function public.get_shared_plan(text) from public;
revoke all on function public.create_rsvp(text, text, text) from public;
grant execute on function public.get_shared_plan(text) to anon, authenticated;
grant execute on function public.create_rsvp(text, text, text) to anon, authenticated;

create index if not exists activities_user_id_idx on public.activities(user_id);
create index if not exists activities_status_idx on public.activities(status);
create index if not exists activities_category_idx on public.activities(category);
create index if not exists activities_created_at_idx on public.activities(created_at desc);
create index if not exists activities_tags_idx on public.activities using gin(tags);
create index if not exists plans_creator_id_idx on public.plans(creator_id);
create index if not exists plans_activity_id_idx on public.plans(activity_id);
create index if not exists plans_share_token_idx on public.plans(share_token);
create index if not exists rsvps_plan_id_idx on public.rsvps(plan_id);
