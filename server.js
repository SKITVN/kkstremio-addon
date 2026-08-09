const express = require("express");

const app = express();
app.disable("x-powered-by");

const PORT = process.env.PORT || 10000;
const API_BASE = "https://phimapi.com";
// Public URL of this addon (Render sets RENDER_EXTERNAL_URL). Used for absolute image proxy links.
const PUBLIC_URL = (
  process.env.PUBLIC_URL ||
  process.env.RENDER_EXTERNAL_URL ||
  ""
).replace(/\/+$/, "");

const CATALOGS = [
  { id: "phim-moi", name: "Phim Mới", type: "movie", slug: "phim-moi-cap-nhat" },
  { id: "phim-bo", name: "Phim Bộ", type: "series", slug: "phim-bo" },
  { id: "phim-le", name: "Phim Lẻ", type: "movie", slug: "phim-le" },
  { id: "phim-chieu-rap", name: "Phim Chiếu Rạp", type: "movie", slug: "phim-chieu-rap" },
  { id: "hoat-hinh", name: "Hoạt Hình", type: "series", slug: "hoat-hinh" }
];

const ALLOWED_IMAGE_HOSTS = new Set([
  "phimapi.com",
  "phimimg.com",
  "img.phimapi.com",
  "image.tmdb.org"
]);

const DEFAULT_CDN = "https://phimimg.com";

function num(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

// PhimAPI default page size for danh-sach is 24
const API_PAGE_SIZE = 24;

/**
 * Map Stremio/Nuvio `skip` (number of items already shown) → API page number.
 * One request = one API page so infinite scroll stays in sync.
 */
function pageFromQuery(query) {
  if (query.page !== undefined) return num(query.page, 1, 1, 10000);

  const skip = num(query.skip, 0, 0, 1000000);
  // Prefer explicit limit from client, else API page size
  const pageSize = num(query.limit, API_PAGE_SIZE, 1, 64);

  return Math.floor(skip / pageSize) + 1;
}

function buildFilterParams(query, page) {
  const p = new URLSearchParams();
  p.set("page", String(page));

  const allowed = [
    "category",
    "country",
    "year",
    "sort_field",
    "sort_type",
    "sort_lang"
  ];

  for (const key of allowed) {
    if (query[key] !== undefined && query[key] !== "") {
      p.set(key, String(query[key]));
    }
  }

  return p;
}

async function fetchJson(path) {
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;

  const r = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "Mozilla/5.0 Nuvio-PhimAPI-Addon/4.1"
    }
  });

  if (!r.ok) {
    throw new Error(`PhimAPI HTTP ${r.status}: ${url}`);
  }

  return r.json();
}

function unwrapData(data) {
  return data?.data ?? data ?? {};
}

function listItems(data) {
  const d = unwrapData(data);
  return Array.isArray(d?.items)
    ? d.items
    : Array.isArray(data?.items)
      ? data.items
      : [];
}

function pagination(data) {
  const d = unwrapData(data);
  return (
    d?.params?.pagination ||
    d?.pagination ||
    data?.pagination ||
    null
  );
}

/**
 * CDN base từ API:
 * - APP_DOMAIN_CDN_IMAGE = "https://phimimg.com"  (list + detail)
 * - poster_url trong list là relative: "uploads/movies/..."
 * - poster_url trong detail thường đã absolute
 */
function imageBase(data) {
  const d = unwrapData(data);
  const base =
    d?.APP_DOMAIN_CDN_IMAGE ||
    data?.APP_DOMAIN_CDN_IMAGE ||
    d?.pathImage ||
    data?.pathImage ||
    DEFAULT_CDN;

  return String(base).replace(/\/+$/, "");
}

