# Ratio — وضعیت فعلی

## زیرساخت

- GitHub repository: `pouyanRG/Ratio`
- Vercel project: `ratio`؛ دامنهٔ ثبت‌شده: `https://ratio-self.vercel.app/`
- Supabase project: `Ratio`؛ project ID: `vmvrjadbvwtolvwnsclz`
- آدرس Supabase: `https://vmvrjadbvwtolvwnsclz.supabase.co`
- Google OAuth در Supabase تنظیم شده است؛ callback گوگل باید همان callback نمایش‌داده‌شده در تنظیمات Supabase باشد.

## معماری فعلی کد

Next.js روی Vercel از Supabase Auth، PostgreSQL و bucket خصوصی Supabase Storage استفاده می‌کند. آپلود مستقیم با signed URL و `PUT` انجام می‌شود؛ Bunny، HLS و VPS/FFmpeg worker در مسیر فعلی نیستند.

فقط MP4 تا سقف 50 MiB پذیرفته می‌شود. API اندازهٔ واقعی و امضای فایل را چک می‌کند و duration اعلام‌شده از مرورگر را ذخیره نمی‌کند. سهمیه‌ها: ۲ آپلود فعال، ۱۰ شروع در ۲۴ ساعت، 500 MiB برای هر کاربر و 900 MiB برای کل پروژه. پاکسازی ردیف و فایل‌های یتیم با Vercel Cron روزانه و `CRON_SECRET` انجام می‌شود.

## نام متغیرهای محیطی

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`؛ فقط سرور
- `SUPABASE_STORAGE_BUCKET`؛ اختیاری، پیش‌فرض `videos`
- `CRON_SECRET`؛ برای زمان‌بندی پاکسازی

مقادیر واقعی در `.env.local` و Vercel نگهداری شوند؛ secretها را در Git یا کد مرورگر قرار ندهید.

## کارهای باقی‌مانده برای استقرار

- اجرای migrationهای `0001` تا `0010` به ترتیب روی پروژهٔ Supabase. Migration `0010` اگر ردیف Story موجود باشد، برای جلوگیری از تغییر داده متوقف می‌شود.
- افزودن `CRON_SECRET` به Environment Variables در Vercel و deploy مجدد.
- ثبت `https://ratio-self.vercel.app/auth/callback` در Supabase Auth → URL Configuration → Redirect URLs.
- ثبت `https://ratio-self.vercel.app/auth/callback` در Supabase Auth → URL Configuration → Redirect URLs.
- تست end-to-end ورود، onboarding، آپلود MP4 تا 50 MiB، complete تکراری و دریافت URL پخش پس از اجرای migrationها.
- اجرای پلیر و تمدید خودکار signed URL یک‌ساعته هنوز به فاز ۳ موکول است؛ فعلاً هر درخواست جدید به stream URL تازه می‌گیرد.
