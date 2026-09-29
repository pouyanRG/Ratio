import Link from "next/link";

export function Navbar() {
  return (
    <nav className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-zinc-200 bg-white/95 px-4 backdrop-blur dark:border-zinc-800 dark:bg-black/95 md:px-8">
      <Link className="font-semibold" href="/">Ratio</Link>
      <div className="flex items-center gap-4 text-sm">
        <Link className="text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-white" href="/reels">
          ریلز
        </Link>
        <Link className="text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-white" href="/upload">
          آپلود
        </Link>
        <Link className="text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-white" href="/settings">
          تنظیمات
        </Link>
      </div>
    </nav>
  );
}