function absoluteImage(value, base) {
  if (!value) return null;

  let s = String(value).trim();
  if (!s) return null;

  // Already absolute
  if (/^https?:\/\//i.test(s)) return s;

  // Protocol-relative
  if (s.startsWith("//")) return `https:${s}`;

  s = s.replace(/^\/+/, "");
  const b = String(base || DEFAULT_CDN).replace(/\/+$/, "");
  return `${b}/${s}`;
}

/**
 * Prefer direct CDN URL (works in Nuvio/Stremio).
 * Fallback to absolute proxy URL if PUBLIC_URL is set and direct fails policy.
 */
function imageProxyUrl(absoluteUrl, req) {
  if (!absoluteUrl) return null;

  // Direct CDN is preferred — phimimg.com allows hotlinking and is fast.
  // Only use proxy when explicitly forced.
  if (process.env.FORCE_IMAGE_PROXY !== "1") {
    return absoluteUrl;
  }

  const origin =
    PUBLIC_URL ||
    (req
      ? `${req.protocol}://${req.get("host")}`
      : "");

  if (!origin) {
    // Relative proxy is useless for clients — return direct instead
    return absoluteUrl;
  }

  return `${origin}/image?url=${encodeURIComponent(absoluteUrl)}`;
}

function posterFor(item, base, req) {
  const value =
    item.poster_url ||
    item.poster ||
    item.thumb_url ||
    item.thumb;

  const direct = absoluteImage(value, base);
  return imageProxyUrl(direct, req);
}

function backgroundFor(item, base, req) {
  const value =
    item.thumb_url ||
    item.thumb ||
    item.poster_url ||
    item.poster;

  const direct = absoluteImage(value, base);
  return imageProxyUrl(direct, req);
}

function typeForItem(item, fallback) {
  const t = String(item?.tmdb?.type || item?.type || "").toLowerCase();

  if (
    t === "tv" ||
    t === "series" ||
    t === "tvshow" ||
    t === "hoathinh" ||
    item?.type === "series" ||
    item?.type === "tvshows"
  ) {
    return "series";
  }

  // API uses type: "single" for movies
  if (t === "single" || t === "movie") return "movie";

  return fallback || "movie";
}

function stripHtml(html) {
  if (!html) return undefined;
  return String(html)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim() || undefined;
}

function namesOf(arr) {
  if (!Array.isArray(arr)) return [];
  return arr
    .map(x => (typeof x === "string" ? x : x?.name || x?.slug))
    .filter(Boolean);
}

function metaFromItem(item, catalogType, base, req) {
  const slug = item?.slug;
  if (!slug) return null;

  // Prefer catalog type so series catalogs always emit type:"series"
  // (avoids empty series rows when clients filter strictly by catalog type)
  const detected = typeForItem(item, catalogType);
  const type = catalogType === "series" || catalogType === "movie"
    ? catalogType
    : detected;

  const poster = posterFor(item, base, req);
  const background = backgroundFor(item, base, req);

  const imdbScore =
    item?.imdb?.vote_average ||
    item?.tmdb?.vote_average ||
    null;

  const genres = namesOf(item.category);
  const countries = namesOf(item.country);

  const meta = {
    id: `phimapi:${slug}`,
    type,
    name: item.name || item.origin_name || slug,
    poster,
    background,
    posterShape: "poster"
  };

  if (item.origin_name && item.origin_name !== item.name) {
    meta.originalTitle = item.origin_name;
  }

  const desc = stripHtml(item.content || item.description);
  if (desc) meta.description = desc;

  if (item.year) meta.year = Number(item.year);

  if (genres.length) meta.genres = genres;

  if (imdbScore) {
    meta.imdbRating = String(Number(imdbScore).toFixed(1));
  }

  // Extra release info line for catalog cards
  const bits = [];
  if (item.quality) bits.push(item.quality);
  if (item.lang) bits.push(item.lang);
  if (item.episode_current && item.episode_current !== "Full") {
    bits.push(item.episode_current);
  }
  if (bits.length) {
    meta.releaseInfo = bits.join(" • ");
  }

  return meta;
}

/*
 * One API page per request.
 * Stremio/Nuvio pass `skip` = number of metas already displayed.
 * Mapping: page = floor(skip / pageSize) + 1
 * Returning a stable page size keeps infinite scroll working.
 */
async function getCatalogItems(catalog, query) {
  const page = pageFromQuery(query);
  const params = buildFilterParams(query, page);

  // Optional: allow higher limit when API supports it
  const limit = num(query.limit, API_PAGE_SIZE, 1, 64);
  params.set("limit", String(limit));

  const slug = catalog.slug || "phim-moi-cap-nhat";
  const path = `/v1/api/danh-sach/${slug}?${params.toString()}`;

  const data = await fetchJson(path);
  const items = listItems(data);
  const base = imageBase(data);
  const pag = pagination(data);

  return {
    items,
    base,
    pagination: pag,
    page,
    hasMore: pag
      ? Number(pag.currentPage || page) < Number(pag.totalPages || 1)
      : items.length >= limit
  };
}

async function getMovie(slug) {
  const data = await fetchJson(`/v1/api/phim/${encodeURIComponent(slug)}`);
  const d = unwrapData(data);

  return {
    raw: data,
    item:
      d?.item ||
      data?.item ||
      data?.movie ||
      d?.movie ||
      null,
    base: imageBase(data)
  };
}

async function getMovieImages(slug) {
  try {
    const data = await fetchJson(
      `/v1/api/phim/${encodeURIComponent(slug)}/images`
    );
    return unwrapData(data);
  } catch (e) {
    console.error("images:", e.message);
    return null;
  }
}

function extractTMDBPoster(images) {
  const sizes = images?.image_sizes?.poster;
  if (!sizes) return null;

  return (
    sizes.w500 ||
    sizes.w780 ||
    sizes.w342 ||
    sizes.original ||
    null
  );
}

function extractTMDBBackdrop(images) {
  const sizes = images?.image_sizes?.backdrop;
  if (!sizes) return null;

  return (
    sizes.w1280 ||
    sizes.w780 ||
    sizes.w300 ||
    sizes.original ||
    null
  );
}

function episodeList(item) {
  if (Array.isArray(item?.episodes)) {
    return item.episodes;
  }

  if (Array.isArray(item?.server_data)) {
    return [{ server_data: item.server_data }];
  }

  return [];
}

function episodeEntries(item) {
  const result = [];

  episodeList(item).forEach((server, serverIndex) => {
    const serverName =
      server?.server_name ||
      server?.name ||
      `Server ${serverIndex + 1}`;

    const eps = Array.isArray(server?.server_data)
      ? server.server_data
      : Array.isArray(server?.episodes)
        ? server.episodes
        : [];

    eps.forEach((ep, episodeIndex) => {
      result.push({
        serverIndex,
        episodeIndex,
        serverName,
        episode: ep
      });
    });
  });

  return result;
}

/* Home / diagnostics */
app.get("/", (_req, res) => {
  res.type("html").send(`<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<title>Nuvio PhimAPI Addon v4.2</title>
<style>
body{font-family:Arial,sans-serif;background:#0f1117;color:#eee;max-width:900px;margin:40px auto;padding:20px}
a{color:#69b7ff}li{margin:12px 0}
code{background:#181c25;padding:3px 6px;border-radius:5px}
</style>
</head>
<body>
<h1>Nuvio PhimAPI Addon v4.2</h1>
<p>Poster CDN + infinite scroll (1 API page / request) + Phim Bộ series.</p>
<ul>
<li><a href="/health">Health</a></li>
<li><a href="/manifest.json">Manifest</a></li>
<li><a href="/catalog/movie/phim-moi.json">Phim Mới</a></li>
<li><a href="/catalog/series/phim-bo.json">Phim Bộ</a></li>
<li><a href="/catalog/movie/phim-le.json">Phim Lẻ</a></li>
<li><a href="/catalog/movie/phim-chieu-rap.json">Phim Chiếu Rạp</a></li>
<li><a href="/catalog/series/hoat-hinh.json">Hoạt Hình</a></li>
<li><a href="/catalog/movie/search.json?search=avengers">Search test</a></li>
</ul>
</body>
</html>`);
});

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    addon: "vn.starskingit.phimapi",
    version: "4.2.0",
    publicUrl: PUBLIC_URL || null
  });
});

