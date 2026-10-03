# Ratio

Ratio is a Persian, RTL video app built with Next.js 16, Supabase Auth and PostgreSQL, with UploadThing for video storage.

Uploads go directly from the browser to UploadThing. The app accepts MP4 files up to 50 MiB, verifies duration from MP4 metadata on the server, and automatically classifies clips up to 90 seconds as reels. UploadThing file URLs are public to anyone who has the link. The home feed, vertical reels feed, and long-video watch page are implemented. Bunny, HLS, and a transcoding worker are not part of the current implementation.

## Local Setup

- Node.js 22 or later is required.

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local` and fill in the Supabase values and `UPLOADTHING_TOKEN` from the UploadThing V7 API Keys page.
3. Apply the migrations in `supabase/migrations/` in filename order, including `0013_uploadthing.sql`.
4. Add the same server-only environment variables to Vercel, then redeploy after setting `UPLOADTHING_TOKEN`.
5. Run `npm test` to check upload validation and security-sensitive routes.
6. Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in a browser.

See [SETUP-CHECKLIST.md](SETUP-CHECKLIST.md) for provider and deployment setup, and [ARCHITECTURE.md](ARCHITECTURE.md) for the current upload and storage flow. Environment variable names are listed in `.env.example`.
