# چک‌لیست راه‌اندازی Ratio

## Supabase

- [ ] یک پروژهٔ Supabase بسازید و Project URL را ثبت کنید.
- [ ] Publishable key را برای `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` بگیرید.
- [ ] Secret key را فقط برای `SUPABASE_SECRET_KEY` سمت سرور نگه دارید؛ این کلید را در مرورگر یا Git نگذارید.
- [ ] migrationهای `0001` تا `0013` را به ترتیب نام روی دیتابیس اجرا کنید؛ `0013_uploadthing.sql` ستون‌های URL و کلید thumbnail را اضافه می‌کند.
- [ ] Google provider را در Authentication فعال کنید و callback ارائه‌شده توسط Supabase را در Google Cloud ثبت کنید.

## UploadThing

- [ ] در UploadThing یک app بسازید و از API Keys، تب V7، مقدار `UPLOADTHING_TOKEN` را بگیرید.
- [ ] `UPLOADTHING_TOKEN` را فقط در `.env.local` و Environment Variables سمت سرور Vercel قرار دهید؛ `UPLOADTHING_SECRET` و `UPLOADTHING_APP_ID` مربوط به V6 هستند.
- [ ] endpoint و حساب UploadThing باید برای ویدیوهای حداکثر ۵۰ MiB و thumbnailهای حداکثر ۱ MiB تنظیم شده باشند.
- [ ] فایل‌ها عمومی‌اند؛ هر کسی که URL را داشته باشد می‌تواند آن‌ها را ببیند.

## تنظیم محلی

- [ ] Node.js نسخهٔ 22 یا بالاتر نصب باشد.
- [ ] `.env.local` را بر اساس `.env.example` بسازید و مقادیر Supabase و UploadThing را وارد کنید.
- [ ] `npm install` و سپس `npm run dev` اجرا کنید.
- [ ] `npm test` را اجرا کنید؛ CI نیز lint، test و build را روی push و pull request اجرا می‌کند.
- [ ] تست‌ها باید MP4های دارای `moov` در ابتدا و انتهای فایل، classification در مرز ۹۰ ثانیه، pagination فید، UploadThing callbackها و عدم افزایش view هنگام retry را پوشش دهند.
- [ ] بررسی کنید فایل MP4 حداکثر 50 MiB پذیرفته و فایل بزرگ‌تر یا MIME دیگر رد شود؛ آپلود مستقیم با UploadThing انجام می‌شود.

## Vercel

- [ ] Repository را به Vercel متصل کنید.
- [ ] `NEXT_PUBLIC_SUPABASE_URL`، `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`، `SUPABASE_SECRET_KEY` و `UPLOADTHING_TOKEN` را در Environment Variables تنظیم کنید.
- [ ] پس از افزودن یا تغییر `UPLOADTHING_TOKEN`، پروژه را در Vercel redeploy کنید.
- [ ] در Supabase Auth → URL Configuration، Site URL را روی `https://raito-self.vercel.app` بگذارید و این callback را به Redirect URLs اضافه کنید: `https://raito-self.vercel.app/auth/callback`.
- [ ] پس از deploy، ورود Google، آپلود و پخش ویدیو را بررسی کنید.

## سقف فایل و پاکسازی

- سقف فعلی Ratio برابر 50 MiB است و در UI و callback سمت سرور اعمال می‌شود. برای فایل بزرگ‌تر، سقف UploadThing و `MAX_VIDEO_SIZE_BYTES` را هماهنگ تغییر دهید. پلن رایگان UploadThing سقف کلی 2 GiB دارد.
- محدودیت‌های قبلی ۲ آپلود هم‌زمان، ۱۰ شروع در ۲۴ ساعت و سهمیه‌های حجمی دیگر در برنامه اعمال نمی‌شوند.
- ویدیوهای قبلی به UploadThing منتقل نمی‌شوند؛ ردیف‌های بدون `video_url` در stream پاسخ ۴۰۴ می‌گیرند.
- حذف ویدیوهای آماده از `DELETE /api/videos/[id]` انجام می‌شود. شمارش view برای کاربران واردشده در endpoint پخش و حداکثر یک بار در ۲۴ ساعت برای هر ویدیو/کاربر افزایش می‌یابد.
- `duration_seconds` از ساختار MP4 سمت سرور استخراج می‌شود؛ فایل‌های تا ۹۰ ثانیه reel و فایل‌های طولانی‌تر long هستند. مقدار ارسالی مرورگر برای duration استفاده نمی‌شود.
- فید، صفحهٔ `/reels` و `/v/[id]` در کد هستند. URLهای UploadThing دائمی‌اند؛ Player refresh دوره‌ای ندارد و retry پس از خطا نباید view جدید بشمارد.

## متغیرهای محیطی

| نام | کاربرد |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | آدرس پروژه |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | کلید عمومی Supabase |
| `SUPABASE_SECRET_KEY` | کلید محرمانهٔ سمت سرور |
| `UPLOADTHING_TOKEN` | توکن V7 سمت سرور |

کلید Google OAuth در تنظیمات Supabase وارد می‌شود و نیازی به env جداگانه در این برنامه ندارد.
