# معماری کامل پروژه — شبکه اجتماعی ویدیویی (مثل اینستاگرام)

Stack: **Next.js (App Router) + React + CSS Modules + Supabase (Postgres/Auth) + Dosya.dev S3-compatible storage**

> **وضعیت فعلی:** ویدیو در Dosya.dev با S3-compatible API ذخیره می‌شود و پخش با `<video>` بومی و URL امضاشده است. فایل از مرورگر مستقیم به storage می‌رود؛ بایت‌های ویدیو از Vercel عبور نمی‌کنند. ترنسکد/HLS فعلاً غیرفعال است.

---

## ۱. نمای کلی سیستم

```
                    ┌──────────────────────────┐
   کاربر ──────────▶│   Next.js روی Vercel     │
                    │  (UI + API Routes)       │
                    └──────┬───────────┬───────┘
                           │           │
              لینک‌ها/دیتا │           │ Presigned URL
                           ▼           ▼
              ┌────────────────┐   ┌────────────────────┐
              │    Supabase    │   │     Dosya.dev     │◀── آپلود مستقیم
              │ ────────────── │   │  (فایل‌های ویدیو)  │    کاربر (بدون Vercel)
              │ PostgreSQL     │   └─────────┬──────────┘
              │ Auth           │             │ Storage API
              │ Realtime (کامنت/لایک)        ▼
              └────────────────┘   ┌────────────────────┐
                                   │  Transcoder Worker │
                                   │  (VPS + FFmpeg)    │
                                   │  HLS چندکیفیتی     │
                                   └─────────┬──────────┘
                                             │ آپلود خروجی HLS
                                             ▼
                                          Dosya.dev
```

**اصل طلایی:** Vercel فقط «هماهنگ‌کننده» است. هیچ بایت ویدیویی از Vercel رد نمی‌شود.

---

## ۲. ساختار پوشه‌ها (Next.js App Router)

```
video-app/
├── app/
│   ├── (auth)/                    # Route Group صفحات احراز هویت
│   │   ├── login/page.tsx
│   │   ├── signup/page.tsx
│   │   └── layout.tsx             # لایه‌ی مینیمال بدون نوار بالا
│   ├── (main)/                    # Route Group با Navbar مشترک
│   │   ├── layout.tsx
│   │   ├── page.tsx               # فید اصلی (خانه)
│   │   ├── reels/page.tsx         # ویدیوهای کوتاه (تمام‌صفحه عمودی)
│   │   ├── watch/[id]/page.tsx    # ویدیوی بلند + کامنت‌ها
│   │   ├── upload/page.tsx        # آپلود ویدیو/استوری
│   │   ├── u/[username]/page.tsx  # پروفایل کاربر
│   │   ├── settings/page.tsx      # ویرایش پروفایل
│   │   └── tag/[name]/page.tsx    # (بعداً) صفحه هشتگ
│   ├── api/
│   │   ├── upload-url/route.ts        # POST → Presigned URL
│   │   ├── upload-complete/route.ts   # POST → ثبت ویدیو با status=processing
│   │   ├── videos/route.ts            # GET فید + POST فراداده
│   │   ├── videos/[id]/comments/route.ts
│   │   ├── videos/[id]/like/route.ts
│   │   ├── follow/route.ts            # POST/DELETE فالو
│   │   └── stories/route.ts
│   ├── layout.tsx
│   └── globals.css                # توکن‌های طراحی (متغیرهای CSS)
├── components/
│   ├── video/
│   │   ├── VideoPlayer/           # پلیر hls.js — قلب پروژه
│   │   │   ├── VideoPlayer.tsx
│   │   │   └── VideoPlayer.module.css
│   │   ├── FeedVideoCard.tsx      # کارت ویدیو در فید
│   │   ├── ReelsPlayer.tsx        # پلیر تمام‌صفحه با اسکرول عمودی
│   │   └── LikeButton.tsx / CommentSection.tsx
│   ├── stories/
│   │   ├── StoryBar.tsx           # ردیف دایره‌های استوری بالای فید
│   │   └── StoryViewer.tsx        # نمایشگر تمام‌صفحه با progress bar
│   ├── profile/
│   │   ├── ProfileHeader.tsx      # آواتار، آمار، دکمه فالو
│   │   ├── FollowButton.tsx
│   │   └── VideoGrid.tsx          # گرید ۳ ستونه ویدیوها (مثل اینستا)
│   ├── layout/
│   │   ├── Navbar.tsx             # نوار بالا (دسکتاپ) / نوار پایین (موبایل)
│   │   └── AuthGuard.tsx
│   └── ui/
│       ├── Avatar.tsx / Button.tsx / Modal.tsx / Spinner.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts              # کلاینت مرورگر
│   │   ├── server.ts              # کلاینت سمت سرور (با کوکی)
│   │   └── middleware.ts          # رفرش توکن + محافظت از مسیرها
│   ├── dosya.ts                   # ساخت Presigned URL (فقط سمت سرور)
│   ├── queries.ts                 # کوئری‌های پرکاربرد دیتابیس
│   └── utils.ts
├── hooks/
│   ├── useVideoFeed.ts            # صفحه‌بندی بی‌نهایت (Infinite scroll)
│   ├── useStories.ts
│   └── useUpload.ts               # منطق آپلود multipart + پیشرفت
├── types/                          # تایپ‌های TypeScript از روی اسکیما
└── supabase/
    └── migrations/                 # مایگریشن‌های SQL
```

