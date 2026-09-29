# Ratio

Ratio is a Persian, RTL video app built with Next.js 16, Supabase Auth, PostgreSQL, and private Supabase Storage.

Uploads use signed `PUT` URLs directly to Supabase Storage. The app accepts MP4 files up to 50 MiB, reads duration from MP4 metadata, and automatically classifies clips up to 90 seconds as reels. The home feed, vertical reels feed, long-video watch page, and signed URL renewal are implemented. Bunny, HLS, and a transcoding worker are not part of the current implementation.

## Local Setup

- Node.js 22 or later is required.

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local` and fill in the Supabase values.
3. Apply the migrations in `supabase/migrations/` in filename order.
4. Set a private `CRON_SECRET` in Vercel to enable scheduled abandoned-upload cleanup.
5. Run `npm test` to check upload validation and security-sensitive routes.
6. Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in a browser.

See [SETUP-CHECKLIST.md](SETUP-CHECKLIST.md) for provider and deployment setup, and [ARCHITECTURE.md](ARCHITECTURE.md) for the current upload and storage flow. Environment variable names are listed in `.env.example`.
