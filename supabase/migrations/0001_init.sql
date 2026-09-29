-- PROFILES
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null check (username ~ '^[a-z0-9_.]{3,30}$'),
  display_name text,
  avatar_url text,
  bio text,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
grant select on public.profiles to anon, authenticated;
grant insert, update on public.profiles to authenticated;

create policy "profiles_select_all" on public.profiles for select using (true);
create policy "profiles_insert_own" on public.profiles for insert to authenticated
  with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

-- VIDEOS (Supabase Storage)
create table public.videos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('reel','long','story')),
  duration_seconds int,
  caption text,
  status text not null default 'processing'
    check (status in ('processing','ready','failed')),
  views_count int not null default 0,
  created_at timestamptz not null default now()
);
create index on public.videos (user_id, created_at desc);
create index on public.videos (status);
alter table public.videos enable row level security;
grant select on public.videos to anon, authenticated;
grant insert (user_id, type, caption) on public.videos to authenticated;
grant update (caption) on public.videos to authenticated;

create policy "videos_select" on public.videos for select
  using (status = 'ready' or auth.uid() = user_id);
create policy "videos_insert_own" on public.videos for insert to authenticated
  with check (auth.uid() = user_id);
create policy "videos_update_own" on public.videos for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);