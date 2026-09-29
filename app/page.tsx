import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-16 text-center">
      <div className="grid gap-3">
        <p className="text-sm font-semibold uppercase text-zinc-500">Ratio</p>
        <h1 className="text-4xl font-semibold">ویدیوهایت را به اشتراک بگذار</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          ویدیوها را آپلود کن و با لینک امن تماشا کن.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <Link
          className="rounded bg-zinc-900 px-5 py-3 text-white dark:bg-white dark:text-black"
          href="/upload"
        >
          آپلود ویدیو
        </Link>
        <Link className="rounded border border-zinc-300 px-5 py-3" href="/login">
          ورود
        </Link>
      </div>
    </main>
  );
}
