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
const DESTINATIONS = [
  { slug: "udon-thani", name: "Udon Thani", keywords: ["udon thani"] },
  { slug: "bangkok", name: "Bangkok", keywords: ["bangkok"] },
  { slug: "thailand", name: "Thailand", keywords: ["thailand", "bangkok", "chiang mai", "pattaya", "hua hin", "phuket", "udon thani"] },
  { slug: "vietnam", name: "Vietnam", keywords: ["vietnam", "ho chi minh", "saigon", "hanoi", "da nang", "hoi an", "nha trang"] },
  { slug: "cambodia", name: "Cambodia", keywords: ["cambodia", "phnom penh", "siem reap", "sihanoukville"] },
  { slug: "laos", name: "Laos", keywords: ["laos", "vientiane", "luang prabang", "pakse"] },
  { slug: "malaysia", name: "Malaysia", keywords: ["malaysia", "kuala lumpur", "penang", "george town", "johor bahru", "malacca"] },
  { slug: "singapore", name: "Singapore", keywords: ["singapore"] },
  { slug: "indonesia", name: "Indonesia", keywords: ["indonesia", "bali", "jakarta", "ubud", "canggu", "kuta"] },
  { slug: "philippines", name: "Philippines", keywords: ["philippines", "manila", "cebu", "davao", "boracay"] },
  { slug: "japan", name: "Japan", keywords: ["japan", "tokyo", "kyoto", "osaka", "nara", "hiroshima", "sapporo", "fukuoka", "okinawa"] },
  { slug: "south-korea", name: "South Korea", keywords: ["south korea", "korea", "seoul", "busan", "incheon", "jeju"] },
  { slug: "united-states", name: "United States", keywords: ["united states", "florida", "pensacola", "new orleans", "lake charles", "gulf coast", "kansas city", "sebring"] },
];

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    let response;

    if (url.pathname === "/" || url.pathname === "/index.html") {
      response = await homepageResponse(env, request, ctx);
    } else if (url.pathname === "/contact-form.html") {
      response = await contactFormPageResponse(request, env);
    } else if (url.pathname === "/sitemap.xml") {
      response = await sitemapResponse(env);
    } else if (url.pathname === "/robots.txt") {
      response = robotsResponse();
    } else if (url.pathname === "/feed.xml") {
      response = await feedResponse(env);
    } else if (url.pathname === "/api/videos") {
      response = await apiVideosResponse(env);
    } else if (url.pathname === "/api/contact") {
      response = await contactFormResponse(request, env);
    } else if (url.pathname === "/topics" || url.pathname === "/topics/") {
      response = await topicIndexResponse(env);
    } else if (url.pathname === "/destinations" || url.pathname === "/destinations/") {
      response = await destinationIndexResponse(env);
    } else if (url.pathname === "/videos" || url.pathname === "/videos/") {
      response = await archiveResponse(env, url);
    } else if (url.pathname.startsWith("/videos/")) {
      response = await videoPageResponse(env, url.pathname);
    } else if (url.pathname.startsWith("/topics/")) {
      response = await topicPageResponse(env, url.pathname);
    } else if (url.pathname.startsWith("/destinations/")) {
      response = await destinationPageResponse(env, url.pathname);
    } else {
      response = await env.ASSETS.fetch(request);
    }

    return withSecurityHeaders(response, request);
  },

  async scheduled(controller, env, ctx) {
    ctx.waitUntil(runScheduledSync(env));
  },
};

async function runScheduledSync(env) {
  let enriched = 0;

  if (env.YOUTUBE_API_KEY) {
    const fullImport = await env.DB.prepare("SELECT value FROM sync_state WHERE key = 'full_import_complete' LIMIT 1").first();
    if (!fullImport) {
      const synced = await syncVideosFromApi(env);
      await markFullImportComplete(env, synced);
      return synced;
    }
    enriched = await enrichVideoMetadataBatch(env);
  }

  const synced = await syncVideosFromFeed(env);
  return { enriched, synced };
}

function robotsResponse() {
  return new Response(`User-agent: *
Allow: /

Sitemap: ${SITE_URL}/sitemap.xml
`, {
    headers: {
      "content-type": "text/plain; charset=UTF-8",
      "cache-control": "public, max-age=3600",
    },
  });
}

