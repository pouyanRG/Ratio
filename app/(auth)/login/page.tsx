"use client";

import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  async function signInWithGoogle() {
    const supabase = createClient();
    const next = new URLSearchParams(location.search).get("next");
    const callbackUrl = new URL("/auth/callback", location.origin);
    if (next) callbackUrl.searchParams.set("next", next);

    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl.toString() },
    });
  }

  return (
    <main className="grid min-h-dvh place-items-center px-6">
      <button
        className="rounded bg-zinc-900 px-5 py-3 font-semibold text-white dark:bg-white dark:text-black"
        onClick={signInWithGoogle}
      >
        ورود با گوگل
      </button>
    </main>
  );
}