---

## ۳. صفحات و اجزای UI

### ۳.۱. فید اصلی `/` (خانه)
- **StoryBar**: دایره‌های استوری (آواتار با حلقه گرادیان) — اسکرول افقی
- **فید ترکیبی**: ویدیوهای بلند و کوتاه کاربرانی که فالو کرده‌ای، مرتب بر اساس زمان + محبوبیت
- **FeedVideoCard**: آواتار + نام کاربر، پلیر، دکمه‌های لایک/کامنت/ذخیره، کپشن، تعداد بازدید
- **صفحه‌بندی**: Infinite scroll با `IntersectionObserver` (هر بار ۱۰ آیتم)

### ۳.۲. ریلز `/reels`
- پلیر **تمام‌صفحه عمودی** با CSS `scroll-snap` (هر اسکرول = یک ویدیو)
- فقط ویدیوهایی که `type = 'reel'` و `duration <= 90s`
- **بهینه‌سازی مهم**: با `IntersectionObserver` فقط ویدیوی درون viewport پخش می‌شود، بقیه `pause()` می‌شوند. یکی قبل و یکی بعد را preload می‌کنیم.
- دکمه‌های شناور کنار: لایک، کامنت، اشتراک، آواتار (لینک به پروفایل)

### ۳.۳. تماشای ویدیوی بلند `/watch/[id]`
- پلیر بزرگ (16:9) با **کنترل‌های سفارشی**: seek bar، تغییر کیفیت (انتخاب رندر از master.m3u8)، سرعت، تمام‌صفحه، صدا
- زیرش: اطلاعات، کپشن، لایک، و **CommentSection** با پاسخ‌دهی (nested comments تک‌سطحی)
- ستون کناری (دسکتاپ): «ویدیوهای مرتبط» از همان کاربر

### ۳.۴. استوری
- **StoryBar** بالای فید: فقط کاربران فالوشده با استوریِ فعال (`expires_at > now()`)
- **StoryViewer**: مودال تمام‌صفحه — progress bar بالای صفحه، خودکار به استوری بعدی می‌رود (با setTimeout بر اساس طول مدیا)، سوایپ/کلیک چپ‌وراست، متادیتای بازدید
- استوری ۲۴ ساعته است؛ برای ویدیوی استوری از همان پلیر HLS استفاده می‌کنیم (فایل‌های کوتاه)

### ۳.۵. پروفایل `/u/[username]`
- **ProfileHeader**: آواتار بزرگ، نام، بیو، تعداد پست‌ها/فالوور/فالووینگ، دکمه Follow/Unfollow یا Edit Profile
- **تب‌ها**: ویدیوها (گرید) | ریلز | تگ‌شده‌ها (بعداً)
- **VideoGrid**: گرید ۳ ستونه با بندانگشتی (thumbnail که worker از ویدیو استخراج می‌کند)، آیکون play + تعداد بازدید روی هاور
- URL های پروفایل با `/u/username` — username یکتا و immutable است، آیدی UUID هرگز در URL نمی‌آید

### ۳.۶. آپلود `/upload` (فقط کاربر لاگین‌شده)
مراحل در یک صفحه (فرم چندمرحله‌ای):
1. انتخاب فایل + پیش‌نمایش محلی (`URL.createObjectURL`)
2. انتخاب نوع (ویدیوی بلند / ریلز / استوری) + کپشن + thumbnail (از فریم‌های ویدیو یا آپلود دستی)
3. آپلود با نوار پیشرفت واقعی (از روی رویداد آپلود multipart)
4. صفحه «در حال پردازش» — polling وضعیت از دیتابیس تا `status='ready'`

---

## ۴. پلیر — قلب پروژه (`VideoPlayer`)

```
VideoPlayer (Client Component)
├── hls.js برای هر مرورگر (Safari بومی HLS دارد)
├── وضعیت‌های داخلی: idle → loading → playing / paused / buffering / error
├── کنترل‌ها (auto-hide بعد از ۳ ثانیه بی‌حرکتی):
│   ├── play/pause  ├── seek bar با بافر نمایش‌داده‌شده
│   ├── volume  ├── منوی کیفیت (Auto/1080/720/480 — از levels خود hls.js)
│   ├── speed  └── fullscreen
└── رویدادها: هر ۱۰ ثانیه یک beacon بازدید به API
```

