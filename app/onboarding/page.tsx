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
    <main className="mx-auto grid w-full max-w-sm content-start gap-4 px-6 py-10 text-right">
      <h1 className="text-2xl font-semibold">تکمیل پروفایل</h1>
      <input
        className="rounded border border-zinc-300 bg-transparent p-3"
        placeholder="username (انگلیسی)"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        dir="ltr"
      />
      <input
        className="rounded border border-zinc-300 bg-transparent p-3"
        placeholder="نام نمایشی"
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
      />
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <button
        className="rounded bg-zinc-900 px-4 py-3 text-white disabled:opacity-50 dark:bg-white dark:text-black"
        onClick={submit}
        disabled={loading}
      >
        {loading ? "..." : "ادامه"}
      </button>
    </main>
  );
}
