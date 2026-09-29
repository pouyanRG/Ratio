create index if not exists videos_feed_status_created_id_idx
  on public.videos (status, created_at desc, id desc);