/*
 * Poster proxy (optional).
 * Supports: phimimg.com, phimapi.com, img.phimapi.com, image.tmdb.org
 */
app.get("/image", async (req, res) => {
  try {
    const target = String(req.query.url || "");
    if (!/^https?:\/\//i.test(target)) {
      return res.status(400).end();
    }

    const u = new URL(target);
    const host = u.hostname.toLowerCase();

    const allowed = [...ALLOWED_IMAGE_HOSTS].some(
      domain => host === domain || host.endsWith(`.${domain}`)
    );

    if (!allowed) return res.status(403).end();

    const r = await fetch(target, {
      headers: {
        accept:
          "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "user-agent": "Mozilla/5.0"
      }
    });

    if (!r.ok) return res.status(r.status).end();

    const contentType = r.headers.get("content-type") || "image/jpeg";
    const body = Buffer.from(await r.arrayBuffer());

    res.set("Content-Type", contentType);
    res.set("Cache-Control", "public, max-age=86400, s-maxage=86400");
    res.send(body);
  } catch (e) {
    console.error("IMAGE ERROR", e);
    res.status(502).end();
  }
});

/* Manifest */
app.get("/manifest.json", (_req, res) => {
  res.json({
    id: "vn.starskingit.phimapi",
    version: "4.2.0",
    name: "KKPhim • PhimAPI",
    description:
      "Phim Mới, Phim Bộ, Phim Lẻ, Phim Chiếu Rạp, Hoạt Hình — API v1 (poster + infinite scroll).",
    logo: "https://www.google.com/s2/favicons?domain=phimapi.com&sz=128",
    resources: ["catalog", "meta", "stream"],
    types: ["movie", "series"],
    idPrefixes: ["phimapi:"],

    catalogs: CATALOGS.map(c => ({
      type: c.type,
      id: c.id,
      name: c.name,
      extra: [
        { name: "search", isRequired: false },
        { name: "skip", isRequired: false }
      ]
    }))
  });
});

