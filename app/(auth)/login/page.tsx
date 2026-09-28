"use client";

import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  async function signInWithGoogle() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/auth/callback` },
    });
  }

  return (
    <main style={{ display: "grid", placeItems: "center", minHeight: "100dvh" }}>
      <button onClick={signInWithGoogle}>ورود با گوگل</button>
    </main>
  );
}