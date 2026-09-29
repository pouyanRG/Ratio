do $migration$
begin
  if exists (select 1 from public.videos where type = 'story') then
    raise exception 'Resolve existing story rows before disabling story uploads';
  end if;
end;
$migration$;

alter table public.videos
  drop constraint if exists videos_type_check;
alter table public.videos
  add constraint videos_type_check check (type in ('reel', 'long'));

create table public.video_views (
  video_id uuid not null references public.videos(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  last_viewed_at timestamptz not null default now(),
  primary key (video_id, user_id)
);

alter table public.video_views enable row level security;
revoke all on public.video_views from anon, authenticated;

create or replace function public.record_video_view(p_video_id uuid)
returns bigint
language plpgsql
security definer
set search_path = ''
as $function$
declare
  requesting_user uuid := auth.uid();
  changed_rows integer;
  current_count bigint;
begin
  if requesting_user is null then
    raise exception 'VIEW_AUTH_REQUIRED';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(requesting_user::text || p_video_id::text, 0)
  );

  insert into public.video_views (video_id, user_id, last_viewed_at)
  select id, requesting_user, now()
  from public.videos
  where id = p_video_id and status = 'ready'
  on conflict (video_id, user_id) do update
    set last_viewed_at = now()
    where public.video_views.last_viewed_at < now() - interval '24 hours';

  get diagnostics changed_rows = row_count;
  if changed_rows = 0 then
    select views_count into current_count
    from public.videos
    where id = p_video_id and status = 'ready';
    if current_count is null then
      raise exception 'VIDEO_NOT_READY';
    end if;
    return current_count;
  end if;

  update public.videos
  set views_count = views_count + 1
  where id = p_video_id and status = 'ready'
  returning views_count into current_count;

  if current_count is null then
    raise exception 'VIDEO_NOT_READY';
  end if;
  return current_count;
end;
$function$;

revoke all on function public.record_video_view(uuid) from public;
grant execute on function public.record_video_view(uuid) to authenticated;