نکات:
- **لینک پخش signed و کوتاه‌مدت است**: `GET /api/stream/[id]` مسیر master.m3u8 را با signed URL یک‌ساعته برمی‌گرداند — باکر خصوصی می‌ماند.
- در فید، پلیرها **mute** شروع می‌شوند (policy مرورگرها) و با کلیک صدا وصل می‌شود.
- `playsInline` برای موبایل، `preload="metadata"` برای صرفه‌جویی.

---

## ۵. جریان آپلود (بدون عبور از Vercel)

```
1. کلاینت → POST /api/upload-url {size, contentType, type}
  سرور: احراز هویت + ساخت کلید فایل و URL امضاشده از Dosya.dev
  ← برمی‌گرداند: { videoId, uploadUrl, thumbUploadUrl }

2. کلاینت: فایل را با PUT مستقیم به Dosya.dev می‌فرستد
  (رویداد progress واقعی → نوار پیشرفت)

3. کلاینت → POST /api/upload/complete {videoId, duration}
  سرور: بررسی وجود فایل در Dosya.dev + تغییر status به 'ready'

4. کلاینت پیش از اتمام آپلود duration و thumbnail را استخراج می‌کند؛ thumbnail نیز
  جداگانه با URL امضاشده به Dosya.dev ارسال می‌شود.

5. کلاینت صفحه آپلود: هر ۳ ثانیه GET /api/videos/[id] → وقتی ready شد، تمام
```

برای استوری‌ها و فایل‌های خیلی کوچک (زیر ~۵۰MB) همان PUT تکی ساده کافی است.

---

## ۶. دیتابیس (Supabase — Postgres)

```sql
profiles (
  id uuid PK ← auth.users(id) ON DELETE CASCADE,
  username text UNIQUE NOT NULL,  display_name text,
  avatar_url text,  bio text,
  created_at timestamptz DEFAULT now()
)

videos (
  id uuid PK DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL → profiles(id),
  type text CHECK (type IN ('reel','long','story')),
  storage_key text NOT NULL,         -- کلید فایل اصلی در Dosya.dev
  hls_path text,                     -- مسیر master.m3u8 پس از پردازش
  thumbnail_url text,  duration_seconds int,
  caption text,  status text DEFAULT 'processing' CHECK (status IN ('processing','ready','failed')),
  views_count int DEFAULT 0,
  created_at timestamptz DEFAULT now()
)
-- ایندکس‌ها: (user_id, created_at DESC)، (status)، partial index برای type

follows (
  follower_id uuid → profiles(id),
  following_id uuid → profiles(id),
  created_at timestamptz DEFAULT now(),
  PK (follower_id, following_id),
  CHECK (follower_id <> following_id)
)

likes (
  user_id uuid → profiles(id),
  video_id uuid → videos(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PK (user_id, video_id)
)

comments (
  id uuid PK DEFAULT gen_random_uuid(),
  video_id uuid → videos(id) ON DELETE CASCADE,
  user_id uuid → profiles(id),
  parent_id uuid → comments(id),     -- پاسخ تک‌سطحی
  body text NOT NULL CHECK (length(body) <= 1000),
  created_at timestamptz DEFAULT now()
)

stories (
  id uuid PK DEFAULT gen_random_uuid(),
  user_id uuid → profiles(id),
  storage_key text NOT NULL,  media_type text CHECK (media_type IN ('image','video')),
  hls_path text,  duration_seconds int,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '24 hours',
  created_at timestamptz DEFAULT now()
)

story_views (
  story_id uuid → stories(id) ON DELETE CASCADE,
  viewer_id uuid → profiles(id),
  viewed_at timestamptz DEFAULT now(),
  PK (story_id, viewer_id)
)
```

### شمارنده‌ها (لایک/بازدید/فالوور)
- **لایک و فالو**: با `COUNT` از جدول حساب می‌شود (پیکربندی کم است، ایندکس دارد). برای ویدیوهای خیلی پرترافیک بعداً به Counter cache مهاجرت می‌کنیم.
- **بازدید**: افزایش با یک RPC اتمی (`views_count = views_count + 1`) — آپدیت مستقیم فیلد از کلاینت ممنوع.

