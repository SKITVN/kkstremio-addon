const express = require("express");

const app = express();
app.disable("x-powered-by");

const PORT = process.env.PORT || 10000;
const API_BASE = "https://phimapi.com";

const CATALOGS = [
  { id: "phim-moi", name: "Phim Mới", type: "movie", slug: "" },
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

function num(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function pageFromQuery(query) {
  if (query.page !== undefined) return num(query.page, 1, 1, 10000);

  const skip = num(query.skip, 0, 0, 1000000);
  const clientPageSize = num(query.limit, 24, 1, 64);

  return Math.floor(skip / clientPageSize) + 1;
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
  const url = path.startsWith("http")
    ? path
    : `${API_BASE}${path}`;

  const r = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "Mozilla/5.0 Nuvio-PhimAPI-Addon/4.0"
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

function imageBase(data) {
  const d = unwrapData(data);
  return (
    d?.pathImage ||
    data?.pathImage ||
    "https://phimapi.com/uploads/movies/"
  );
}

function absoluteImage(value, base) {
  if (!value) return null;

  let s = String(value).trim();

  if (/^https?:\/\//i.test(s)) return s;

  s = s.replace(/^\/+/, "");

  return `${String(base).replace(/\/+$/, "")}/${s}`;
}

function imageProxyUrl(url) {
  if (!url) return null;
  return `/image?url=${encodeURIComponent(url)}`;
}

function posterFor(item, base) {
  const value =
    item.poster_url ||
    item.poster ||
    item.thumb_url ||
    item.thumb;

  const direct = absoluteImage(value, base);
  return imageProxyUrl(direct);
}

function backgroundFor(item, base) {
  const value =
    item.thumb_url ||
    item.thumb ||
    item.poster_url ||
    item.poster;

  const direct = absoluteImage(value, base);
  return imageProxyUrl(direct);
}

function typeForItem(item, fallback) {
  const t = String(item?.tmdb?.type || item?.type || "").toLowerCase();

  if (t === "tv" || t === "series" || t === "tvshow") {
    return "series";
  }

  return fallback;
}

function metaFromItem(item, catalogType, base) {
  const slug = item?.slug;
  if (!slug) return null;

  return {
    id: `phimapi:${slug}`,
    type: typeForItem(item, catalogType),
    name: item.name || item.origin_name || slug,
    poster: posterFor(item, base),
    background: backgroundFor(item, base),
    posterShape: "poster",
    description: item.content || item.description || undefined,
    ...(item.year ? { year: Number(item.year) } : {})
  };
}

/*
 * The v1 API returns 24 items/page for lists.
 * Nuvio often asks for only one catalog page. To avoid "very few movies",
 * this addon combines three API pages into one Nuvio response.
 * When Nuvio sends skip/page, the window moves forward accordingly.
 */
async function getCatalogItems(catalog, query) {
  const firstPage = pageFromQuery(query);
  const pagesToLoad = num(query.pages, 3, 1, 5);

  const paths = [];

  for (let i = 0; i < pagesToLoad; i++) {
    const page = firstPage + i;
    const params = buildFilterParams(query, page);

    if (catalog.slug) {
      paths.push(
        `/v1/api/danh-sach/${catalog.slug}?${params.toString()}`
      );
    } else {
      paths.push(
        `/v1/api/danh-sach?${params.toString()}`
      );
    }
  }

  const responses = await Promise.allSettled(
    paths.map(fetchJson)
  );

  const seen = new Set();
  const items = [];
  let firstPagination = null;
  let base = "https://phimapi.com/uploads/movies/";

  for (const result of responses) {
    if (result.status !== "fulfilled") {
      console.error(result.reason);
      continue;
    }

    const data = result.value;
    const currentItems = listItems(data);

    if (!firstPagination) {
      firstPagination = pagination(data);
    }

    base = imageBase(data);

    for (const item of currentItems) {
      const key = item.slug || item._id || item.name;
      if (!key || seen.has(key)) continue;

      seen.add(key);
      items.push(item);
    }
  }

  return {
    items,
    base,
    pagination: firstPagination,
    pagesLoaded: pagesToLoad
  };
}

async function getMovie(slug) {
  const data = await fetchJson(
    `/v1/api/phim/${encodeURIComponent(slug)}`
  );

  const d = unwrapData(data);

  return {
    raw: data,
    item:
      d?.item ||
      data?.item ||
      data?.movie ||
      d?.movie ||
      null
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

    const eps =
      Array.isArray(server?.server_data)
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
<title>Nuvio PhimAPI Addon v4</title>
<style>
body{font-family:Arial,sans-serif;background:#0f1117;color:#eee;max-width:900px;margin:40px auto;padding:20px}
a{color:#69b7ff}li{margin:12px 0}
code{background:#181c25;padding:3px 6px;border-radius:5px}
</style>
</head>
<body>
<h1>Nuvio PhimAPI Addon v4</h1>
<p>API v1 + poster proxy + pagination 3 trang + search + filters.</p>
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
    version: "4.0.0"
  });
});

/*
 * Poster proxy.
 * Supports:
 * - phimimg.com
 * - phimapi.com
 * - img.phimapi.com
 * - image.tmdb.org
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
        accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "user-agent": "Mozilla/5.0"
      }
    });

    if (!r.ok) return res.status(r.status).end();

    const contentType =
      r.headers.get("content-type") || "image/jpeg";

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
    version: "4.0.0",
    name: "KKPhim • PhimAPI",
    description:
      "Phim Mới, Phim Bộ, Phim Lẻ, Phim Chiếu Rạp, Hoạt Hình — API v1.",
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

    const data = await fetchJson(
      `/v1/api/tim-kiem?${params.toString()}`
    );

    const items = listItems(data);
    const base = imageBase(data);

    const metas = items
      .map(item => metaFromItem(item, req.params.type, base))
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
    const catalog = CATALOGS.find(
      c => c.id === req.params.id && c.type === req.params.type
    );

    if (!catalog) {
      return res.status(404).json({ metas: [] });
    }

    const { items, base, pagination, pagesLoaded } =
      await getCatalogItems(catalog, req.query);

    const metas = items
      .map(item => metaFromItem(item, catalog.type, base))
      .filter(Boolean);

    res.set("Cache-Control", "public, max-age=60, s-maxage=60");

    res.json({
      metas,
      // Diagnostic fields are harmless to Stremio/Nuvio.
      pagination,
      pagesLoaded
    });
  } catch (e) {
    console.error("CATALOG ERROR", e);
    res.status(502).json({
      metas: [],
      error: e.message
    });
  }
});

/* Meta */
app.get("/meta/:type/:id.json", async (req, res) => {
  try {
    const rawId = decodeURIComponent(req.params.id);
    const slug = rawId.replace(/^phimapi:/, "");

    const [{ raw, item }, images] = await Promise.all([
      getMovie(slug),
      getMovieImages(slug)
    ]);

    if (!item) {
      return res.status(404).json({ meta: null });
    }

    const base =
      raw?.pathImage ||
      unwrapData(raw)?.pathImage ||
      "https://phimapi.com/uploads/movies/";

    const tmdbPoster = extractTMDBPoster(images);
    const tmdbBackdrop = extractTMDBBackdrop(images);

    const poster =
      tmdbPoster ||
      posterFor(item, base);

    const background =
      tmdbBackdrop ||
      backgroundFor(item, base);

    const type = typeForItem(item, req.params.type);

    const meta = {
      id: `phimapi:${item.slug || slug}`,
      type,
      name: item.name || item.origin_name || slug,
      poster,
      background,
      posterShape: "poster",
      description:
        item.content ||
        item.description ||
        item.origin_name ||
        undefined
    };

    if (item.year) meta.year = Number(item.year);

    if (Array.isArray(item.category)) {
      meta.genres = item.category
        .map(x => x?.name || x?.slug)
        .filter(Boolean);
    }

    const eps = episodeEntries(item);

    meta.videos = eps.map((x, i) => ({
      id:
        `phimapi:${slug}:s${x.serverIndex}:e${x.episodeIndex}`,
      title:
        `${x.serverName} — ` +
        `${x.episode?.name || `Tập ${i + 1}`}`,
      season: Number(x.episode?.season || 1),
      episode: Number(
        x.episode?.episode ||
        x.episode?.episode_number ||
        i + 1
      )
    }));

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

/* Stream */
app.get("/stream/:type/:id.json", async (req, res) => {
  try {
    const rawId = decodeURIComponent(req.params.id);

    const m =
      rawId.match(/^phimapi:(.+):s(\d+):e(\d+)$/);

    if (!m) {
      return res.json({ streams: [] });
    }

    const slug = m[1];
    const serverIndex = Number(m[2]);
    const episodeIndex = Number(m[3]);

    const { item } = await getMovie(slug);
    const entry = episodeEntries(item).find(
      x =>
        x.serverIndex === serverIndex &&
        x.episodeIndex === episodeIndex
    );

    if (!entry?.episode) {
      return res.json({ streams: [] });
    }

    const ep = entry.episode;
    const title =
      `${item.name || slug} — ` +
      `${ep.name || `Tập ${episodeIndex + 1}`}`;

    const streams = [];

    if (ep.link_m3u8) {
      streams.push({
        name: `PhimAPI • ${entry.serverName}`,
        title,
        url: ep.link_m3u8,
        behaviorHints: {
          bingeGroup: `phimapi-${slug}-${serverIndex}`
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
  console.log(`Nuvio PhimAPI v4 listening on ${PORT}`);
});
