# چک‌لیست راه‌اندازی — کارهایی که خود برنامه‌نویس باید انجام دهد

این سند لیست کارهای **غیرکدنویسی** است: ثبت‌نام، ساخت اکانت، گرفتن کلید و تنظیمات.
هر فاز را که تمام شد تیک بزن. مقادیر را در یک فایل `.env` (که هرگز در گیت پوش نمی‌شود) جمع کن.

---

## فاز ۰ — پیش‌نیازها (۵ دقیقه)

- [ ] اکانت **GitHub** (اگر نداری) — github.com
- [ ] اکانت **Vercel** با «Continue with GitHub» — vercel.com (پلن Hobby رایگان کافی است)
- [ ] اکانت **Supabase** با GitHub — supabase.com (پلن Free)
- [ ] اکانت **Cloudflare** — dash.cloudflare.com (پلن Free)
- [ ] نصب روی سیستم: **Node.js LTS**، **Git**، یک ادیتور

> هشدار مهم: Supabase پلن Free بعد از ~۱ هفته بی‌فعالیتی پروژه را **Pause** می‌کند.
> در طول توسعه مدام پروژه را باز کن و اگر pause شد یک جا Restore بزن.

---

## فاز ۱ — Supabase (پایگاه داده + احراز هویت) — ~۱۵ دقیقه

### ساخت پروژه
- [ ] داشبورد Supabase → **New Project** → اسم (مثلا `video-app`) → رمز دیتابیس قوی بساز و در جای امن ذخیره کن → Region نزدیک: `Frankfurt (eu-central-1)`
- [ ] ۲-۳ دقیقه صبر تا پروژه provision شود

### گرفتن کلیدها (Project Settings → API)
- [ ] **Project URL** — مثلا `https://xxxx.supabase.co`
- [ ] **anon public key** — کلید عمومیِ فرانت
- [ ] **service_role key** — ⚠️ فقط سمت سرور، هرگز در فرانت/گیت
- [ ] **Database Password** (همان موقع ساخت)

### تنظیم احراز هویت (Authentication → Providers)
- [ ] **Email**: فعال بگذار. برای تست، `Confirm email` را موقتا خاموش کن (تا مجبور نشوی هر بار ایمیل چک کنی)؛ قبل از انتشار حتما روشن کن
- [ ] **Google**: فعلا فعال نکن — اول باید مرحله فاز ۲ را انجام دهی، بعد با Client ID/Secret اینجا برمی‌گردی

### تنظیم Google OAuth در Supabase
- [ ] Authentication → Providers → Google → مقادیر Client ID و Client Secret (از فاز ۲) را وارد و فعال کن
- [ ] **Redirect URLs** (Authentication → URL Configuration):
  - `http://localhost:3000/**` برای توسعه
  - بعدا URL دامنه Vercel را هم اضافه کن

### دیتابیس و امنیت
- [ ] بعد از اینکه AI مایگریشن‌ها را نوشت: SQL Editor → اجرای migrations
- [ ] مطمئن شو **RLS روی همه جدول‌ها فعال است** (Database → Tables → آیکون قسب کنار هر جدول)
- [ ] یک کاربر تست بساز (Authentication → Add user) برای آزمایش

**خروجی این فاز برای `.env`:** `NEXT_PUBLIC_SUPABASE_URL`، `NEXT_PUBLIC_SUPABASE_ANON_KEY`، `SUPABASE_SERVICE_ROLE_KEY`

---

## فاز ۲ — Google OAuth (کلید گوگل) — ~۱۰ دقیقه

