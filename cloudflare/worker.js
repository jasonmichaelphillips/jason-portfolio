const DEFAULT_CHANNEL_ID = "UCgR5VYHYy-u_HIiimcYQOMA";
const SITE_URL = "https://jasonmichaelphillips.com";
const TOPICS = [
  {
    slug: "hotel-reviews",
    name: "Hotel Reviews",
    description: "Hotel reviews, room tours, accommodation guides, and places to stay while traveling.",
    keywords: ["hotel", "resort", "room tour", "room review", "accommodation", "residence"],
  },
  {
    slug: "food-and-restaurants",
    name: "Food & Restaurants",
    description: "Restaurant visits, local food, street food, meals, markets, and food discoveries.",
    keywords: ["food", "restaurant", "burger", "meal", "cafe", "café", "shabushi", "sticky rice", "market"],
  },
  {
    slug: "walking-tours",
    name: "Walking Tours",
    description: "Walking tours, city explorations, night markets, train stations, and street-level travel.",
    keywords: ["walking tour", "walking", "skywalk", "night market", "train station", "street tour", "city tour"],
  },
  {
    slug: "travel-guides",
    name: "Travel Guides",
    description: "Practical travel guides, destination ideas, things to do, and cultural experiences.",
    keywords: ["travel guide", "things to do", "guide", "travel", "tourist", "explore", "cultural"],
  },
];

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/sitemap.xml") {
      return sitemapResponse(env);
    }

    if (url.pathname === "/api/videos") {
      return apiVideosResponse(env);
    }

    if (url.pathname === "/topics" || url.pathname === "/topics/") {
      return topicIndexResponse(env);
    }

    if (url.pathname === "/api/sync" && request.method === "POST") {
      if (!env.SYNC_TOKEN || request.headers.get("Authorization") !== `Bearer ${env.SYNC_TOKEN}`) {
        return json({ error: "Unauthorized" }, 401);
      }

      const count = await syncVideos(env);
      return json({ ok: true, synced: count });
    }

    if (url.pathname.startsWith("/videos/")) {
      return videoPageResponse(env, url.pathname);
    }

    if (url.pathname.startsWith("/topics/")) {
      return topicPageResponse(env, url.pathname);
    }

    return env.ASSETS.fetch(request);
  },

  async scheduled(controller, env, ctx) {
    ctx.waitUntil(syncVideos(env));
  },
};

async function syncVideos(env) {
  const channelId = env.YOUTUBE_CHANNEL_ID || DEFAULT_CHANNEL_ID;
  const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`;
  const response = await fetch(feedUrl, {
    headers: { "User-Agent": "jasonmichaelphillips.com video indexer" },
  });

  if (!response.ok) {
    throw new Error(`YouTube feed returned ${response.status}`);
  }

  const xml = await response.text();
  const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map((match) => match[1]);
  let synced = 0;

  for (const entry of entries) {
    const videoId = textFromXml(entry, "yt:videoId");
    const title = textFromXml(entry, "title");
    const description = textFromXml(entry, "media:description") || "Watch the latest travel and food video from Jason Michael Phillips.";
    const publishedAt = textFromXml(entry, "published") || new Date().toISOString();
    const thumbnailMatch = entry.match(/<media:thumbnail[^>]+url="([^"]+)"/);

    if (!videoId || !title) continue;

    const slug = `${slugify(title)}-${videoId.toLowerCase()}`;
    const thumbnailUrl = thumbnailMatch?.[1] || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

    await env.DB.prepare(`
      INSERT INTO videos (id, slug, title, description, thumbnail_url, published_at, youtube_url, embed_url, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        slug = excluded.slug,
        title = excluded.title,
        description = excluded.description,
        thumbnail_url = excluded.thumbnail_url,
        published_at = excluded.published_at,
        youtube_url = excluded.youtube_url,
        embed_url = excluded.embed_url,
        updated_at = CASE
          WHEN videos.title <> excluded.title
            OR videos.description <> excluded.description
            OR videos.thumbnail_url <> excluded.thumbnail_url
            OR videos.published_at <> excluded.published_at
          THEN excluded.updated_at
          ELSE videos.updated_at
        END
    `).bind(
      videoId,
      slug,
      title,
      description,
      thumbnailUrl,
      publishedAt,
      `https://www.youtube.com/watch?v=${videoId}`,
      `https://www.youtube.com/embed/${videoId}`,
      new Date().toISOString(),
    ).run();

    synced += 1;
  }

  return synced;
}

async function videoPageResponse(env, pathname) {
  const slug = decodeURIComponent(pathname.replace(/^\/videos\//, "").replace(/\/$/, ""));

  if (!slug) return new Response("Not found", { status: 404 });

  const video = await env.DB.prepare("SELECT * FROM videos WHERE slug = ? LIMIT 1").bind(slug).first();
  if (!video) return notFoundResponse();

  const related = await getRelatedVideos(env, video);
  const html = renderVideoPage(video, related);
  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=UTF-8",
      "cache-control": "public, max-age=300, s-maxage=3600",
    },
  });
}

