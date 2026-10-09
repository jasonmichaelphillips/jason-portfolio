# Cloudflare video pages setup

This project uses one Cloudflare Worker, one D1 database, and one Cron Trigger.
The Worker imports the latest videos from YouTube's public channel feed, stores
their metadata in D1, serves SEO-friendly `/videos/<slug>/` pages, and creates
`/sitemap.xml` automatically.

## 1. Install Wrangler

From the project directory:

```bash
npm install --save-dev wrangler
npx wrangler login
```

The login command opens Cloudflare authorization in your browser.

## 2. Create the D1 database

Run:

```bash
npx wrangler d1 create jason-videos
```

Copy the returned `database_id` into `wrangler.toml`, replacing:

```toml
database_id = "REPLACE_WITH_YOUR_D1_DATABASE_ID"
```

Create the table remotely:

```bash
npx wrangler d1 execute jason-videos --remote --file=cloudflare/schema.sql
```

## 3. Test the first sync locally

Run:

```bash
npx wrangler dev
```

In a second terminal, run the local sync endpoint only if you configured a
local `SYNC_TOKEN`; otherwise use the scheduled handler after deployment.

The public endpoints will be:

```text
http://localhost:8787/
http://localhost:8787/api/videos
http://localhost:8787/sitemap.xml
http://localhost:8787/videos/<slug>/
```

## 4. Populate the database once

Create a secret used only for the manual sync endpoint:

```bash
npx wrangler secret put SYNC_TOKEN
```

Enter a long random value when prompted. After deployment, run:

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_SYNC_TOKEN" \
  https://jasonmichaelphillips.com/api/sync
```

The response should report the number of videos imported. You can then check:

```text
https://jasonmichaelphillips.com/api/videos
https://jasonmichaelphillips.com/sitemap.xml
```

## 5. Deploy

```bash
npx wrangler deploy
```

The Cron Trigger in `wrangler.toml` runs once per hour:

```toml
crons = ["0 * * * *"]
```

It fetches YouTube's public feed and upserts the latest video metadata into D1.

## 6. Connect your domain

In Cloudflare Dashboard:

1. Open **Workers & Pages**.
2. Open the `jason-portfolio` Worker.
3. Choose **Settings → Domains & Routes**.
4. Add `jasonmichaelphillips.com` as a custom domain.

The Worker will serve your existing static assets plus dynamic video pages.

## 7. Submit the sitemap

After deployment, confirm this URL works:

```text
https://jasonmichaelphillips.com/sitemap.xml
```

Submit that URL in Google Search Console. Every video stored in D1 will appear
in the generated sitemap.

## How new pages are created

No HTML file is manually created. The hourly Cron Trigger discovers a new
YouTube entry, creates a stable slug such as:

```text
/videos/bangkok-street-food-tour-abc123/
```

When a crawler or visitor requests that URL, the Worker renders the complete
HTML page from D1, including the title, description, YouTube embed, canonical
URL, Open Graph tags, and `VideoObject` structured data.

## Important notes

- The YouTube channel feed returns the most recent feed entries. For a large
  historical archive, run a one-time import using the YouTube Data API or add
  older videos to D1 manually.
- The public page route is cacheable for one hour. A new video may take up to
  one hour to sync, plus normal crawler discovery time.
- Do not commit Cloudflare API tokens or other secrets to the repository.
