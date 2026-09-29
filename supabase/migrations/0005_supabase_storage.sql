insert into storage.buckets (
	id,
	name,
	public,
	file_size_limit,
	allowed_mime_types
)
values (
	'videos',
	'videos',
	false,
	52428800,
	array['video/mp4', 'image/jpeg']::text[]
)
on conflict (id) do update
set public = false,
		file_size_limit = excluded.file_size_limit,
		allowed_mime_types = excluded.allowed_mime_types;