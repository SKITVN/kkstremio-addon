const express = require("express");

const app = express();
app.disable("x-powered-by");

const PORT = process.env.PORT || 10000;
const API_BASE = "https://phimapi.com";
const ADDON_VERSION = "5.0.0";
const PAGE_SIZE = 24;

const CATALOGS = [
  // Home is mixed in the upstream API. We expose it as movie and coerce
  // catalog cards to movie so Nuvio can display the row consistently.
  { id: "phim-moi", name: "Phim Mới", type: "movie", endpoint: "home" },
  { id: "phim-bo", name: "Phim Bộ", type: "series", endpoint: "danh-sach/phim-bo" },
  { id: "phim-le", name: "Phim Lẻ", type: "movie", endpoint: "danh-sach/phim-le" },
  { id: "phim-chieu-rap", name: "Phim Chiếu Rạp", type: "movie", endpoint: "danh-sach/phim-chieu-rap" },
  { id: "hoat-hinh", name: "Hoạt Hình", type: "series", endpoint: "danh-sach/hoat-hinh" }
];

const IMAGE_HOSTS = new Set([
  "phimimg.com",
  "phimapi.com",
  "img.phimapi.com",
  "image.tmdb.org"
]);

function int(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function getClientPage(query) {
  // Nuvio/Stremio pagination uses skip. Keep one upstream page (24 items)
  // per request so skip=24 -> upstream page 2, skip=48 -> page 3, etc.
  if (query.page !== undefined) {
    return int(query.page, 1, 1, 100000);
  }
  const skip = int(query.skip, 0, 0, 10000000);
  return Math.floor(skip / PAGE_SIZE) + 1;
}

function getBaseUrl(req) {
  const proto =
    req.headers["x-forwarded-proto"] ||
    (req.secure ? "https" : "http");
  const host = req.get("host");
  return `${proto}://${host}`;
}

async function fetchJson(path) {
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "Nuvio-PhimAPI-Addon/5.0"
    }
  });

  if (!response.ok) {
    throw new Error(`PhimAPI HTTP ${response.status}: ${url}`);
  }
  return response.json();
}

function dataRoot(payload) {
  return payload?.data ?? payload ?? {};
}