- [ ] برو به [console.cloud.google.com](https://console.cloud.google.com)
- [ ] بالای صفحه → **Select a project → New Project** → اسم: `video-app`
- [ ] منوی همبرگری → **APIs & Services → OAuth consent screen**:
  - User Type: **External** → نام اپ + ایمیل → Save
  - در حالت Testing، ایمیل خودت را به **Test users** اضافه کن (وگرنه لاگین گوگل خطا می‌دهد)
  - قبل از انتشار باید **Publish** کنی (آپلود لوگو و موارد Verification بعدا)
- [ ] **Credentials → Create Credentials → OAuth client ID**:
  - Application type: **Web application**
  - **Authorized JavaScript origins:**
    - `http://localhost:3000`
    - بعدا: `https://your-app.vercel.app`
  - **Authorized redirect URIs** (این را از خود Supabase کپی کن — Authentication → Providers → Google پایین صفحه لینک آماده می‌دهد):
    - `https://xxxx.supabase.co/auth/v1/callback`
- [ ] **Client ID** و **Client Secret** را بردار → به فاز ۱ (Supabase Providers) ببر

**خروجی این فاز:** فقط دو مقدار که جای نهایی‌شان Supabase است (در env پروژه لازم نیست).

---

## فاز ۳ — Cloudflare R2 (ذخیره ویدیوها) — ~۲۰ دقیقه

### فعال‌سازی و ساخت باکت
- [ ] داشبورد Cloudflare → منوی چپ **R2 Object Storage** → دکمه **Purchase R2** (کارت نمی‌خواهد؛ ۱۰GB رایگان در ماه است، فقط باید فعالش کنی)
- [ ] **Create bucket** → نام: `video-app-videos` → Region: خودکار / `WEUR`
- [ ] یک باکت دوم برای آواتارها: `video-app-avatars` → در تنظیماتش **Public access** را روشن کن (آواتار public است)

### تنظیمات باکت ویدیو (همیشه خصوصی!)
- [ ] باکت `videos` → Settings → **CORS Policy** → این JSON (origin را بعدا با دامنه اصلی کامل کن):

```json
[
  {
    "AllowedOrigins": ["http://localhost:3000", "https://your-app.vercel.app"],
    "AllowedMethods": ["PUT", "GET"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

### گرفتن کلیدهای S3
- [ ] R2 → **Manage R2 API Tokens** → **Create API Token**
  - Permissions: **Object Read & Write**
  - Specify bucket(s): فقط `video-app-videos`
- [ ] بردار: **Access Key ID**، **Secret Access Key**
- [ ] از صفحه اصلی R2 (سایدبار): **Account ID** را هم بردار (برای endpoint)

**خروجی این فاز برای `.env`:** `R2_ACCOUNT_ID`، `R2_ACCESS_KEY_ID`، `R2_SECRET_ACCESS_KEY`

---

## فاز ۴ — GitHub و Vercel (میزبانی کد و سایت) — ~۱۰ دقیقه

- [ ] یک **repo خالی** در GitHub بساز (مثلا `video-app`) — بدون README تا اولین push تمیز باشد
- [ ] اتصال Git محلی: `git init` + remote آدرس ریپو (AI این را انجام می‌دهد، فقط ریپو را بساز)
- [ ] **vercel.com → Add New → Project → Import** همان ریپو
- [ ] قبل از Deploy، در بخش **Environment Variables** همه متغیرهای `.env` را وارد کن
  (Supabase URL/Keys + R2 keys) — بعدا که worker آمد، به envهای Vercel اضافه می‌کنیم
- [ ] Deploy → گرفتن دامنه (مثل `video-app-xxxx.vercel.app`)
- [ ] برگرد به **Supabase** (URL Configuration) و **Google Console** (origins) و این دامنه را اضافه کن
- [ ] در **Cloudflare R2 → CORS** هم origin دامنه اصلی را جایگزین/اضافه کن
- [ ] در Vercel فعال کن: هر push به branch `main` → deploy خودکار (پیش‌فرض همین است)

**خروجی این فاز:** سایت زنده + دامنه که همه‌جا باید ثبت شود.

---

## فاز ۵ — سرور ترنسکد (VPS) — ~۳۰ دقیقه — بعد از فاز ۲ ساخت

> وقتی AI فایل‌های Docker/worker را نوشت، این فاز را انجام بده. تا آن موقع سایت بدون ترنسکد کار نمی‌کند (ویدیو در حالت processing می‌ماند).

- [ ] VPS ارزان بگیر — پیشنهاد: **Hetzner Cloud CX22** (~۴-۵€/ماه، ۲ vCPU/4GB — FFmpeg به رم و CPU نیاز دارد، از CX11 کوچک‌تر نگیر). جایگزین: Contabo
- [ ] Ubuntu 24.04 انتخاب کن + کلید SSH خودت را اضافه کن
- [ ] اتصال اولیه و آپدیت: `ssh root@IP` → `apt update && apt upgrade`
- [ ] نصب Docker: اسکریپت رسمی `curl -fsSL https://get.docker.com | sh`
- [ ] فایل‌های worker (docker-compose و .env که AI نوشته) را با scp/گیت به سرور ببر
- [ ] در env سرور این‌ها لازم است: کلیدهای R2 + Supabase URL + service_role key
- [ ] `docker compose up -d` → لاگ بگیر: `docker compose logs -f` — باید ببینی worker آماده و منتظر است
- [ ] یک ویدیوی تست آپلود کن و چک کن در R2 پوشه HLS ساخته شود و `status` به `ready` تغییر کند

---

## فاز ۶ — جمع‌بندی و نگه‌داری — پیوسته

- [ ] فایل `.env` محلی را کامل کن (AI فرمتش را می‌سازد؛ تو مقادیر را می‌ریزی)
- [ ] اطمینان: `.env` و `.env.local` در `.gitignore` هستند
- [ ] رمزها و کلیدها را در یک Password Manager یا فایل امن خارج از پروژه نگه دار
- [ ] قبل از انتشار عمومی: روشن کردن Confirm email در Supabase + Publish کردن OAuth consent screen گوگل + ویدریافت دامنه شخصی (اختیاری، ~۱۰$/سال از Cloudflare Registrar)

---

## خلاصه‌ی جدول کلیدها

| متغیر env | از کجا | کجا استفاده می‌شود |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API | فرانت + سرور |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API | فرانت + سرور |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API | فقط سرور (Vercel + VPS) |
| `R2_ACCOUNT_ID` | داشبورد R2 | فقط سرور |
| `R2_ACCESS_KEY_ID` | R2 API Token | فقط سرور |
| `R2_SECRET_ACCESS_KEY` | R2 API Token | فقط سرور |
| Google Client ID/Secret | Google Cloud Console | داخل خود Supabase وارد می‌شود |
