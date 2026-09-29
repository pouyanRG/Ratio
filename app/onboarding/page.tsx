"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function OnboardingPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    setError("");
    const u = username.trim().toLowerCase();
    if (!/^[a-z0-9_.]{3,30}$/.test(u)) {
      setError("نام کاربری ۳ تا ۳۰ کاراکتر و فقط a-z ، 0-9 ، _ و . باشد");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      router.replace("/login");
      return;
    }

    const { error } = await supabase.from("profiles").insert({
      id: user.id,
      username: u,
      display_name: displayName.trim() || u,
      avatar_url:
        (user.user_metadata?.avatar_url as string | undefined) ?? null,
    });

    setLoading(false);
    if (error) {
      setError(
        error.code === "23505" ? "این نام کاربری گرفته شده" : error.message
      );
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <main
      dir="rtl"
      style={{
        maxWidth: 380,
        margin: "0 auto",
        padding: 24,
        display: "grid",
        gap: 12,
      }}
    >
      <h1>تکمیل پروفایل</h1>
      <input
        placeholder="username (انگلیسی)"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        dir="ltr"
      />
      <input
        placeholder="نام نمایشی"
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
      />
      {error && <p style={{ color: "#ff2d55" }}>{error}</p>}
      <button onClick={submit} disabled={loading}>
        {loading ? "..." : "ادامه"}
      </button>
    </main>
  );
}