/* Search */
app.get("/catalog/:type/search.json", async (req, res) => {
  try {
    const keyword = String(req.query.search || "").trim();

    if (!keyword) {
      return res.json({ metas: [] });
    }

    const page = pageFromQuery(req.query);
    const limit = num(req.query.limit, 64, 1, 64);

    const params = new URLSearchParams({
      keyword,
      page: String(page),
      limit: String(limit)
    });

    for (const key of [
      "category",
      "country",
      "year",
      "sort_field",
      "sort_type",
      "sort_lang"
    ]) {
      if (req.query[key] !== undefined && req.query[key] !== "") {
        params.set(key, String(req.query[key]));
      }
    }

    const data = await fetchJson(`/v1/api/tim-kiem?${params.toString()}`);
    const items = listItems(data);
    const base = imageBase(data);

    const metas = items
      .map(item => metaFromItem(item, req.params.type, base, req))
      .filter(Boolean);

    res.set("Cache-Control", "public, max-age=60, s-maxage=60");
    res.json({ metas });
  } catch (e) {
    console.error("SEARCH ERROR", e);
    res.status(502).json({ metas: [], error: e.message });
  }
});

/* Catalog */
app.get("/catalog/:type/:id.json", async (req, res) => {
  try {
    // Match by id first; allow type mismatch fallback so clients still get data
    let catalog = CATALOGS.find(
      c => c.id === req.params.id && c.type === req.params.type
    );

    if (!catalog) {
      catalog = CATALOGS.find(c => c.id === req.params.id);
    }

    if (!catalog) {
      return res.status(404).json({ metas: [] });
    }

    const { items, base, pagination, page, hasMore } = await getCatalogItems(
      catalog,
      req.query
    );

    // Force metas.type = catalog.type (series catalog → series)
    const metas = items
      .map(item => metaFromItem(item, catalog.type, base, req))
      .filter(Boolean);

    res.set("Cache-Control", "public, max-age=60, s-maxage=60");

    res.json({
      metas,
      // Helpful for debugging; ignored by clients
      pagination,
      page,
      hasMore
    });
  } catch (e) {
    console.error("CATALOG ERROR", e);
    res.status(502).json({
      metas: [],
      error: e.message
    });
  }
});

