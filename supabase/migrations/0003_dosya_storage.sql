alter table public.videos add column if not exists storage_key text unique;
grant insert (id, storage_key, status) on public.videos to authenticated;