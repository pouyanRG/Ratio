update storage.buckets
set public = false,
    file_size_limit = 52428800,
    allowed_mime_types = array['video/mp4', 'image/jpeg']::text[]
where id = 'videos';