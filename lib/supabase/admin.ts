import { createClient } from "@supabase/supabase-js";

// Server-only client using the secret key (bypasses RLS).
// Never import this from client components.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false } }
  );
}
