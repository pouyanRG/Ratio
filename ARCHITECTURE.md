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
2. `POST /api/upload/init` کاربر، نوع فایل و اندازهٔ اعلامی را بررسی می‌کند؛ RPC تراکنشی و lockدار سهمیه را رزرو می‌کند و سپس URLهای امضاشدهٔ فایل و thumbnail را می‌سازد.
3. مرورگر بایت‌های خام را مستقیماً با `PUT` به Supabase Storage می‌فرستد؛ ویدیو از Vercel عبور نمی‌کند.
4. `POST /api/upload/complete` مالکیت، اندازهٔ واقعی Storage و امضای باینری MP4 را بررسی می‌کند؛ فقط ردیف `processing` را `ready` می‌کند. duration مرورگر ذخیره نمی‌شود و تا زمان parser معتبر `null` می‌ماند.
5. endpoint پخش برای ویدیوی آماده URL امضاشدهٔ یک‌ساعته می‌دهد. هر درخواست URL تازه می‌سازد؛ تمدید خودکار هنگام پخش به VideoPlayer فاز ۳ وابسته است و هنوز پیاده نشده.

سهمیه‌های فعلی پیش‌فرض‌های قابل‌تغییرند: حداکثر ۲ آپلود فعال و ۱۰ شروع آپلود در هر ۲۴ ساعت برای هر کاربر، 500 MiB فضای رزروشده برای هر کاربر و 900 MiB برای کل ویدیوهای برنامه. فایل pending کل 50 MiB را رزرو می‌کند؛ پس از `complete` اندازهٔ واقعی جایگزین رزرو می‌شود.

bucket خصوصی فقط `video/mp4` و `image/jpeg` را می‌پذیرد و سقف هر فایل آن 52,428,800 بایت (50 MiB) است. سقف پلن Free در Supabase هم 50 MB است. برای فایل‌های بزرگ‌تر باید پلن و global limit پروژه ارتقا یابد و هم‌زمان محدودیت UI/API و migration bucket تغییر کند.

## پاکسازی آپلودهای رهاشده

Vercel Cron روزی یک‌بار به `GET /api/cron/cleanup-uploads` درخواست می‌فرستد. endpoint فقط با `Authorization: Bearer $CRON_SECRET` اجرا می‌شود. ردیف‌های `processing` قدیمی‌تر از ۴۸ ساعت ابتدا به `failed` منتقل می‌شوند؛ سپس فایل و thumbnail حذف و در پایان ردیف پاک می‌شود. خطاها ردیف را نگه می‌دارند تا اجرای بعدی دوباره تلاش کند. Cron همچنین پوشه‌های Storage بدون ردیف و قدیمی‌تر از ۴۸ ساعت را پاک می‌کند تا حذف cascade پروفایل فایل یتیم نگذارد.

پلن Hobby کرون را حداکثر روزی یک‌بار اجرا می‌کند؛ اجرای زمان‌بندی‌شده ممکن است در همان ساعت با تأخیر انجام شود. تنظیم زمان در `vercel.json` است.

## پایگاه داده

- `profiles`: اطلاعات پروفایل متصل به `auth.users`
- `videos`: مالک، نوع (`reel` یا `long`)، `storage_key`، `file_size_bytes`، caption، duration nullable، status، شمارنده و زمان ایجاد
- `video_views`: آخرین بازدید هر ویدیو برای هر کاربر واردشده؛ شمارنده برای هر حساب حداکثر یک‌بار در ۲۴ ساعت زیاد می‌شود.
- ستون‌های مخصوص Bunny مانند `bunny_video_id` و `thumbnail_url` استفاده نمی‌شوند.
- RLS برای جدول‌ها فعال است. درج ویدیو مستقیم از کلاینت بسته است و فقط RPC سهمیه‌دار می‌تواند رزرو بسازد؛ تغییر وضعیت با کلید secret و فقط سمت سرور انجام می‌شود.
- `DELETE /api/videos/[id]` فایل‌ها و ردیف ویدیوی آمادهٔ متعلق به کاربر را حذف می‌کند.
- Story تا آماده‌شدن API آن در فاز ۵ از schema/API پشتیبانی نمی‌شود. Migration `0010` در صورت وجود ردیف Story قدیمی متوقف می‌شود.

Migrationها به ترتیب نام در `supabase/migrations/` قرار دارند. `0007` محدودیت bucketهای موجود را تنظیم می‌کند، `0008` ستون‌های قدیمی Bunny را حذف می‌کند، `0009` سهمیه و RPC رزرو را اضافه می‌کند و `0010` Story را تا فاز بعد غیرفعال و ثبت بازدید را اضافه می‌کند.

Proxy فقط روی `/upload` و `/settings` اجرا می‌شود. فونت رابط Vazirmatn است. اجرای `npm test` تست‌های محدودیت آپلود و routeهای امنیتی را اجرا می‌کند؛ GitHub Actions lint، test و build را بررسی می‌کند.

## متغیرهای محیطی

| نام | محل استفاده |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | مرورگر و سرور |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | مرورگر و سرور |
| `SUPABASE_SECRET_KEY` | فقط سرور؛ هرگز در مرورگر یا Git قرار نگیرد |
| `SUPABASE_STORAGE_BUCKET` | اختیاری؛ پیش‌فرض `videos` |
| `CRON_SECRET` | فقط سرور/Vercel؛ محافظت از endpoint پاکسازی |

نمونهٔ نام‌ها در `.env.example` آمده است. مقادیر واقعی را در `.env.local` و Environment Variables پروژهٔ Vercel نگه دارید.