async function contactFormResponse(request, env) {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { Allow: "POST" },
    });
  }

  const form = await request.formData();
  const name = String(form.get("name") || "").trim();
  const email = String(form.get("email") || "").trim();
  const message = String(form.get("message") || "").trim();
  const honeypot = String(form.get("website") || "").trim();
  const turnstileToken = String(form.get("cf-turnstile-response") || "").trim();
  const redirect = (status) => Response.redirect(`${SITE_URL}/contact-form.html?${status}`, 303);

  if (honeypot) return redirect("sent=1");
  if (!name || name.length > 100 || !email || email.length > 254 || !message || message.length > 5000) {
    return redirect("error=1");
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(email)) return redirect("error=1");
  if (!env.WEB3FORMS_ACCESS_KEY) return redirect("error=1");

  if (env.TURNSTILE_SECRET_KEY) {
    if (!turnstileToken) return redirect("error=1");

    const verification = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret: env.TURNSTILE_SECRET_KEY,
        response: turnstileToken,
        remoteip: request.headers.get("CF-Connecting-IP") || "",
      }),
    });
    const verificationResult = await verification.json().catch(() => null);
    if (!verification.ok || !verificationResult?.success) return redirect("error=1");
  }

  const payload = {
    access_key: env.WEB3FORMS_ACCESS_KEY,
    name,
    email,
    replyto: email,
    from_name: "Jason Michael Phillips website",
    subject: `Website message from ${name}`,
    message,
    botcheck: false,
  };

  try {
    const response = await fetch("https://api.web3forms.com/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || result?.success === false) {
      console.error("Web3Forms rejected contact submission", {
        status: response.status,
        message: result?.message || result?.body?.message || "Unknown Web3Forms error",
      });
      return redirect("error=1");
    }
    return redirect("sent=1");
  } catch (error) {
    console.error("Web3Forms request failed", error instanceof Error ? error.message : String(error));
    return redirect("error=1");
  }
}

async function contactFormPageResponse(request, env) {
  const asset = await env.ASSETS.fetch(new Request(new URL("/contact-form.html", request.url)));
  const html = await asset.text();
  const configuredHtml = env.TURNSTILE_SITE_KEY
    ? html.replaceAll("__TURNSTILE_SITE_KEY__", escapeHtml(env.TURNSTILE_SITE_KEY))
    : html
      .replace(/\s*<div class="cf-turnstile"[^>]*><\/div>/, "")
      .replace(/\s*<script src="https:\/\/challenges\.cloudflare\.com\/turnstile\/v0\/api\.js"[^>]*><\/script>/, "");
  return new Response(configuredHtml, {
    status: asset.status,
    headers: asset.headers,
  });
}