async function apiVideosResponse(env) {
  const result = await env.DB.prepare(`
    SELECT id, slug, title, description, thumbnail_url, published_at, youtube_url, embed_url
    FROM videos
    ORDER BY published_at DESC
    LIMIT 100
  `).all();

  return json({ items: result.results || [] });
}

async function topicIndexResponse(env) {
  const videos = await getAllVideos(env);
  const activeTopics = TOPICS.filter((topic) => videos.some((video) => matchesTopic(video, topic)));
  return htmlResponse(renderTopicIndex(activeTopics));
}

async function topicPageResponse(env, pathname) {
  const slug = decodeURIComponent(pathname.replace(/^\/topics\//, "").replace(/\/$/, ""));
  const topic = TOPICS.find((item) => item.slug === slug);
  if (!topic) return notFoundResponse();

  const videos = (await getAllVideos(env)).filter((video) => matchesTopic(video, topic));
  if (videos.length === 0) return notFoundResponse();
  return htmlResponse(renderTopicPage(topic, videos));
}

async function getAllVideos(env) {
  const result = await env.DB.prepare(`
    SELECT id, slug, title, description, thumbnail_url, published_at, youtube_url, embed_url
    FROM videos
    ORDER BY published_at DESC
    LIMIT 100
  `).all();
  return result.results || [];
}

async function getRelatedVideos(env, video) {
  const allVideos = await getAllVideos(env);
  const topics = TOPICS.filter((topic) => matchesTopic(video, topic));
  return allVideos
    .filter((candidate) => candidate.id !== video.id)
    .map((candidate) => ({ video: candidate, score: topics.filter((topic) => matchesTopic(candidate, topic)).length }))
    .sort((a, b) => b.score - a.score || new Date(b.video.published_at) - new Date(a.video.published_at))
    .slice(0, 4)
    .map((item) => item.video);
}

function matchesTopic(video, topic) {
  const content = `${video.title} ${video.description}`.toLowerCase();
  return topic.keywords.some((keyword) => content.includes(keyword));
}

async function sitemapResponse(env) {
  const videos = await getAllVideos(env);
  const activeTopics = TOPICS.filter((topic) => videos.some((video) => matchesTopic(video, topic)));
  const urls = [
    `<url><loc>${SITE_URL}/</loc></url>`,
    `<url><loc>${SITE_URL}/topics/</loc></url>`,
    ...activeTopics.map((topic) => `<url><loc>${SITE_URL}/topics/${topic.slug}/</loc></url>`),
    ...videos.map((video) => videoSitemapEntry(video)),
  ];

  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">${urls.join("")}</urlset>`, {
    headers: {
      "content-type": "application/xml; charset=UTF-8",
      "cache-control": "public, max-age=300, s-maxage=3600",
    },
  });
}

function videoSitemapEntry(video) {
  const title = escapeXml(video.title);
  const description = escapeXml(truncate(stripHtml(video.description), 2048));
  return [
    "<url>",
    `<loc>${SITE_URL}/videos/${encodeURIComponent(video.slug)}/</loc>`,
    `<lastmod>${new Date(video.published_at).toISOString()}</lastmod>`,
    "<video:video>",
    `<video:thumbnail_loc>${escapeXml(video.thumbnail_url)}</video:thumbnail_loc>`,
    `<video:title>${title}</video:title>`,
    `<video:description>${description}</video:description>`,
    `<video:player_loc allow_embed="yes">${escapeXml(video.embed_url)}</video:player_loc>`,
    `<video:publication_date>${new Date(video.published_at).toISOString()}</video:publication_date>`,
    "</video:video>",
    "</url>",
  ].join("");
}

function renderVideoPage(video, related) {
  const canonical = `${SITE_URL}/videos/${encodeURIComponent(video.slug)}/`;
  const description = truncate(stripHtml(video.description), 160);
  const publishedDate = new Date(video.published_at).toISOString();
  const matchingTopics = TOPICS.filter((topic) => matchesTopic(video, topic));
  const schema = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: video.title,
    description,
    thumbnailUrl: [video.thumbnail_url],
    uploadDate: publishedDate,
    embedUrl: video.embed_url,
    contentUrl: video.youtube_url,
    mainEntityOfPage: canonical,
    author: {
      "@type": "Person",
      name: "Jason Michael Phillips",
      url: SITE_URL,
    },
    publisher: {
      "@type": "Person",
      name: "Jason Michael Phillips",
      url: SITE_URL,
    },
  };

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(video.title)} | Jason Michael Phillips</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${canonical}">
  <meta property="og:type" content="video.other">
  <meta property="og:title" content="${escapeHtml(video.title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:image" content="${escapeHtml(video.thumbnail_url)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(video.title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${escapeHtml(video.thumbnail_url)}">
  <link rel="stylesheet" href="/style.css">
  <script type="application/ld+json">${JSON.stringify(schema).replace(/</g, "\\u003c")}</script>
