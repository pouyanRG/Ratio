# چک‌لیست راه‌اندازی Ratio

## Supabase

- [ ] یک پروژهٔ Supabase بسازید و Project URL را ثبت کنید.
- [ ] Publishable key را برای `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` بگیرید.
- [ ] Secret key را فقط برای `SUPABASE_SECRET_KEY` سمت سرور نگه دارید؛ این کلید را در مرورگر یا Git نگذارید.
- [ ] Google provider را در Authentication فعال کنید و callback ارائه‌شده توسط Supabase را در Google Cloud ثبت کنید.
- [ ] migrationهای `0001` تا `0008` را به ترتیب نام روی دیتابیس اجرا کنید.
- [ ] تأیید کنید bucket خصوصی `videos` حداکثر 52,428,800 بایت و MIMEهای `video/mp4` و `image/jpeg` را دارد.
- [ ] global file size limit پروژه را روی 50 MB یا کمتر نگه دارید؛ پلن Free اجازهٔ سقف بالاتر نمی‌دهد.

## تنظیم محلی

- [ ] `.env.local` را بر اساس `.env.example` بسازید و مقادیر Supabase را وارد کنید.
- [ ] `SUPABASE_STORAGE_BUCKET` اختیاری است و به‌طور پیش‌فرض `videos` است.
- [ ] برای تست endpoint پاکسازی، مقدار تصادفی و محرمانه‌ای در `CRON_SECRET` قرار دهید.
- [ ] `npm install` و سپس `npm run dev` اجرا کنید.
- [ ] تست کنید که فایل MP4 حداکثر 50 MiB پذیرفته، فایل بزرگ‌تر یا MIME دیگر رد شود، و آپلود با `PUT` انجام شود.

## Vercel

- [ ] Repository را به Vercel متصل کنید.
- [ ] `NEXT_PUBLIC_SUPABASE_URL`، `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` و `SUPABASE_SECRET_KEY` را در Environment Variables تنظیم کنید.
- [ ] همان `CRON_SECRET` را در Vercel تنظیم کنید تا Cron مجاز به پاکسازی باشد.
- [ ] Deploy کنید و در Supabase، URLهای redirect ورود را برای دامنهٔ نهایی اضافه کنید.
- [ ] پس از deploy، ورود Google، آپلود، پخش URL امضاشده و اجرای cron را بررسی کنید.

## سقف فایل و پاکسازی

- سقف فعلی Ratio برابر 50 MiB است و در UI، API و bucket اعمال می‌شود. برای فایل بزرگ‌تر از این حد، باید پلن Supabase و global file size limit را بالا ببرید و مقدار `MAX_VIDEO_SIZE_BYTES` و migration مربوط به bucket را نیز هماهنگ تغییر دهید.
- Vercel Cron در پلن Hobby روزی یک‌بار اجرا می‌شود. آپلودهای `processing` قدیمی‌تر از ۴۸ ساعت پاک می‌شوند؛ endpoint نیاز به `CRON_SECRET` دارد.

## متغیرهای محیطی

| نام | کاربرد |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | آدرس پروژه |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | کلید عمومی Supabase |
| `SUPABASE_SECRET_KEY` | کلید محرمانهٔ سمت سرور |
| `SUPABASE_STORAGE_BUCKET` | نام bucket؛ اختیاری، پیش‌فرض `videos` |
| `CRON_SECRET` | رمز محافظ endpoint پاکسازی در Vercel |

کلید Google OAuth در تنظیمات Supabase وارد می‌شود و نیازی به env جداگانه در این برنامه ندارد.