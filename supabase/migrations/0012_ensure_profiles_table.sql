create table if not exists public.profiles (
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

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'profiles_select_all'
  ) then
    create policy "profiles_select_all" on public.profiles for select using (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'profiles_insert_own'
  ) then
    create policy "profiles_insert_own" on public.profiles for insert to authenticated
      with check (auth.uid() = id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'profiles_update_own'
  ) then
    create policy "profiles_update_own" on public.profiles for update to authenticated
      using (auth.uid() = id) with check (auth.uid() = id);
  end if;
end $$;