function itemsOf(payload) {
  const d = dataRoot(payload);
  if (Array.isArray(d.items)) return d.items;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

function paginationOf(payload) {
  const d = dataRoot(payload);
  return d?.params?.pagination || d?.pagination || payload?.pagination || null;
}

function imageBaseOf(payload) {
  const d = dataRoot(payload);
  return (
    d?.pathImage ||
    payload?.pathImage ||
    "https://phimapi.com/uploads/movies/"
  );
}

function absoluteImage(value, base) {
  if (!value) return null;
  const s = String(value).trim();
  if (/^https?:\/\//i.test(s)) return s;
  return `${String(base).replace(/\/+$/, "")}/${s.replace(/^\/+/, "")}`;
}

function safeProxy(baseUrl, imageUrl) {
  if (!imageUrl) return null;
  // Absolute proxy URL. Relative URLs are not reliable in Nuvio/Stremio.
  return `${baseUrl}/image?url=${encodeURIComponent(imageUrl)}`;
}

function imageCandidates(item, base) {
  const candidates = [
    absoluteImage(item?.poster_url, base),
    absoluteImage(item?.poster, base),
    absoluteImage(item?.thumb_url, base),
    absoluteImage(item?.thumb, base)
  ].filter(Boolean);

  return [...new Set(candidates)];
}

function choosePoster(item, base, baseUrl) {
  const candidates = imageCandidates(item, base);
  // Prefer the original direct URL. If Nuvio cannot fetch the CDN image,
  // the proxy URL is available as a deterministic fallback.
  return candidates[0] || null;
}

function chooseBackground(item, base) {
  const candidates = [
    absoluteImage(item?.thumb_url, base),
    absoluteImage(item?.thumb, base),
    absoluteImage(item?.poster_url, base),
    absoluteImage(item?.poster, base)
  ].filter(Boolean);
  return candidates[0] || null;
}

function itemType(item, fallback) {
  const t = String(
    item?.tmdb?.type ||
    item?.type ||
    item?.movie_type ||
    ""
  ).toLowerCase();

  if (t === "tv" || t === "series" || t === "tvshow") return "series";
  if (t === "movie" || t === "phim-le") return "movie";
  return fallback;
}

function metaCard(item, fallbackType, base, baseUrl) {
  if (!item?.slug) return null;

  const directPoster = choosePoster(item, base, baseUrl);
  const directBackground = chooseBackground(item, base);
  const type = itemType(item, fallbackType);

  const meta = {
    id: `phimapi:${item.slug}`,
    type,
    name: item.name || item.origin_name || item.slug,
    poster: directPoster || safeProxy(baseUrl, directPoster),
    posterShape: "poster"
  };

  if (directBackground) meta.background = directBackground;
  if (item.content || item.description) {
    meta.description = item.content || item.description;
  }
  if (item.year) meta.year = Number(item.year);

  return meta;
}

function filterParams(query, page, includeLimit = false) {
  const p = new URLSearchParams();
  p.set("page", String(page));

  if (includeLimit) p.set("limit", String(PAGE_SIZE));

  for (const key of [
    "category",
    "country",
    "year",
    "sort_field",
    "sort_type",
    "sort_lang"
  ]) {
    if (query[key] !== undefined && query[key] !== "") {
      p.set(key, String(query[key]));
    }
  }
  return p;
}

async function catalogPayload(catalog, query) {
  const page = getClientPage(query);
  const params = filterParams(query, page);

  let path;
  if (catalog.endpoint === "home") {
    path = `/v1/api/home?${params.toString()}`;
  } else {
    path = `/v1/api/${catalog.endpoint}?${params.toString()}`;
  }

  const payload = await fetchJson(path);
  return {
    payload,
    page,
    items: itemsOf(payload),
    pagination: paginationOf(payload),
    base: imageBaseOf(payload)
  };
}

async function movieDetail(slug) {
  const payload = await fetchJson(`/v1/api/phim/${encodeURIComponent(slug)}`);
  const root = dataRoot(payload);
  return {
    raw: payload,
    item:
      root?.item ||
      payload?.item ||
      root?.movie ||
      payload?.movie ||
      null
  };
}

async function movieImages(slug) {
  try {
    const payload = await fetchJson(
      `/v1/api/phim/${encodeURIComponent(slug)}/images`
    );
    return dataRoot(payload);
  } catch (error) {
    console.error("IMAGE META ERROR:", error.message);
    return null;
  }
}

function tmdbPoster(images) {
  const p = images?.image_sizes?.poster;
  if (!p) return null;
  return p.w780 || p.w500 || p.w342 || p.original || null;
}

function tmdbBackdrop(images) {
  const b = images?.image_sizes?.backdrop;
  if (!b) return null;
  return b.w1280 || b.w780 || b.w300 || b.original || null;
}

function episodeEntries(item) {
  const servers = Array.isArray(item?.episodes)
    ? item.episodes
    : Array.isArray(item?.server_data)
      ? [{ server_data: item.server_data }]
      : [];

  const out = [];
  servers.forEach((server, serverIndex) => {
    const serverName =
      server?.server_name ||
      server?.name ||
      `Server ${serverIndex + 1}`;

    const episodes =
      Array.isArray(server?.server_data)
        ? server.server_data
        : Array.isArray(server?.episodes)
          ? server.episodes
          : [];

    episodes.forEach((episode, episodeIndex) => {
      out.push({
        serverIndex,
        episodeIndex,
        serverName,
        episode
      });
    });
  });
  return out;
}

app.get("/", (_req, res) => {
  res.type("html").send(`<!doctype html>
<html lang="vi">
<head><meta charset="utf-8"><title>Nuvio PhimAPI Addon v5</title>
<style>
body{font-family:Arial;background:#0f1117;color:#eee;max-width:900px;margin:40px auto;padding:20px}
a{color:#70b8ff}li{margin:10px 0}code{background:#1b202b;padding:3px 6px;border-radius:4px}
</style></head>
<body>
<h1>Nuvio PhimAPI Addon v5</h1>
<p>PhimAPI v1 • poster URL tuyệt đối • pagination 24 phim/trang • Phim Mới/Bộ/Lẻ/Chiếu Rạp/Hoạt Hình.</p>
<ul>
<li><a href="/health">Health</a></li>
<li><a href="/manifest.json">Manifest</a></li>
<li><a href="/catalog/movie/phim-moi.json">Phim Mới</a></li>
<li><a href="/catalog/series/phim-bo.json">Phim Bộ</a></li>
<li><a href="/catalog/movie/phim-le.json">Phim Lẻ</a></li>
<li><a href="/catalog/movie/phim-chieu-rap.json">Phim Chiếu Rạp</a></li>
<li><a href="/catalog/series/hoat-hinh.json">Hoạt Hình</a></li>
<li><a href="/catalog/movie/search.json?search=avengers">Tìm kiếm</a></li>
</ul>
</body></html>`);
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, addon: "vn.starskingit.phimapi", version: ADDON_VERSION });
});

