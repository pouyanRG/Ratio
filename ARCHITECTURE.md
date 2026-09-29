# معماری فعلی Ratio

## فناوری‌ها

- Next.js 16 App Router و React 19 روی Vercel
- Supabase Auth، PostgreSQL و Storage خصوصی
- Tailwind CSS 4 برای استایل UI؛ `app/globals.css` فقط Tailwind و توکن‌های پایه را بارگذاری می‌کند.
- رابط فارسی با `lang="fa"` و `dir="rtl"`
- فایل اصلی MP4 و thumbnail JPEG در bucket خصوصی `videos` ذخیره می‌شوند.

در پیاده‌سازی فعلی Bunny Stream، worker، FFmpeg و HLS وجود ندارد. پخش از URL امضاشدهٔ فایل اصلی انجام می‌شود و API آن در `app/api/stream/[id]/route.ts` است.

## جریان آپلود

1. مرورگر فایل MP4 را حداکثر ۵۰ MiB اعتبارسنجی می‌کند.
2. `POST /api/upload/init` کاربر، نوع فایل و اندازه را بررسی می‌کند؛ ردیف `processing` می‌سازد و URLهای امضاشدهٔ فایل و thumbnail را برمی‌گرداند.
3. مرورگر بایت‌های خام را مستقیماً با `PUT` به Supabase Storage می‌فرستد؛ ویدیو از Vercel عبور نمی‌کند.
4. `POST /api/upload/complete` وجود فایل و مالکیت ردیف را بررسی می‌کند و فقط ردیفی را که هنوز `processing` است به `ready` تغییر می‌دهد.
5. endpoint پخش برای ویدیوی آماده URL امضاشدهٔ کوتاه‌مدت می‌دهد.

bucket خصوصی فقط `video/mp4` و `image/jpeg` را می‌پذیرد و سقف هر فایل آن 52,428,800 بایت (50 MiB) است. سقف پلن Free در Supabase هم 50 MB است. برای فایل‌های بزرگ‌تر باید پلن و global limit پروژه ارتقا یابد و هم‌زمان محدودیت UI/API و migration bucket تغییر کند.

## پاکسازی آپلودهای رهاشده

Vercel Cron روزی یک‌بار به `GET /api/cron/cleanup-uploads` درخواست می‌فرستد. endpoint فقط با `Authorization: Bearer $CRON_SECRET` اجرا می‌شود. ردیف‌های `processing` قدیمی‌تر از ۴۸ ساعت ابتدا به `failed` منتقل می‌شوند؛ سپس فایل و thumbnail حذف و در پایان ردیف پاک می‌شود. خطاها ردیف را نگه می‌دارند تا اجرای بعدی دوباره تلاش کند.

پلن Hobby کرون را حداکثر روزی یک‌بار اجرا می‌کند؛ اجرای زمان‌بندی‌شده ممکن است در همان ساعت با تأخیر انجام شود. تنظیم زمان در `vercel.json` است.

## پایگاه داده

- `profiles`: اطلاعات پروفایل متصل به `auth.users`
- `videos`: مالک، نوع (`reel` یا `long`)، `storage_key`، caption، duration، status، شمارنده و زمان ایجاد
- ستون‌های مخصوص Bunny مانند `bunny_video_id` و `thumbnail_url` استفاده نمی‌شوند.
- RLS برای جدول‌ها فعال است. کاربران فقط ردیف‌های خود را می‌سازند؛ تغییر وضعیت ویدیو با کلید secret و فقط سمت سرور انجام می‌شود.

Migrationها به ترتیب نام در `supabase/migrations/` قرار دارند. `0007` محدودیت bucketهای موجود را هم تنظیم می‌کند و `0008` ستون‌های قدیمی Bunny را حذف می‌کند.

## متغیرهای محیطی

| نام | محل استفاده |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | مرورگر و سرور |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | مرورگر و سرور |
| `SUPABASE_SECRET_KEY` | فقط سرور؛ هرگز در مرورگر یا Git قرار نگیرد |
| `SUPABASE_STORAGE_BUCKET` | اختیاری؛ پیش‌فرض `videos` |
| `CRON_SECRET` | فقط سرور/Vercel؛ محافظت از endpoint پاکسازی |

نمونهٔ نام‌ها در `.env.example` آمده است. مقادیر واقعی را در `.env.local` و Environment Variables پروژهٔ Vercel نگه دارید.