# معماری فعلی Ratio

## فناوری‌ها

- Next.js 16 App Router و React 19 روی Vercel
- Supabase Auth و PostgreSQL برای کاربران و metadata؛ UploadThing برای فایل‌ها
- Tailwind CSS 4 برای استایل UI؛ `app/globals.css` فقط Tailwind و توکن‌های پایه را بارگذاری می‌کند.
- رابط فارسی با `lang="fa"` و `dir="rtl"`
- فایل MP4 و thumbnail JPEG در UploadThing ذخیره می‌شوند و URL عمومی‌شان در جدول `videos` است.

در پیاده‌سازی فعلی Bunny Stream، worker، FFmpeg و HLS وجود ندارد. پخش MP4 از URL عمومی UploadThing انجام می‌شود. صفحهٔ اصلی گرید feed، `/reels` فید عمودی، و `/v/[id]` صفحهٔ تماشای ویدیوی بلند است؛ route group اصلی Navbar مشترک دارد.

## جریان آپلود

1. مرورگر فایل MP4 را حداکثر ۵۰ MiB اعتبارسنجی می‌کند.
2. `POST /api/uploadthing` به کاربر واردشده و دارای profile اجازهٔ آپلود ویدیو یا thumbnail می‌دهد.
3. مرورگر فایل را مستقیماً به UploadThing می‌فرستد؛ بایت‌های ویدیو از Vercel عبور نمی‌کنند.
4. callback سمت سرور اندازه، امضای MP4 و duration داخل `moov/mvhd` را با Range request بررسی می‌کند؛ سپس `storage_key`، `video_url` و metadata را در `videos` ذخیره می‌کند. duration اعلامی مرورگر استفاده نمی‌شود. ویدیوهای تا ۹۰ ثانیه `reel` و بقیه `long` می‌شوند.
5. thumbnail از مرورگر استخراج و جداگانه آپلود می‌شود. Player URL مستقیم را از `GET /api/stream/[id]` می‌گیرد و نیازی به refresh دوره‌ای ندارد؛ retry پس از خطای پخش view جدید ثبت نمی‌کند.

فایل‌ها در UploadThing عمومی‌اند: هرکسی URL را داشته باشد می‌تواند محتوا را ببیند. حد ۵۰ MiB نیز در UI و callback سمت سرور بررسی می‌شود؛ سقف endpoint UploadThing برابر ۶۴ MB تنظیم شده و محدودیت برنامه ۵۰ MiB است. پلن رایگان UploadThing سقف کلی ۲ GiB دارد. محدودیت‌های قبلی دو آپلود هم‌زمان، ۱۰ آپلود روزانه و سهمیهٔ حجمی per-user/per-project دیگر enforce نمی‌شوند؛ RPC قدیمی در migrationها باقی مانده ولی برنامه آن را فراخوانی نمی‌کند.

## پایگاه داده

- `profiles`: اطلاعات پروفایل متصل به `auth.users`
- `videos`: مالک، نوع (`reel` یا `long`)، `storage_key` (کلید UploadThing)، `video_url`، `thumbnail_url`، `thumbnail_key`، `file_size_bytes`، caption، duration از MP4، status، شمارنده و زمان ایجاد
- `video_views`: آخرین بازدید هر ویدیو برای هر کاربر واردشده؛ شمارنده برای هر حساب حداکثر یک‌بار در ۲۴ ساعت زیاد می‌شود.
- Feed: `GET /api/feed?type=reel&cursor=...` از keyset cursor روی `(created_at, id)` استفاده می‌کند و URL thumbnail را مستقیم از دیتابیس می‌خواند.
- ستون‌های مخصوص Bunny مانند `bunny_video_id` استفاده نمی‌شوند.
- RLS برای جدول‌ها فعال است. callbackهای UploadThing با Supabase admin پس از احراز هویت و بررسی profile ویدیوها را درج می‌کنند؛ درج مستقیم از مرورگر انجام نمی‌شود.
- `DELETE /api/videos/[id]` فایل‌ها و ردیف ویدیوی آمادهٔ متعلق به کاربر را حذف می‌کند.
- Story تا آماده‌شدن API آن در فاز ۵ از schema/API پشتیبانی نمی‌شود. Migration `0010` در صورت وجود ردیف Story قدیمی متوقف می‌شود.

Migrationها به ترتیب نام در `supabase/migrations/` قرار دارند. `0013` ستون‌های URL و کلید thumbnail UploadThing را اضافه می‌کند. Migrationهای قبلی Storage و سهمیه برای تاریخچهٔ schema باقی می‌مانند. ردیف‌های قدیمی که `video_url` ندارند در stream پاسخ ۴۰۴ می‌گیرند و فایل‌هایشان خودکار منتقل نمی‌شوند.

Proxy فقط روی `/upload` و `/settings` اجرا می‌شود؛ feed و watch عمومی‌اند. فونت رابط Vazirmatn است. `npm test`، `npm run lint` و `npm run build` در GitHub Actions بررسی می‌شوند.

## متغیرهای محیطی

| نام | محل استفاده |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | مرورگر و سرور |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | مرورگر و سرور |
| `SUPABASE_SECRET_KEY` | فقط سرور برای دسترسی admin به دیتابیس؛ هرگز در مرورگر یا Git قرار نگیرد |
| `UPLOADTHING_TOKEN` | توکن V7 از UploadThing API Keys؛ فقط سرور و هرگز در مرورگر یا Git قرار نگیرد |

نمونهٔ نام‌ها در `.env.example` آمده است. مقادیر واقعی را در `.env.local` و Environment Variables پروژهٔ Vercel نگه دارید.