app.get("/manifest.json", (_req, res) => {
  res.json({
    id: "vn.starskingit.phimapi",
    version: ADDON_VERSION,
    name: "KKPhim • PhimAPI v5",
    description: "Phim Mới, Phim Bộ, Phim Lẻ, Phim Chiếu Rạp, Hoạt Hình",
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

app.get("/catalog/:type/search.json", async (req, res) => {
  try {
    const keyword = String(req.query.search || "").trim();
    if (!keyword) return res.json({ metas: [] });

    const page = getClientPage(req.query);
    const params = new URLSearchParams({
      keyword,
      page: String(page),
      limit: String(PAGE_SIZE)
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

    const payload = await fetchJson(`/v1/api/tim-kiem?${params.toString()}`);
    const base = imageBaseOf(payload);
    const baseUrl = getBaseUrl(req);

    const metas = itemsOf(payload)
      .map(item => metaCard(item, req.params.type, base, baseUrl))
      .filter(Boolean);

    res.set("Cache-Control", "public, max-age=60, s-maxage=60");
    res.json({ metas });
  } catch (error) {
    console.error("SEARCH ERROR:", error);
    res.status(502).json({ metas: [] });
  }
});

app.get("/catalog/:type/:id.json", async (req, res) => {
  try {
    const catalog = CATALOGS.find(
      c => c.id === req.params.id && c.type === req.params.type
    );

    if (!catalog) return res.status(404).json({ metas: [] });

    const result = await catalogPayload(catalog, req.query);
    const baseUrl = getBaseUrl(req);

    let metas = result.items
      .map(item => metaCard(item, catalog.type, result.base, baseUrl))
      .filter(Boolean);

    // Nuvio expects catalog cards to match the catalog type.
    // The home endpoint is mixed, so keep only movie cards there.
    if (catalog.id === "phim-moi") {
      metas = metas.filter(m => m.type === "movie");
    }

    res.set("Cache-Control", "no-store");
    res.json({
      metas,
      // Kept for diagnostics; ignored by Nuvio.
      pagination: result.pagination,
      upstreamPage: result.page
    });
  } catch (error) {
    console.error("CATALOG ERROR:", error);
    res.status(502).json({ metas: [] });
  }
});

app.get("/meta/:type/:id.json", async (req, res) => {
  try {
    const rawId = decodeURIComponent(req.params.id);
    const slug = rawId.replace(/^phimapi:/, "");

    const [{ raw, item }, images] = await Promise.all([
      movieDetail(slug),
      movieImages(slug)
    ]);

    if (!item) return res.status(404).json({ meta: null });

    const base =
      raw?.pathImage ||
      dataRoot(raw)?.pathImage ||
      "https://phimapi.com/uploads/movies/";

    const baseUrl = getBaseUrl(req);
    const directPoster =
      tmdbPoster(images) ||
      choosePoster(item, base, baseUrl);
    const directBackground =
      tmdbBackdrop(images) ||
      chooseBackground(item, base);

    const meta = {
      id: `phimapi:${item.slug || slug}`,
      type: itemType(item, req.params.type),
      name: item.name || item.origin_name || slug,
      poster: directPoster,
      background: directBackground || undefined,
      posterShape: "poster",
      description: item.content || item.description || item.origin_name || undefined
    };

    if (item.year) meta.year = Number(item.year);

    if (Array.isArray(item.category)) {
      meta.genres = item.category
        .map(x => x?.name || x?.slug)
        .filter(Boolean);
    }

    const eps = episodeEntries(item);
    meta.videos = eps.map((entry, i) => ({
      id: `phimapi:${slug}:s${entry.serverIndex}:e${entry.episodeIndex}`,
      title: `${entry.serverName} — ${entry.episode?.name || `Tập ${i + 1}`}`,
      season: Number(entry.episode?.season || 1),
      episode: Number(
        entry.episode?.episode ||
        entry.episode?.episode_number ||
        i + 1
      )
    }));

    res.set("Cache-Control", "no-store");
    res.json({ meta });
  } catch (error) {
    console.error("META ERROR:", error);
    res.status(502).json({ meta: null });
  }
});

app.get("/stream/:type/:id.json", async (req, res) => {
  try {
    const rawId = decodeURIComponent(req.params.id);
    const match = rawId.match(/^phimapi:(.+):s(\d+):e(\d+)$/);
    if (!match) return res.json({ streams: [] });

    const slug = match[1];
    const serverIndex = Number(match[2]);
    const episodeIndex = Number(match[3]);

    const { item } = await movieDetail(slug);
    const entry = episodeEntries(item).find(
      x => x.serverIndex === serverIndex && x.episodeIndex === episodeIndex
    );

    if (!entry?.episode) return res.json({ streams: [] });

    const ep = entry.episode;
    const title = `${item?.name || slug} — ${ep.name || `Tập ${episodeIndex + 1}`}`;

    const streams = [];
    if (ep.link_m3u8) {
      streams.push({
        name: `PhimAPI • ${entry.serverName}`,
        title,
        url: ep.link_m3u8,
        behaviorHints: { bingeGroup: `phimapi-${slug}-${serverIndex}` }
      });
    }
    if (ep.link_embed) {
      streams.push({
        name: `PhimAPI Embed • ${entry.serverName}`,
        title,
        externalUrl: ep.link_embed
      });
    }

    res.json({ streams });
  } catch (error) {
    console.error("STREAM ERROR:", error);
    res.status(502).json({ streams: [] });
  }
});

// Optional absolute image proxy. Catalogs use direct poster_url first.
// Nuvio can use this endpoint manually if a CDN blocks direct image access.
app.get("/image", async (req, res) => {
  try {
    const target = String(req.query.url || "");
    if (!/^https?:\/\//i.test(target)) return res.status(400).end();

    const u = new URL(target);
    const host = u.hostname.toLowerCase();
    const allowed = [...IMAGE_HOSTS].some(
      domain => host === domain || host.endsWith(`.${domain}`)
    );
    if (!allowed) return res.status(403).end();

    const upstream = await fetch(target, {
      headers: {
        accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "user-agent": "Mozilla/5.0 Nuvio-PhimAPI-Addon/5.0"
      }
    });

    if (!upstream.ok) return res.status(upstream.status).end();

    res.set("Content-Type", upstream.headers.get("content-type") || "image/jpeg");
    res.set("Cache-Control", "public, max-age=86400, s-maxage=86400");
    res.send(Buffer.from(await upstream.arrayBuffer()));
  } catch (error) {
    console.error("IMAGE PROXY ERROR:", error);
    res.status(502).end();
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Nuvio PhimAPI v${ADDON_VERSION} listening on ${PORT}`);
});
