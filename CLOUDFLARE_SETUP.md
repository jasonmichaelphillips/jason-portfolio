# Cloudflare video pages setup

This project uses one Cloudflare Worker, one D1 database, and one Cron Trigger.
The Worker imports the latest videos from YouTube's public channel feed, stores
their metadata in D1, serves SEO-friendly `/videos/<slug>/` pages, and creates
automated topic pages, related-video links, video sitemap metadata, and
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

The scheduled handler performs the import after deployment.

The public endpoints will be:

```text
http://localhost:8787/
http://localhost:8787/api/videos
http://localhost:8787/sitemap.xml
http://localhost:8787/videos/<slug>/
http://localhost:8787/videos/
http://localhost:8787/topics/
http://localhost:8787/destinations/
http://localhost:8787/feed.xml
```

## 4. Populate the database automatically

After `YOUTUBE_API_KEY` is configured and deployed, the hourly Cron handler
imports the complete uploads playlist once, records the completion marker in
D1, and then syncs future uploads from the public feed. You can check:

```text
https://jasonmichaelphillips.com/api/videos
https://jasonmichaelphillips.com/sitemap.xml
```

### Optional: import the complete YouTube archive

The public channel feed is enough for the hourly automatic sync, but it only
contains recent uploads. To import the complete archive, enable YouTube Data
API v3 in a Google Cloud project, create an API key restricted to that API, and
store the key as a Cloudflare secret:

```bash
npx wrangler secret put YOUTUBE_API_KEY
```

After deploying, the next scheduled Worker run automatically follows the
channel's uploads playlist through every page of results. It records a
completion marker in D1, so the expensive archive import runs once; future
hourly runs use the free public feed for new uploads.

There is no public manual sync endpoint. This keeps the production Worker
surface smaller; scheduled imports and metadata enrichment run automatically.

## 5. Deploy

```bash
npx wrangler deploy
```

The Cron Trigger in `wrangler.toml` runs once per hour:

```toml
crons = ["0 * * * *"]
```

On its first run after `YOUTUBE_API_KEY` is configured, it imports the complete
uploads playlist. After that, it fetches YouTube's public feed and upserts the
latest video metadata into D1.

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

## Automated topic pages

The Worker classifies each video by matching its title and description against
the built-in topic vocabulary. No manual tagging is required. New videos are
automatically included when they match topics such as:

```text
/topics/hotel-reviews/
/topics/food-and-restaurants/
/topics/walking-tours/
/topics/travel-guides/
```

Each video page also receives topic links and automatically selected related
videos. The topic pages and video pages are included in the generated sitemap.

The homepage cards are also rendered by the Worker from D1 before the browser
JavaScript runs. This gives search engines readable internal links, titles,
dates, and descriptions while preserving the fast client-side featured player.

## Important notes

- The YouTube channel feed returns the most recent feed entries. For a large
  historical archive, run a one-time import using the YouTube Data API or add
  older videos to D1 manually.
- The public page route is cacheable for one hour. A new video may take up to
  one hour to sync, plus normal crawler discovery time.
- Do not commit Cloudflare API tokens or other secrets to the repository.
- Cloudflare Web Analytics is enabled from the Cloudflare dashboard rather than
  from this repository: open the site in **Web Analytics**, add the hostname,
  and copy the provided beacon snippet into the page if you want traffic and
  Core Web Vitals reporting.
