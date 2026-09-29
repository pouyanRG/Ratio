import { createClient } from "@supabase/supabase-js";

// Server-only client using the secret key (bypasses RLS).
// Never import this from client components.
export function createAdminClient() {
  const adminKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY!;

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    adminKey,
    {
      auth: { persistSession: false },
      global: {
        fetch: (input, init) => {
          if (!adminKey.startsWith("sb_secret_")) return fetch(input, init);

          const headers = new Headers(init?.headers);
          headers.delete("Authorization");
          return fetch(input, { ...init, headers });
        },
      },
    }
  );
}