function withSecurityHeaders(response, request) {
  const headers = new Headers(response.headers);
  headers.set("Content-Security-Policy", "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'self'; form-action 'self'; script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://www.youtube.com https://www.gstatic.com https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://i.ytimg.com https://*.ytimg.com https://img.buymeacoffee.com; frame-src https://challenges.cloudflare.com https://www.youtube.com https://www.youtube-nocookie.com; connect-src 'self' https://challenges.cloudflare.com https://www.youtube.com https://www.youtube-nocookie.com https://cloudflareinsights.com https://static.cloudflareinsights.com");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (new URL(request.url).protocol === "https:") {
    headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function syncVideosFromFeed(env) {
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

async function syncVideosFromApi(env) {
  const channelId = env.YOUTUBE_CHANNEL_ID || DEFAULT_CHANNEL_ID;
  const uploadsPlaylistId = `UU${channelId.slice(2)}`;
  let pageToken = "";
  let synced = 0;
  let statements = [];

  do {
    const apiUrl = new URL("https://www.googleapis.com/youtube/v3/playlistItems");
    apiUrl.searchParams.set("key", env.YOUTUBE_API_KEY);
    apiUrl.searchParams.set("playlistId", uploadsPlaylistId);
    apiUrl.searchParams.set("part", "snippet");
    apiUrl.searchParams.set("maxResults", "50");
    if (pageToken) apiUrl.searchParams.set("pageToken", pageToken);

    const response = await fetch(apiUrl);
    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`YouTube API returned ${response.status}: ${truncate(errorBody, 600)}`);
    }
    const data = await response.json();

    for (const item of data.items || []) {
      const snippet = item.snippet || {};
      const videoId = snippet.resourceId?.videoId;
      if (!videoId || !snippet.title) continue;

      statements.push(upsertVideoStatement(env, {
        videoId,
        title: snippet.title,
        description: snippet.description || "Watch the latest travel and food video from Jason Michael Phillips.",
        publishedAt: snippet.publishedAt || new Date().toISOString(),
        thumbnailUrl: snippet.thumbnails?.high?.url || snippet.thumbnails?.default?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      }));
      synced += 1;

      if (statements.length === 50) {
        await env.DB.batch(statements);
        statements = [];
      }
    }

    pageToken = data.nextPageToken || "";
  } while (pageToken);

  if (statements.length) await env.DB.batch(statements);
  return synced;
}

async function upsertVideo(env, { videoId, title, description, publishedAt, thumbnailUrl, locationDescription = null }) {
  await upsertVideoStatement(env, { videoId, title, description, publishedAt, thumbnailUrl, locationDescription }).run();
}

function upsertVideoStatement(env, { videoId, title, description, publishedAt, thumbnailUrl, durationSeconds = null, locationDescription = null }) {
  const slug = `${slugify(title)}-${videoId.toLowerCase()}`;
  return env.DB.prepare(`
    INSERT INTO videos (id, slug, title, description, thumbnail_url, published_at, duration_seconds, location_description, location_checked, youtube_url, embed_url, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      slug = excluded.slug,
      title = excluded.title,
      description = excluded.description,
      thumbnail_url = excluded.thumbnail_url,
      published_at = excluded.published_at,
      duration_seconds = COALESCE(excluded.duration_seconds, videos.duration_seconds),
      location_description = COALESCE(excluded.location_description, videos.location_description),
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
    durationSeconds,
    locationDescription,
    0,
    `https://www.youtube.com/watch?v=${videoId}`,
    `https://www.youtube.com/embed/${videoId}`,
    new Date().toISOString(),
  );
}

async function getVideoDetails(env, videoIds) {
  const details = new Map();
  if (!videoIds.length) return details;
  const apiUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
  apiUrl.searchParams.set("key", env.YOUTUBE_API_KEY);
  apiUrl.searchParams.set("part", "contentDetails,recordingDetails");
  videoIds.forEach((videoId) => apiUrl.searchParams.append("id", videoId));
  const response = await fetch(apiUrl);
  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`YouTube details API returned ${response.status}: ${truncate(errorBody, 600)}`);
  }
  const data = await response.json();
  for (const item of data.items || []) {
    const seconds = parseDuration(item.contentDetails?.duration);
    details.set(item.id, {
      durationSeconds: seconds,
      locationDescription: item.recordingDetails?.locationDescription?.trim() || null,
    });
  }
  return details;
}

async function enrichVideoMetadataBatch(env) {
  const result = await env.DB.prepare("SELECT id FROM videos WHERE duration_seconds IS NULL OR location_checked = 0 ORDER BY published_at DESC LIMIT 50").all();
  const videoIds = (result.results || []).map((video) => video.id);
  if (!videoIds.length) return 0;

  const details = await getVideoDetails(env, videoIds);
  const now = new Date().toISOString();
  const updates = videoIds.map((videoId) => {
    const metadata = details.get(videoId) || { durationSeconds: null, locationDescription: null };
    return env.DB.prepare(`
      UPDATE videos
      SET duration_seconds = COALESCE(?, duration_seconds),
          location_description = COALESCE(?, location_description),
          location_checked = 1,
          updated_at = CASE
            WHEN COALESCE(location_description, '') <> COALESCE(?, '')
            THEN ?
            ELSE updated_at
          END
      WHERE id = ?
    `).bind(metadata.durationSeconds, metadata.locationDescription, metadata.locationDescription, now, videoId);
  });
  if (updates.length) await env.DB.batch(updates);
  return updates.length;
}