/* Meta — đầy đủ thông tin từ API */
app.get("/meta/:type/:id.json", async (req, res) => {
  try {
    const rawId = decodeURIComponent(req.params.id);
    const slug = rawId.replace(/^phimapi:/, "");

    const [{ raw, item, base: detailBase }, images] = await Promise.all([
      getMovie(slug),
      getMovieImages(slug)
    ]);

    if (!item) {
      return res.status(404).json({ meta: null });
    }

    const base = detailBase || imageBase(raw) || DEFAULT_CDN;

    const tmdbPoster = extractTMDBPoster(images);
    const tmdbBackdrop = extractTMDBBackdrop(images);

    // Prefer TMDB HD if available, else API poster (already absolute on detail)
    const poster =
      tmdbPoster ||
      absoluteImage(item.poster_url || item.poster, base) ||
      posterFor(item, base, req);

    const background =
      tmdbBackdrop ||
      absoluteImage(item.thumb_url || item.thumb, base) ||
      backgroundFor(item, base, req);

    const type = typeForItem(item, req.params.type);

    const imdbScore =
      item?.imdb?.vote_average || item?.tmdb?.vote_average || null;

    const genres = namesOf(item.category);
    const countries = namesOf(item.country);
    const directors = namesOf(
      Array.isArray(item.director) ? item.director : item.director ? [item.director] : []
    );
    const actors = namesOf(
      Array.isArray(item.actor) ? item.actor : item.actor ? [item.actor] : []
    );

    const meta = {
      id: `phimapi:${item.slug || slug}`,
      type,
      name: item.name || item.origin_name || slug,
      poster,
      background,
      posterShape: "poster"
    };

    if (item.origin_name && item.origin_name !== item.name) {
      meta.originalTitle = item.origin_name;
    }

    const desc = stripHtml(item.content || item.description);
    if (desc) meta.description = desc;

    if (item.year) meta.year = Number(item.year);
    if (genres.length) meta.genres = genres;
    if (imdbScore) meta.imdbRating = String(Number(imdbScore).toFixed(1));
    if (item.imdb?.id) meta.imdb_id = item.imdb.id;
    if (directors.length) meta.director = directors;
    if (actors.length) meta.cast = actors.slice(0, 15);
    if (item.time) meta.runtime = String(item.time);
    if (countries.length) meta.country = countries.join(", ");
    if (item.trailer_url) meta.trailers = [{ source: item.trailer_url, type: "Trailer" }];

    // Extra info block
    const extras = [];
    if (item.quality) extras.push(`Chất lượng: ${item.quality}`);
    if (item.lang) extras.push(`Ngôn ngữ: ${item.lang}`);
    if (item.episode_current) extras.push(`Tập: ${item.episode_current}`);
    if (item.episode_total) extras.push(`Tổng: ${item.episode_total}`);
    if (item.view) extras.push(`Lượt xem: ${item.view}`);
    if (extras.length) {
      meta.description = [meta.description, extras.join(" • ")]
        .filter(Boolean)
        .join("\n\n");
    }

    const eps = episodeEntries(item);

    if (type === "series" || eps.length > 1) {
      meta.videos = eps.map((x, i) => ({
        id: `phimapi:${slug}:s${x.serverIndex}:e${x.episodeIndex}`,
        title: `${x.serverName} — ${x.episode?.name || `Tập ${i + 1}`}`,
        season: Number(x.episode?.season || 1),
        episode: Number(
          x.episode?.episode ||
            x.episode?.episode_number ||
            i + 1
        ),
        released: item.year ? `${item.year}-01-01T00:00:00.000Z` : undefined
      }));
    } else if (eps.length === 1) {
      // Movie single: still expose one video id so stream works consistently
      const x = eps[0];
      meta.videos = [
        {
          id: `phimapi:${slug}:s${x.serverIndex}:e${x.episodeIndex}`,
          title: x.episode?.name || "Full",
          season: 1,
          episode: 1
        }
      ];
    }

    res.set("Cache-Control", "public, max-age=300, s-maxage=300");
    res.json({ meta });
  } catch (e) {
    console.error("META ERROR", e);
    res.status(502).json({
      meta: null,
      error: e.message
    });
  }
});

/* Stream — movie (no :s:e) + series episode */
app.get("/stream/:type/:id.json", async (req, res) => {
  try {
    const rawId = decodeURIComponent(req.params.id);

    let slug;
    let serverIndex = 0;
    let episodeIndex = 0;
    let hasEpisode = false;

    const m = rawId.match(/^phimapi:(.+):s(\d+):e(\d+)$/);
    if (m) {
      slug = m[1];
      serverIndex = Number(m[2]);
      episodeIndex = Number(m[3]);
      hasEpisode = true;
    } else if (rawId.startsWith("phimapi:")) {
      slug = rawId.replace(/^phimapi:/, "");
    } else {
      return res.json({ streams: [] });
    }

    const { item } = await getMovie(slug);
    if (!item) return res.json({ streams: [] });

    const entries = episodeEntries(item);
    const streams = [];

    const pushStream = (entry) => {
      const ep = entry.episode;
      if (!ep) return;

      const title =
        `${item.name || slug} — ${ep.name || `Tập ${entry.episodeIndex + 1}`}`;

      if (ep.link_m3u8) {
        streams.push({
          name: `PhimAPI • ${entry.serverName}`,
          title,
          url: ep.link_m3u8,
          behaviorHints: {
            bingeGroup: `phimapi-${slug}-${entry.serverIndex}`
          }
        });
      }

      if (ep.link_embed) {
        streams.push({
          name: `PhimAPI Embed • ${entry.serverName}`,
          title,
          externalUrl: ep.link_embed
        });
      }
    };

    if (hasEpisode) {
      const entry = entries.find(
        x =>
          x.serverIndex === serverIndex &&
          x.episodeIndex === episodeIndex
      );
      if (entry) pushStream(entry);
    } else {
      // Movie / all servers first episode
      entries.forEach(pushStream);
    }

    res.json({ streams });
  } catch (e) {
    console.error("STREAM ERROR", e);
    res.status(502).json({
      streams: [],
      error: e.message
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Nuvio PhimAPI v4.2 listening on ${PORT}`);
  if (PUBLIC_URL) console.log(`PUBLIC_URL=${PUBLIC_URL}`);
});
