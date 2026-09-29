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
    <main style={{ display: "grid", placeItems: "center", minHeight: "100dvh" }}>
      <button onClick={signInWithGoogle}>ورود با گوگل</button>
    </main>
  );
}