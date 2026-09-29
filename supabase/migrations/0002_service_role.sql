-- Phase 2: allow service_role (admin client) to manage profiles and videos.
-- Needed because "Automatically expose new tables" is off, so the sync/webhook
-- server client can't update video status without these grants.
grant all on public.profiles to service_role;
grant all on public.videos   to service_role;
