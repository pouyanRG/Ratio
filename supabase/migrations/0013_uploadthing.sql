alter table public.videos
  add column if not exists video_url text,
  add column if not exists thumbnail_url text,
  add column if not exists thumbnail_key text;