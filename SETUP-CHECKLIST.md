# چک‌لیست راه‌اندازی Ratio

## Supabase

- [ ] یک پروژهٔ Supabase بسازید و Project URL را ثبت کنید.
- [ ] Publishable key را برای `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` بگیرید.
- [ ] Secret key را فقط برای `SUPABASE_SECRET_KEY` سمت سرور نگه دارید؛ این کلید را در مرورگر یا Git نگذارید.
- [ ] برای امضای URL آپلود Storage، JWT قدیمی `service_role` را در `SUPABASE_SERVICE_ROLE_KEY` قرار دهید؛ این مقدار فقط سمت سرور است و هرگز نباید در مرورگر یا Git قرار بگیرد.
- [ ] Google provider را در Authentication فعال کنید و callback ارائه‌شده توسط Supabase را در Google Cloud ثبت کنید.
- [ ] migrationهای `0001` تا `0011` را به ترتیب نام روی دیتابیس اجرا کنید. اگر migration `0010` به‌خاطر وجود ویدیوی Story متوقف شد، قبل از ادامه آن ردیف‌ها را بررسی کنید؛ migration آن‌ها را حذف نمی‌کند.
- [ ] تأیید کنید bucket خصوصی `videos` حداکثر 52,428,800 بایت و MIMEهای `video/mp4` و `image/jpeg` را دارد.
- [ ] global file size limit پروژه را روی 50 MB یا کمتر نگه دارید؛ پلن Free اجازهٔ سقف بالاتر نمی‌دهد.

## تنظیم محلی

- [ ] Node.js نسخهٔ 22 یا بالاتر نصب باشد.
- [ ] `.env.local` را بر اساس `.env.example` بسازید و مقادیر Supabase را وارد کنید.
- [ ] `SUPABASE_STORAGE_BUCKET` اختیاری است و به‌طور پیش‌فرض `videos` است.
- [ ] برای تست endpoint پاکسازی، مقدار تصادفی و محرمانه‌ای در `CRON_SECRET` قرار دهید.
- [ ] `npm install` و سپس `npm run dev` اجرا کنید.
- [ ] `npm test` را اجرا کنید؛ CI نیز lint، test و build را روی push و pull request اجرا می‌کند.
- [ ] تست‌ها باید MP4های دارای `moov` در ابتدا و انتهای فایل، classification در مرز ۹۰ ثانیه، pagination فید، refresh پلیر و عدم افزایش view هنگام refresh را پوشش دهند.
- [ ] تست کنید که فایل MP4 حداکثر 50 MiB پذیرفته، فایل بزرگ‌تر یا MIME دیگر رد شود، و آپلود با `PUT` انجام شود.

## Vercel

- [ ] Repository را به Vercel متصل کنید.
- [ ] `NEXT_PUBLIC_SUPABASE_URL`، `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`، `SUPABASE_SECRET_KEY` و `SUPABASE_SERVICE_ROLE_KEY` را در Environment Variables تنظیم کنید.
- [ ] همان `CRON_SECRET` را در Vercel تنظیم کنید تا Cron مجاز به پاکسازی باشد.
- [ ] در Supabase Auth → URL Configuration، Site URL را روی `https://raito-self.vercel.app` بگذارید و این callback را به Redirect URLs اضافه کنید: `https://raito-self.vercel.app/auth/callback`.
- [ ] پس از deploy، ورود Google، آپلود، پخش URL امضاشده و اجرای cron را بررسی کنید.

## سقف فایل و پاکسازی

- سقف فعلی Ratio برابر 50 MiB است و در UI، API و bucket اعمال می‌شود. برای فایل بزرگ‌تر از این حد، باید پلن Supabase و global file size limit را بالا ببرید و مقدار `MAX_VIDEO_SIZE_BYTES` و migration مربوط به bucket را نیز هماهنگ تغییر دهید.
- Vercel Cron در پلن Hobby روزی یک‌بار اجرا می‌شود. آپلودهای `processing` قدیمی‌تر از ۴۸ ساعت پاک می‌شوند؛ endpoint نیاز به `CRON_SECRET` دارد.
- سهمیهٔ پیش‌فرض: ۲ آپلود هم‌زمان، ۱۰ شروع در ۲۴ ساعت، 500 MiB برای هر کاربر و 900 MiB برای کل ویدیوهای برنامه. مقدارها در function موجود در migration `0009` قابل تغییرند.
- حذف ویدیوهای آماده از `DELETE /api/videos/[id]` انجام می‌شود. شمارش view برای کاربران واردشده در endpoint پخش و حداکثر یک بار در ۲۴ ساعت برای هر ویدیو/کاربر افزایش می‌یابد.
- `duration_seconds` از ساختار MP4 سمت سرور استخراج می‌شود؛ فایل‌های تا ۹۰ ثانیه reel و فایل‌های طولانی‌تر long هستند. مقدار ارسالی مرورگر برای duration استفاده نمی‌شود.
- فید، صفحهٔ `/reels` و `/v/[id]` در کد هستند. Player URL را قبل از انقضای یک‌ساعته refresh می‌کند؛ refresh نباید view جدید بشمارد.

## متغیرهای محیطی

| نام | کاربرد |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | آدرس پروژه |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | کلید عمومی Supabase |
| `SUPABASE_SECRET_KEY` | کلید محرمانهٔ سمت سرور |
| `SUPABASE_SERVICE_ROLE_KEY` | JWT قدیمی `service_role` برای امضای URLهای Storage؛ فقط سمت سرور |
| `SUPABASE_STORAGE_BUCKET` | نام bucket؛ اختیاری، پیش‌فرض `videos` |
| `CRON_SECRET` | رمز محافظ endpoint پاکسازی در Vercel |

کلید Google OAuth در تنظیمات Supabase وارد می‌شود و نیازی به env جداگانه در این برنامه ندارد.
