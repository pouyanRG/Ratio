# Ratio — وضعیت فعلی

## زیرساخت

- GitHub repository: `pouyanRG/Ratio`
- Vercel project: `ratio`؛ دامنهٔ فعلی: `https://raito-self.vercel.app/`
- Supabase project: `Ratio`؛ project ID: `vmvrjadbvwtolvwnsclz`
- آدرس Supabase: `https://vmvrjadbvwtolvwnsclz.supabase.co`
- Google OAuth در Supabase تنظیم شده است؛ callback گوگل باید همان callback نمایش‌داده‌شده در تنظیمات Supabase باشد.

## معماری فعلی کد

Next.js روی Vercel از Supabase Auth و PostgreSQL برای کاربران و metadata و از UploadThing برای فایل‌های ویدیو استفاده می‌کند. آپلود از مرورگر مستقیم به UploadThing می‌رود؛ Bunny، HLS و VPS/FFmpeg worker در مسیر فعلی نیستند.

فقط MP4 تا سقف 50 MiB پذیرفته می‌شود. callback سرور اندازه، امضای فایل و duration را از `moov/mvhd` می‌خواند؛ تا ۹۰ ثانیه نوع `reel` و بالاتر از آن `long` می‌شود. URLهای UploadThing عمومی‌اند و هرکس لینک را داشته باشد می‌تواند فایل را ببیند. سهمیه‌های قبلی برنامه دیگر enforce نمی‌شوند و Vercel Cron پاکسازی حذف شده است.

فازهای feed cursorدار، گرید صفحهٔ اصلی، ریلز snap عمودی با player فعالِ viewport، صفحهٔ `/v/[id]`، Navbar مشترک، حذف ویدیو و ثبت view یکتا در روز پیاده شده‌اند. URLهای مستقیم UploadThing نیاز به تمدید ندارند.

## نام متغیرهای محیطی

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`؛ فقط سرور
- `UPLOADTHING_TOKEN`؛ توکن V7، فقط سرور

مقادیر واقعی در `.env.local` و Vercel نگهداری شوند؛ secretها را در Git یا کد مرورگر قرار ندهید.

## کارهای باقی‌مانده برای استقرار

- اجرای migrationهای `0001` تا `0013` به ترتیب روی پروژهٔ Supabase. Migration `0010` اگر ردیف Story موجود باشد، برای جلوگیری از تغییر داده متوقف می‌شود.
- تنظیم `UPLOADTHING_TOKEN` در Environment Variables در Vercel و deploy مجدد.
- تنظیم Site URL روی `https://raito-self.vercel.app` و ثبت `https://raito-self.vercel.app/auth/callback` در Supabase Auth → URL Configuration → Redirect URLs.
- اجرای migrationها و تست end-to-end ورود، onboarding، آپلود، feed و stream هنوز روی deploy زنده تأیید نشده است. ردیف‌های قدیمی `video_url` ندارند و به‌صورت خودکار منتقل نمی‌شوند.
