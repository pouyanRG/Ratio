# Ratio — وضعیت فعلی

## زیرساخت

- GitHub repository: `pouyanRG/Ratio`
- Vercel project: `ratio`؛ دامنهٔ ثبت‌شده: `https://ratio-self.vercel.app/`
- Supabase project: `Ratio`؛ project ID: `vmvrjadbvwtolvwnsclz`
- آدرس Supabase: `https://vmvrjadbvwtolvwnsclz.supabase.co`
- Google OAuth در Supabase تنظیم شده است؛ callback گوگل باید همان callback نمایش‌داده‌شده در تنظیمات Supabase باشد.

## معماری فعلی کد

Next.js روی Vercel از Supabase Auth، PostgreSQL و bucket خصوصی Supabase Storage استفاده می‌کند. آپلود مستقیم با signed URL و `PUT` انجام می‌شود؛ Bunny، HLS و VPS/FFmpeg worker در مسیر فعلی نیستند.

فقط MP4 تا سقف 50 MiB پذیرفته می‌شود. سرور اندازه، امضای فایل و duration را از `moov/mvhd` می‌خواند؛ تا ۹۰ ثانیه نوع `reel` و بالاتر از آن `long` می‌شود. سهمیه‌ها: ۲ آپلود فعال، ۱۰ شروع در ۲۴ ساعت، 500 MiB برای هر کاربر و 900 MiB برای کل پروژه. پاکسازی ردیف و فایل‌های یتیم با Vercel Cron روزانه و `CRON_SECRET` انجام می‌شود.

فاز ۳ در کد پیاده شده: feed cursorدار و thumbnail signing دسته‌ای، گرید صفحهٔ اصلی، ریلز snap عمودی با player فعالِ viewport، صفحهٔ `/v/[id]`، Navbar مشترک، حذف ویدیو، ثبت view یکتا در روز و تمدید signed URL پیش از پایان اعتبار.

## نام متغیرهای محیطی

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`؛ فقط سرور
- `SUPABASE_STORAGE_BUCKET`؛ اختیاری، پیش‌فرض `videos`
- `CRON_SECRET`؛ برای زمان‌بندی پاکسازی

مقادیر واقعی در `.env.local` و Vercel نگهداری شوند؛ secretها را در Git یا کد مرورگر قرار ندهید.

## کارهای باقی‌مانده برای استقرار

- اجرای migrationهای `0001` تا `0011` به ترتیب روی پروژهٔ Supabase. Migration `0010` اگر ردیف Story موجود باشد، برای جلوگیری از تغییر داده متوقف می‌شود.
- افزودن `CRON_SECRET` به Environment Variables در Vercel و deploy مجدد.
- ثبت `https://ratio-self.vercel.app/auth/callback` در Supabase Auth → URL Configuration → Redirect URLs.
- ثبت `CRON_SECRET` در Vercel، اجرای migrationها و تست end-to-end ورود، onboarding، آپلود، feed و stream هنوز روی deploy زنده تأیید نشده است.
- تمدید خودکار signed URL از دقیقهٔ ۵۵ انجام می‌شود و refresh آن view تکراری نمی‌سازد.
