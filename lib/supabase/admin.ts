import { createClient } from "@supabase/supabase-js";

// Server-only client using the secret key (bypasses RLS).
// Never import this from client components.
export function createAdminClient() {
  const secretKey = process.env.SUPABASE_SECRET_KEY!;

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    secretKey,
    {
      auth: { persistSession: false },
      global: {
        fetch: (input, init) => {
          if (!secretKey.startsWith("sb_secret_")) return fetch(input, init);

          const headers = new Headers(init?.headers);
          headers.delete("Authorization");
          return fetch(input, { ...init, headers });
        },
      },
    }
  );
}