async function markFullImportComplete(env, count) {
  await env.DB.prepare("INSERT INTO sync_state (key, value, updated_at) VALUES ('full_import_complete', ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at")
    .bind(String(count), new Date().toISOString())
    .run();
}

async function videoPageResponse(env, pathname) {
  const slug = decodeURIComponent(pathname.replace(/^\/videos\//, "").replace(/\/$/, ""));

  if (!slug) return new Response("Not found", { status: 404 });

  const video = await env.DB.prepare("SELECT * FROM videos WHERE slug = ? LIMIT 1").bind(slug).first();
  if (!video) {
    const videoId = slug.slice(-11);
    const current = await env.DB.prepare("SELECT slug FROM videos WHERE lower(id) = ? LIMIT 1").bind(videoId.toLowerCase()).first();
    if (current?.slug && current.slug !== slug) {
      return Response.redirect(`${SITE_URL}/videos/${encodeURIComponent(current.slug)}/`, 308);
    }
    return notFoundResponse();
  }

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

async function homepageResponse(env, request, ctx) {
  const cacheKey = new Request(new URL("/", request.url), request);
  const cachedResponse = await caches.default.match(cacheKey);
  if (cachedResponse) return cachedResponse;

  const videos = await getHomepageVideos(env);
  const assetResponse = await env.ASSETS.fetch(request);
  if (!videos.length || !assetResponse.ok) return assetResponse;

  const transformedResponse = new HTMLRewriter()
    .on("#featured-video-player", {
      element(element) {
        if (videos[0]) element.setInnerContent(featuredMarkup(videos[0]), { html: true });
      },
    })
    .on("#video-grid", {
      element(element) {
        element.setInnerContent(videos.slice(1, 10).map(homepageCard).join(""), { html: true });
      },
    })
    .transform(assetResponse);
  const headers = new Headers(transformedResponse.headers);
  headers.set("cache-control", "public, max-age=60, s-maxage=300");
  const response = new Response(transformedResponse.body, {
    status: transformedResponse.status,
    statusText: transformedResponse.statusText,
    headers,
  });
  ctx.waitUntil(caches.default.put(cacheKey, response.clone()));
  return response;
}

async function getHomepageVideos(env) {
  const result = await env.DB.prepare(`
    SELECT id, slug, title, description, thumbnail_url, published_at, duration_seconds, location_description, updated_at, youtube_url, embed_url
    FROM videos
    ORDER BY published_at DESC
    LIMIT 10
  `).all();
  return result.results || [];
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

async function destinationIndexResponse(env) {
  const videos = await getAllVideos(env);
  const active = DESTINATIONS
    .map((destination) => ({ destination, videos: videos.filter((video) => matchesDestination(video, destination)) }))
    .filter((item) => item.videos.length >= 3);
  return htmlResponse(renderDestinationIndex(active));
}

async function destinationPageResponse(env, pathname) {
  const slug = decodeURIComponent(pathname.replace(/^\/destinations\//, "").replace(/\/$/, ""));
  const destination = DESTINATIONS.find((item) => item.slug === slug);
  if (!destination) return notFoundResponse();
  const videos = (await getAllVideos(env)).filter((video) => matchesDestination(video, destination));
  if (videos.length < 3) return notFoundResponse();
  return htmlResponse(renderDestinationPage(destination, videos));
}

async function archiveResponse(env, url) {
  const query = url.searchParams.get("q")?.trim() || "";
  const page = Math.max(1, Math.min(1000, Number.parseInt(url.searchParams.get("page") || "1", 10) || 1));
  const pageSize = 36;
  const offset = (page - 1) * pageSize;
  const pattern = `%${query.replace(/[%_]/g, "\\$&")}%`;
  const where = query ? "WHERE title LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\'" : "";
  const bindings = query ? [pattern, pattern, pageSize, offset] : [pageSize, offset];
  const result = await env.DB.prepare(`SELECT id, slug, title, description, thumbnail_url, published_at FROM videos ${where} ORDER BY published_at DESC LIMIT ? OFFSET ?`).bind(...bindings).all();
  const countResult = await env.DB.prepare(`SELECT COUNT(*) AS total FROM videos ${where}`).bind(...(query ? [pattern, pattern] : [])).first();
  return htmlResponse(renderArchivePage(result.results || [], Number(countResult?.total || 0), query, page, pageSize));
}

async function getAllVideos(env) {
  const result = await env.DB.prepare(`
    SELECT id, slug, title, description, thumbnail_url, published_at, duration_seconds, location_description, updated_at, youtube_url, embed_url
    FROM videos
    ORDER BY published_at DESC
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
  if (topic.slug === "hotel-reviews") return matchesHotelReview(video);
  const content = `${video.title} ${video.description}`.toLowerCase();
  return topic.keywords.some((keyword) => containsKeyword(content, keyword));
}

function matchesHotelReview(video) {
  const title = video.title.toLowerCase();
  const location = (video.location_description || "").toLowerCase().trim();
  const hotelTerms = ["hotel", "resort", "room tour", "room review", "accommodation", "residence", "inn", "motel", "hostel", "guesthouse", "guest house", "lodge", "villa", "apartment", "condo"];
  const foodTerms = ["restaurant", "food", "burger", "cafe", "café", "bar", "buffet", "kitchen", "pizza", "grill", "market", "coffee", "bakery"];
  const titleSuggestsHotel = hotelTerms.some((keyword) => containsKeyword(title, keyword));
  if (!titleSuggestsHotel) return false;

  if (!location) return true;
  if (foodTerms.some((keyword) => containsKeyword(location, keyword))) return false;
  if (hotelTerms.some((keyword) => containsKeyword(location, keyword))) return true;

  // A generic location label can still be valid when the title clearly says
  // hotel review or room tour, but food-service locations were rejected above.
  return containsKeyword(title, "hotel review") || containsKeyword(title, "room tour");
}

function matchesDestination(video, destination) {
  if (destination.slug === "japan" && !video.location_description) return false;
  const content = `${video.title} ${video.location_description || ""}`.toLowerCase();
  return destination.keywords.some((keyword) => containsKeyword(content, keyword));
}

function containsKeyword(content, keyword) {
  const escaped = keyword.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, "i").test(content);
}

async function sitemapResponse(env) {
  const videos = await getAllVideos(env);
  const activeTopics = TOPICS.filter((topic) => videos.some((video) => matchesTopic(video, topic)));
  const activeDestinations = DESTINATIONS.filter((destination) => videos.filter((video) => matchesDestination(video, destination)).length >= 3);
  const latestModified = videos[0] ? new Date(videos[0].updated_at || videos[0].published_at).toISOString() : new Date().toISOString();
  const urls = [
    `<url><loc>${SITE_URL}/</loc><lastmod>${latestModified}</lastmod></url>`,
    `<url><loc>${SITE_URL}/videos/</loc><lastmod>${latestModified}</lastmod></url>`,
    `<url><loc>${SITE_URL}/topics/</loc><lastmod>${latestModified}</lastmod></url>`,
    `<url><loc>${SITE_URL}/destinations/</loc><lastmod>${latestModified}</lastmod></url>`,
    ...activeTopics.map((topic) => `<url><loc>${SITE_URL}/topics/${topic.slug}/</loc><lastmod>${latestModified}</lastmod></url>`),
    ...activeDestinations.map((destination) => `<url><loc>${SITE_URL}/destinations/${destination.slug}/</loc><lastmod>${latestModified}</lastmod></url>`),
    ...videos.map((video) => videoSitemapEntry(video)),
  ];

  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">${urls.join("")}</urlset>`, {
    headers: {
      "content-type": "application/xml; charset=UTF-8",
      "cache-control": "public, max-age=300, s-maxage=3600",
    },
  });
}

async function feedResponse(env) {
  const videos = (await getAllVideos(env)).slice(0, 50);
  const entries = videos.map((video) => `<entry><title>${escapeXml(video.title)}</title><link href="${SITE_URL}/videos/${encodeURIComponent(video.slug)}/"/><id>${escapeXml(video.youtube_url)}</id><updated>${new Date(video.updated_at || video.published_at).toISOString()}</updated><summary type="html">${escapeXml(truncate(stripHtml(video.description), 500))}</summary><media:thumbnail xmlns:media="http://search.yahoo.com/mrss/" url="${escapeXml(video.thumbnail_url)}"/></entry>`).join("");
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><feed xmlns="http://www.w3.org/2005/Atom"><title>Jason Michael Phillips — Latest Videos</title><link href="${SITE_URL}/feed.xml" rel="self"/><link href="${SITE_URL}/"/><id>${SITE_URL}/</id><updated>${new Date().toISOString()}</updated>${entries}</feed>`, {
    headers: { "content-type": "application/atom+xml; charset=UTF-8", "cache-control": "public, max-age=300, s-maxage=3600" },
  });
}

function videoSitemapEntry(video) {
  const title = escapeXml(video.title);
  const description = escapeXml(truncate(stripHtml(video.description), 2048));
  const durationSeconds = validVideoDuration(video.duration_seconds);
  return [
    "<url>",
    `<loc>${SITE_URL}/videos/${encodeURIComponent(video.slug)}/</loc>`,
    `<lastmod>${new Date(video.updated_at || video.published_at).toISOString()}</lastmod>`,
    "<video:video>",
    `<video:thumbnail_loc>${escapeXml(video.thumbnail_url)}</video:thumbnail_loc>`,
    `<video:title>${title}</video:title>`,
    `<video:description>${description}</video:description>`,
    ...(durationSeconds === null ? [] : [`<video:duration>${durationSeconds}</video:duration>`]),
    `<video:player_loc allow_embed="yes">${escapeXml(video.embed_url)}</video:player_loc>`,
    `<video:publication_date>${new Date(video.published_at).toISOString()}</video:publication_date>`,
    "</video:video>",
    "</url>",
  ].join("");
}

function validVideoDuration(value) {
  const duration = Number(value);
  return Number.isInteger(duration) && duration >= 1 && duration <= 28800 ? duration : null;
}

function renderVideoPage(video, related) {
  const canonical = `${SITE_URL}/videos/${encodeURIComponent(video.slug)}/`;
  const description = truncate(stripHtml(video.description), 160);
  const publishedDate = new Date(video.published_at).toISOString();
  const matchingTopics = TOPICS.filter((topic) => matchesTopic(video, topic));
  const matchingDestinations = DESTINATIONS.filter((destination) => matchesDestination(video, destination));
  const durationSeconds = validVideoDuration(video.duration_seconds);
  const schema = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: video.title,
    description,
    thumbnailUrl: [video.thumbnail_url],
    uploadDate: publishedDate,
    ...(durationSeconds === null ? {} : { duration: isoDuration(durationSeconds) }),
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
  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
      { "@type": "ListItem", position: 2, name: "All Videos", item: `${SITE_URL}/videos/` },
      ...(matchingDestinations.length ? [{ "@type": "ListItem", position: 3, name: matchingDestinations[0].name, item: `${SITE_URL}/destinations/${matchingDestinations[0].slug}/` }] : []),
      { "@type": "ListItem", position: matchingDestinations.length ? 4 : 3, name: video.title, item: canonical },
    ],
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
  <link rel="stylesheet" href="/style.css?v=20261016">
  <script type="application/ld+json">${JSON.stringify(schema).replace(/</g, "\\u003c")}</script>
  <script type="application/ld+json">${JSON.stringify(breadcrumbs).replace(/</g, "\\u003c")}</script>
</head>
<body class="video-page">
  <header class="site-header">
    <a class="site-logo" href="/">Jason Michael Phillips</a>
    <a class="back-link" href="/videos/">All videos</a>
  </header>
  <main class="video-detail">
    <article>
      <nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a><span aria-hidden="true">›</span><a href="/videos/">All Videos</a>${matchingDestinations.length ? `<span aria-hidden="true">›</span><a href="/destinations/${matchingDestinations[0].slug}/">${escapeHtml(matchingDestinations[0].name)}</a>` : ""}<span aria-hidden="true">›</span><span>${escapeHtml(video.title)}</span></nav>
      <div class="video-embed">
        <iframe src="${escapeHtml(video.embed_url)}?rel=0" title="${escapeHtml(video.title)}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>
      </div>
      <p class="eyebrow">Travel &amp; Food Video</p>
      <h1>${escapeHtml(video.title)}</h1>
      <p class="published">Published ${new Date(video.published_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" })}</p>
      ${matchingTopics.length ? `<nav class="topic-tags" aria-label="Video topics">${matchingTopics.map((topic) => `<a href="/topics/${topic.slug}/">${escapeHtml(topic.name)}</a>`).join("")}</nav>` : ""}
      ${matchingDestinations.length ? `<nav class="topic-tags destination-tags" aria-label="Video destinations">${matchingDestinations.map((destination) => `<a href="/destinations/${destination.slug}/">${escapeHtml(destination.name)}</a>`).join("")}</nav>` : ""}
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

function renderDestinationIndex(items) {
  const cards = items.map(({ destination, videos }) => `<a class="topic-card" href="/destinations/${destination.slug}/"><h2>${escapeHtml(destination.name)}</h2><p>Travel videos, food discoveries, hotels, and experiences from ${escapeHtml(destination.name)}.</p><span>${videos.length} videos ↗</span></a>`).join("");
  return pageShell({
    title: "Travel Destinations | Jason Michael Phillips",
    description: "Browse Jason Michael Phillips travel videos by destination.",
    canonical: `${SITE_URL}/destinations/`,
    body: `<header class="site-header"><a class="site-logo" href="/">Jason Michael Phillips</a><a class="back-link" href="/videos/">All videos</a></header><main class="topic-detail"><p class="eyebrow">Explore the library</p><h1>Browse destinations</h1><p class="topic-intro">Explore travel stories, food, hotel reviews, and walking tours organized by destination.</p><div class="topic-grid">${cards}</div></main>`,
  });
}

function renderDestinationPage(destination, videos) {
  const cards = videos.map((video) => videoCard(video)).join("");
  return pageShell({
    title: `${destination.name} Travel Videos | Jason Michael Phillips`,
    description: `Explore travel, food, hotel, and walking tour videos from ${destination.name} by Jason Michael Phillips.`,
    canonical: `${SITE_URL}/destinations/${destination.slug}/`,
    body: `<header class="site-header"><a class="site-logo" href="/">Jason Michael Phillips</a><a class="back-link" href="/destinations/">All destinations</a></header><main class="topic-detail"><nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a><span aria-hidden="true">›</span><a href="/destinations/">Destinations</a><span aria-hidden="true">›</span><span>${escapeHtml(destination.name)}</span></nav><p class="eyebrow">Automatically curated destination</p><h1>${escapeHtml(destination.name)} Travel Videos</h1><p class="topic-intro">Explore ${escapeHtml(destination.name)} through travel stories, local food, hotel reviews, and walking tours.</p><div class="related-grid">${cards}</div></main>`,
  });
}

function renderArchivePage(videos, total, query, page, pageSize) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const cards = videos.map((video) => videoCard(video)).join("");
  const params = query ? `&q=${encodeURIComponent(query)}` : "";
  const pagination = `<nav class="pagination" aria-label="Archive pages">${page > 1 ? `<a href="/videos/?page=${page - 1}${params}">← Previous</a>` : ""}<span>Page ${page} of ${totalPages}</span>${page < totalPages ? `<a href="/videos/?page=${page + 1}${params}">Next →</a>` : ""}</nav>`;
  return pageShell({
    title: query ? `Search: ${query} | Jason Michael Phillips` : "All Travel Videos | Jason Michael Phillips",
    description: "Search and browse the complete travel, food, hotel review, and walking tour video archive by Jason Michael Phillips.",
    canonical: `${SITE_URL}/videos/`,
    body: `<header class="site-header"><a class="site-logo" href="/">Jason Michael Phillips</a><a class="back-link" href="/topics/">Browse topics</a></header><main class="topic-detail archive-page"><nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a><span aria-hidden="true">›</span><span>All Videos</span></nav><p class="eyebrow">The complete library</p><h1>All Videos</h1><p class="topic-intro">Search ${total.toLocaleString()} travel, food, hotel, and walking tour videos.</p><form class="archive-search" method="get" action="/videos/"><label for="video-search">Search the video archive</label><div><input id="video-search" name="q" value="${escapeHtml(query)}" placeholder="Try hotel, Bangkok, burger…"><button type="submit">Search</button></div></form><div class="related-grid">${cards || `<p>No videos matched that search.</p>`}</div>${pagination}</main>`,
  });
}

function relatedSection(videos) {
  if (!videos.length) return "";
  return `<section class="related-section"><h2>More videos</h2><div class="related-grid">${videos.map((video) => videoCard(video)).join("")}</div></section>`;
}

function videoCard(video) {
  const date = new Date(video.published_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
  return `<a class="related-card" href="/videos/${encodeURIComponent(video.slug)}/"><img src="${escapeHtml(video.thumbnail_url)}" alt="${escapeHtml(video.title)}" width="640" height="360" loading="lazy"><span>${escapeHtml(video.title)}</span><small>${escapeHtml(date)}</small></a>`;
}

function homepageCard(video) {
  const date = new Date(video.published_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
  const description = truncate(stripHtml(video.description), 120);
  const thumbnail = homepageThumbnail(video.thumbnail_url);
  return `<a class="video-card" href="/videos/${encodeURIComponent(video.slug)}/"><img src="${escapeHtml(thumbnail)}" alt="${escapeHtml(video.title)}" width="320" height="180" loading="lazy" decoding="async"><div class="video-info"><h3>${escapeHtml(video.title)}</h3><p>${escapeHtml(date)}</p><p>${escapeHtml(description)}</p></div></a>`;
}

function homepageThumbnail(url) {
  return url.replace(/\/hqdefault\.jpg$/i, "/mqdefault.jpg");
}

function featuredMarkup(video) {
  const fallback = escapeHtml(video.thumbnail_url);
  const maxResolution = `https://i.ytimg.com/vi/${encodeURIComponent(video.id)}/maxresdefault.jpg`;
  return `<a class="featured-poster" href="/videos/${encodeURIComponent(video.slug)}/" data-video-id="${escapeHtml(video.id)}" aria-label="Play ${escapeHtml(video.title)}"><img src="${maxResolution}" alt="${escapeHtml(video.title)}" width="1280" height="720" fetchpriority="high" onerror="this.onerror=null;this.src='${fallback}'"><span class="featured-play" aria-hidden="true">▶</span><span class="featured-label">Play latest video</span></a>`;
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
  <link rel="stylesheet" href="/style.css?v=20261016">
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
  return stripHtml(value).split(/\n+/).filter(Boolean).map((line) => `<p>${linkify(line)}</p>`).join("");
}

function linkify(value) {
  const escaped = escapeHtml(value);
  return escaped.replace(/https?:\/\/[^\s<]+/g, (url) => {
    const trailingMatch = url.match(/[),.;!?]+$/);
    const trailing = trailingMatch ? trailingMatch[0] : "";
    const cleanUrl = trailing ? url.slice(0, -trailing.length) : url;
    return `<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer">${cleanUrl}</a>${trailing}`;
  });
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

function parseDuration(value) {
  if (!value) return null;
  const match = value.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return null;
  return Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0);
}

function isoDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remaining = seconds % 60;
  return `PT${hours ? `${hours}H` : ""}${minutes ? `${minutes}M` : ""}${remaining || (!hours && !minutes) ? `${remaining}S` : ""}`;
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
  return new Response(`<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Page not found | Jason Michael Phillips</title><meta name="robots" content="noindex"><link rel="stylesheet" href="/style.css?v=20261016"></head><body class="video-page"><header class="site-header"><a class="site-logo" href="/">Jason Michael Phillips</a><a class="back-link" href="/topics/">Browse topics</a></header><main class="topic-detail"><p class="eyebrow">Nothing to see here</p><h1>That page could not be found.</h1><p class="topic-intro">Try the latest videos or browse the automatically curated topics.</p><p><a class="watch-link" href="/">Return to the homepage ↗</a></p></main></body></html>`, {
    status: 404,
    headers: { "content-type": "text/html; charset=UTF-8", "cache-control": "public, max-age=300" },
  });
}
