alter table public.videos
  add column if not exists file_size_bytes bigint not null default 52428800;

create or replace function public.reserve_video_upload(
  p_video_id uuid,
  p_type text,
  p_storage_key text,
  p_caption text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  requesting_user uuid := auth.uid();
  active_uploads integer;
  uploads_last_day integer;
  user_storage_bytes bigint;
  total_storage_bytes bigint;
  reserved_size constant bigint := 52428800;
  user_limit constant bigint := 524288000;
  project_limit constant bigint := 943718400;
begin
  if requesting_user is null then
    raise exception 'UPLOAD_AUTH_REQUIRED';
  end if;
  if p_type not in ('reel', 'long') then
    raise exception 'UPLOAD_TYPE_NOT_ALLOWED';
  end if;
  if p_storage_key <> 'videos/' || p_video_id::text || '/original.mp4' then
    raise exception 'UPLOAD_STORAGE_KEY_INVALID';
  end if;
  if p_caption is not null and length(p_caption) > 2200 then
    raise exception 'UPLOAD_CAPTION_TOO_LONG';
  end if;
  if not exists (select 1 from public.profiles where id = requesting_user) then
    raise exception 'UPLOAD_PROFILE_REQUIRED';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('ratio-video-storage-quota', 0));
  perform pg_advisory_xact_lock(hashtextextended(requesting_user::text, 0));

  select count(*) into active_uploads
  from public.videos
  where user_id = requesting_user and status = 'processing';
  if active_uploads >= 2 then
    raise exception 'UPLOAD_ACTIVE_LIMIT';
  end if;

  select count(*) into uploads_last_day
  from public.videos
  where user_id = requesting_user
    and created_at >= now() - interval '24 hours';
  if uploads_last_day >= 10 then
    raise exception 'UPLOAD_DAILY_LIMIT';
  end if;

  select coalesce(sum(file_size_bytes), 0) into user_storage_bytes
  from public.videos
  where user_id = requesting_user;
  if user_storage_bytes + reserved_size > user_limit then
    raise exception 'UPLOAD_USER_STORAGE_QUOTA';
  end if;

  select coalesce(sum(file_size_bytes), 0) into total_storage_bytes
  from public.videos;
  if total_storage_bytes + reserved_size > project_limit then
    raise exception 'UPLOAD_PROJECT_STORAGE_QUOTA';
  end if;

  insert into public.videos (
    id, user_id, type, storage_key, caption, status, file_size_bytes
  ) values (
    p_video_id, requesting_user, p_type, p_storage_key, p_caption,
    'processing', reserved_size
  );

  return p_video_id;
end;
$function$;

revoke all on function public.reserve_video_upload(uuid, text, text, text) from public;
grant execute on function public.reserve_video_upload(uuid, text, text, text) to authenticated;
revoke insert on table public.videos from authenticated;
revoke insert (id, user_id, type, caption, storage_key, status, file_size_bytes)
  on table public.videos from authenticated;