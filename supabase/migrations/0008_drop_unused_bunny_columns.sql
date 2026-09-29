alter table public.videos
  drop column if exists bunny_video_id,
  drop column if exists thumbnail_url;