### RLS (Row Level Security) — جدول‌ها بدون RLS نمی‌مانند
- `profiles`: SELECT برای همه، UPDATE فقط رکورد خودش
- `videos`: INSERT فقط خود کاربر (`auth.uid() = user_id`)، UPDATE فقط فیلدهای متادیتا و فقط مالک، SELECT فقط `status='ready'` یا مالک
- `follows / likes / comments`: INSERT فقط خود کاربر، DELETE فقط خودش، SELECT برای همه
- `stories`: SELECT فقط `expires_at > now()` (یا مالک)

---

## ۷. احراز هویت (Supabase Auth)

- **روش‌ها**: ایمیل/رمز + ایمیل تایید، OAuth گوگل، (اختیاری) مسیج Reset password
- `@supabase/ssr` + middleware در `lib/supabase/middleware.ts` — رفرش خودکار توکن روی هر درخواست
- **مسیرهای محافظت‌شده** (در middleware): `/upload`، `/settings` → ریدایرکت به `/login?next=...`
- **جریان ثبت‌نام**: signup → تایید ایمیل → صفحه تکمیل پروفایل (username یکتا + نام + آواتار) → ورود به فید. تا وقتی پروفایل کامل نشده، بقیه سایت قفل است.
- آواتار در Supabase Storage ذخیره می‌شود (public bucket، سقف ۲MB).

---

## ۸. استراتژی CSS

- **CSS Modules** برای همه کامپوننت‌ها (`Component.module.css`) — ایزوله، بدون تداخل، بدون کتابخانه اضافه (همان CSS خام)
- `globals.css` فقط شامل:
  - **Design tokens** (متغیرهای CSS): رنگ‌ها، فاصله‌ها، شعاع گردی، سایه‌ها، تایپوگرافی
  - Reset ساده و استایل پایه
- تم تیره به‌صورت پیش‌فرض (مثل اینستاگرام/یوتیوب شب) + تم روشن با `:root[data-theme='light']`
- **Mobile-first**: همه استایل‌ها از موبایل شروع می‌شوند و با media query به دسکتاپ می‌روند
- Navbar: در موبایل **تب‌بار پایین** (خانه/ریلز/آپلود/پروفایل)، در دسکتاپ نوار بالا

نمونه توکن‌ها:

```css
:root {
  --bg: #0a0a0a;          --surface: #161616;
  --border: #2a2a2a;      --text: #f5f5f5;      --text-muted: #8a8a8a;
  --accent: #ff2d55;      --accent-gradient: linear-gradient(45deg, #f09433, #dc2743, #bc1888);
  --radius: 12px;  --radius-full: 9999px;
  --space-1: 4px;  --space-2: 8px;  --space-3: 16px;  --space-4: 24px;  --space-5: 32px;
}
```

---

## ۹. مدیریت داده در React

- **Server Components** برای صفحه اول: پروفایل، ویدیوی بلند، فید اولیه — دیتا مستقیم از Supabase سمت سرور (سریع، بدون waterfall)
- **Client Components** فقط برای بخش‌های تعاملی: پلیر، دکمه لایک (optimistic update)، کامنت‌ها، آپلود، استوری‌ویوور
- **Infinite scroll** با یک هوک ساده (`useVideoFeed`) + `IntersectionObserver` — بدون Redux/Zustand/React Query برای شروع؛ پیچیدگی وقتی اضافه می‌شود که واقعا لازم شود
- **Optimistic UI** برای لایک و فالو (اول UI عوض می‌شود، بعد درخواست؛ در خطا rollback)

---

## ۱۰. Transcoder Worker (جدا از Next.js)

- یک repo/سرویس جداگانه، Node.js + Docker روی VPS ارزان (Hetzner CX22 مثلا)
- منطق آینده: حلقه‌ای که رکوردهای `status='processing'` را از Supabase برمی‌دارد → دانلود فایل از Dosya.dev → FFmpeg (HLS سه‌کیفیتی + thumbnail) → آپلود خروجی → آپدیت رکورد به `ready`
- راه‌اندازی با `docker compose up` — شامل FFmpeg image
- آینده: شکست‌ها → `status='failed'` + رکورد خطا برای retry

---

## ۱۱. اولویت ساخت (Milestones)

| فاز | تحویل |
|---|---|
| **۱** | Setup: Next.js + Supabase + Auth (ایمیل/گوگل) + جداول + RLS + صفحه پروفایل |
| **۲** | آپلود: Presigned URL + multipart + جدول videos + Worker ترنسکد |
| **۳** | پخش: VideoPlayer با hls.js + صفحه watch + thumbnails |
| **۴** | فید + ریلز با scroll-snap + لایک و کامنت |
| **۵** | استوری (StoryBar + StoryViewer + انقضای ۲۴ ساعته) |
| **۶** | پروفایل کامل + فالو/فالوور + فید مبتنی بر فالو |
| **۷** | پرداخت: جستجو، هشتگ، اعلان‌ها (Realtime Supabase)، DM (بعداً) |