</head>
<body class="video-page">
  <header class="site-header">
    <a class="site-logo" href="/">Jason Michael Phillips</a>
    <a class="back-link" href="/">All videos</a>
  </header>
  <main class="video-detail">
    <article>
      <div class="video-embed">
        <iframe src="${escapeHtml(video.embed_url)}?rel=0" title="${escapeHtml(video.title)}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>
      </div>
      <p class="eyebrow">Travel &amp; Food Video</p>
      <h1>${escapeHtml(video.title)}</h1>
      <p class="published">Published ${new Date(video.published_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" })}</p>
      ${matchingTopics.length ? `<nav class="topic-tags" aria-label="Video topics">${matchingTopics.map((topic) => `<a href="/topics/${topic.slug}/">${escapeHtml(topic.name)}</a>`).join("")}</nav>` : ""}
      <div class="video-description">${paragraphs(video.description)}</div>
      <a class="watch-link" href="${escapeHtml(video.youtube_url)}" target="_blank" rel="noopener noreferrer">Watch on YouTube ↗</a>
      ${relatedSection(related)}
    </article>
  </main>
</body>
</html>`;
}

function renderTopicIndex(topics) {
  const cards = topics.map((topic) => `<a class="topic-card" href="/topics/${topic.slug}/"><h2>${escapeHtml(topic.name)}</h2><p>${escapeHtml(topic.description)}</p><span>Explore videos ↗</span></a>`).join("");
  return pageShell({
    title: "Travel Video Topics | Jason Michael Phillips",
    description: "Browse travel, food, hotel review, walking tour, and cultural experience videos by topic.",
    canonical: `${SITE_URL}/topics/`,
    body: `<header class="site-header"><a class="site-logo" href="/">Jason Michael Phillips</a><a class="back-link" href="/">Latest videos</a></header><main class="topic-detail"><p class="eyebrow">Explore the library</p><h1>Browse video topics</h1><p class="topic-intro">Discover travel stories, food adventures, hotel reviews, and walking tours organized by subject.</p><div class="topic-grid">${cards}</div></main>`,
  });
}

function renderTopicPage(topic, videos) {
  const cards = videos.map((video) => videoCard(video)).join("");
  return pageShell({
    title: `${topic.name} | Jason Michael Phillips`,
    description: topic.description,
    canonical: `${SITE_URL}/topics/${topic.slug}/`,
    body: `<header class="site-header"><a class="site-logo" href="/">Jason Michael Phillips</a><a class="back-link" href="/topics/">All topics</a></header><main class="topic-detail"><p class="eyebrow">Automatically curated topic</p><h1>${escapeHtml(topic.name)}</h1><p class="topic-intro">${escapeHtml(topic.description)}</p><div class="related-grid">${cards}</div></main>`,
  });
}

function relatedSection(videos) {
  if (!videos.length) return "";
  return `<section class="related-section"><h2>More videos</h2><div class="related-grid">${videos.map((video) => videoCard(video)).join("")}</div></section>`;
}

function videoCard(video) {
  return `<a class="related-card" href="/videos/${encodeURIComponent(video.slug)}/"><img src="${escapeHtml(video.thumbnail_url)}" alt="${escapeHtml(video.title)}" loading="lazy"><span>${escapeHtml(video.title)}</span></a>`;
}

function pageShell({ title, description, canonical, body }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${canonical}">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${canonical}">
  <link rel="stylesheet" href="/style.css">
</head>
<body class="video-page">${body}</body>
</html>`;
}

function htmlResponse(html, status = 200) {
  return new Response(html, {
    status,
    headers: {
      "content-type": "text/html; charset=UTF-8",
      "cache-control": "public, max-age=300, s-maxage=3600",
    },
  });
}

function paragraphs(value) {
  return stripHtml(value).split(/\n+/).filter(Boolean).map((line) => `<p>${escapeHtml(line)}</p>`).join("");
}

function textFromXml(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`));
  return match ? decodeXml(match[1].trim().replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "")) : "";
}

function slugify(value) {
  return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 90) || "video";
}

function stripHtml(value) {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function truncate(value, length) {
  return value.length <= length ? value : `${value.slice(0, length - 1).trim()}…`;
}

function decodeXml(value) {
  return value.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

function escapeHtml(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function escapeXml(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json; charset=UTF-8" },
  });
}

function notFoundResponse() {
  return new Response("<!doctype html><title>Video not found</title><h1>Video not found</h1><p><a href=\"/\">Return home</a></p>", {
    status: 404,
    headers: { "content-type": "text/html; charset=UTF-8" },
  });
}
