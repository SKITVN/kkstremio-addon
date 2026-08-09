const express = require("express");

const app = express();
app.disable("x-powered-by");

const PORT = process.env.PORT || 10000;
const API_BASE = "https://phimapi.com";
const DEFAULT_IMAGE_BASE = "https://phimapi.com/uploads/movies/";

const CATALOGS = [
  { id: "phim-moi", name: "Phim Mới", type: "movie", paths: ["/v1/api/danh-sach", "/danh-sach/phim-moi-cap-nhat-v3"] },
  { id: "phim-bo", name: "Phim Bộ", type: "series", paths: ["/v1/api/danh-sach/phim-bo", "/danh-sach/phim-bo"] },
  { id: "phim-le", name: "Phim Lẻ", type: "movie", paths: ["/v1/api/danh-sach/phim-le", "/danh-sach/phim-le"] },
  { id: "phim-chieu-rap", name: "Phim Chiếu Rạp", type: "movie", paths: ["/v1/api/danh-sach/phim-chieu-rap", "/danh-sach/phim-chieu-rap"] },
  { id: "hoat-hinh", name: "Hoạt Hình", type: "series", paths: ["/v1/api/danh-sach/hoat-hinh", "/danh-sach/hoat-hinh"] }
];

const FILTERS = [
  "page", "limit", "category", "country", "year",
  "sort_field", "sort_type", "sort_lang"
];

function makeQuery(input) {
  const q = new URLSearchParams();
  for (const key of FILTERS) {
    if (input[key] !== undefined && input[key] !== "") q.set(key, String(input[key]));
  }
  if (!q.has("page")) q.set("page", "1");
  return q.toString();
}

async function fetchJson(path, query) {
  const url = `${API_BASE}${path}${query ? `?${query}` : ""}`;
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "Nuvio-PhimAPI-Final/2.0"
    }
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  return response.json();
}

function extractItems(data) {
  // v1: data.data.items
  // legacy: data.items
  return (
    data?.data?.items ||
    data?.items ||
    data?.data?.data?.items ||
    []
  );
}

function extractPathImage(data) {
  return (
    data?.data?.pathImage ||
    data?.pathImage ||
    DEFAULT_IMAGE_BASE
  );
}

function makeImage(value, pathImage) {
  if (!value) return undefined;
  const s = String(value).trim();
  if (/^https?:\/\//i.test(s)) return s;
  return `${String(pathImage || DEFAULT_IMAGE_BASE).replace(/\/+$/, "")}/${s.replace(/^\/+/, "")}`;
}

function makeMeta(item, catalog, pathImage) {
  const slug = item?.slug || item?._id;
  if (!slug) return null;

  // API normally returns full https URLs. If it returns only a filename,
  // use pathImage from the same API response.
  const poster = makeImage(
    item.poster_url || item.poster || item.thumb_url,
    pathImage
  );
  const background = makeImage(
    item.thumb_url || item.poster_url || item.poster,
    pathImage
  );

  return {
    id: `phimapi:${slug}`,
    type: catalog.type,
    name: item.name || item.origin_name || slug,
    poster,
    background,
    posterShape: "poster",
    ...(item.year ? { year: Number(item.year) } : {})
  };
}

async function getCatalogData(catalog, query) {
  let lastError;
  for (const path of catalog.paths) {
    try {
      const data = await fetchJson(path, query);
      const items = extractItems(data);
      if (Array.isArray(items) && items.length) {
        return { data, items };
      }
      // A successful empty response is still valid.
      if (Array.isArray(items)) return { data, items };
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError || new Error("No API response");
}

async function getMovie(slug) {
  const data = await fetchJson(`/v1/api/phim/${encodeURIComponent(slug)}`);
  const item = data?.data?.item || data?.movie || data?.data?.movie;
  return { data, item };
}

function serversOf(item) {
  return Array.isArray(item?.episodes) ? item.episodes : [];
}

app.get("/", (_req, res) => {
  res.type("html").send(`<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><title>PhimAPI Nuvio Addon</title>
<style>body{font-family:Arial;background:#111;color:#eee;max-width:800px;margin:50px auto;padding:20px}a{color:#67b7ff}</style>
</head><body><h1>PhimAPI Nuvio Addon</h1>
<p>Catalog + metadata + stream.</p>
<p><a href="/manifest.json">manifest.json</a></p>
<p><a href="/health">health</a></p></body></html>`);
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, addon: "vn.starskingit.phimapi", version: "2.0.0" });
});

app.get("/manifest.json", (_req, res) => {
  res.json({
    id: "vn.starskingit.phimapi",
    version: "2.0.0",
    name: "PhimAPI Việt Nam",
    description: "Phim Mới, Phim Bộ, Phim Lẻ, Phim Chiếu Rạp và Hoạt Hình từ PhimAPI.",
    logo: "https://www.google.com/s2/favicons?domain=phimapi.com&sz=128",
    resources: [
      {
        name: "catalog",
        types: ["movie", "series"],
        idPrefixes: ["phimapi:"]
      },
      {
        name: "meta",
        types: ["movie", "series"],
        idPrefixes: ["phimapi:"]
      },
      {
        name: "stream",
        types: ["movie", "series"],
        idPrefixes: ["phimapi:"]
      }
    ],
    types: ["movie", "series"],
    idPrefixes: ["phimapi:"],
    catalogs: CATALOGS.map(c => ({
      type: c.type,
      id: c.id,
      name: c.name,
      extra: [
        { name: "skip", isRequired: false },
        { name: "genre", isRequired: false }
      ]
    })),
    behaviorHints: {
      configurable: false,
      adult: false
    }
  });
});

app.get("/catalog/:type/:id.json", async (req, res) => {
  try {
    const catalog = CATALOGS.find(c => c.id === req.params.id);
    if (!catalog || catalog.type !== req.params.type) {
      return res.json({ metas: [] });
    }

    let page = Number(req.query.page);
    if (!Number.isInteger(page) || page < 1) {
      const skip = Number(req.query.skip);
      const limit = Math.min(Math.max(Number(req.query.limit) || 24, 1), 64);
      page = Number.isInteger(skip) && skip >= 0 ? Math.floor(skip / limit) + 1 : 1;
    }

    const params = { ...req.query, page };
    const query = makeQuery(params);
    const { data, items } = await getCatalogData(catalog, query);
    const pathImage = extractPathImage(data);

    const metas = items
      .map(item => makeMeta(item, catalog, pathImage))
      .filter(Boolean);

    res.set("Cache-Control", "public, max-age=120, s-maxage=120");
    res.json({ metas });
  } catch (error) {
    console.error("CATALOG ERROR", error);
    res.status(502).json({
      metas: [],
      error: "PhimAPI catalog unavailable",
      detail: error.message
    });
  }
});

app.get("/meta/:type/:id.json", async (req, res) => {
  try {
    const rawId = decodeURIComponent(req.params.id);
    const slug = rawId.replace(/^phimapi:/, "");
    const { data, item } = await getMovie(slug);

    if (!item) return res.status(404).json({ meta: null });

    const type =
      req.params.type === "series" ||
      String(item?.tmdb?.type || item?.type || "").toLowerCase() === "tv"
        ? "series"
        : "movie";

    const pathImage = data?.data?.pathImage || DEFAULT_IMAGE_BASE;

    const meta = {
      id: `phimapi:${item.slug || slug}`,
      type,
      name: item.name || item.origin_name || slug,
      poster: makeImage(item.poster_url || item.poster || item.thumb_url, pathImage),
      background: makeImage(item.thumb_url || item.poster_url || item.poster, pathImage),
      posterShape: "poster",
      description: item.content || item.origin_name || undefined,
      year: item.year ? Number(item.year) : undefined
    };

    if (Array.isArray(item.category)) {
      meta.genres = item.category.map(x => x.name || x.slug).filter(Boolean);
    }

    const videos = [];
    serversOf(item).forEach((server, si) => {
      const episodes = Array.isArray(server.server_data)
        ? server.server_data
        : Array.isArray(server.episodes)
          ? server.episodes
          : [];

      episodes.forEach((ep, ei) => {
        videos.push({
          id: `phimapi:${slug}:s${si}:e${ei}`,
          title: `${server.server_name || `Server ${si + 1}`} — ${ep.name || `Tập ${ei + 1}`}`,
          season: Number(ep.season || 1),
          episode: Number(ep.episode || ep.episode_number || ei + 1)
        });
      });
    });

    if (videos.length) meta.videos = videos;

    res.set("Cache-Control", "public, max-age=300, s-maxage=300");
    res.json({ meta });
  } catch (error) {
    console.error("META ERROR", error);
    res.status(502).json({ meta: null, error: error.message });
  }
});

app.get("/stream/:type/:id.json", async (req, res) => {
  try {
    const rawId = decodeURIComponent(req.params.id);
    const match = rawId.match(/^phimapi:(.+):s(\d+):e(\d+)$/);
    if (!match) return res.json({ streams: [] });

    const slug = match[1];
    const si = Number(match[2]);
    const ei = Number(match[3]);

    const { item } = await getMovie(slug);
    const server = serversOf(item)[si];
    if (!server) return res.json({ streams: [] });

    const episodes = Array.isArray(server.server_data)
      ? server.server_data
      : Array.isArray(server.episodes)
        ? server.episodes
        : [];

    const ep = episodes[ei];
    if (!ep) return res.json({ streams: [] });

    const serverName = server.server_name || `Server ${si + 1}`;
    const title = `${item.name || slug} — ${ep.name || `Tập ${ei + 1}`}`;
    const streams = [];

    if (ep.link_m3u8) {
      streams.push({
        name: `PhimAPI • ${serverName}`,
        title,
        url: ep.link_m3u8,
        behaviorHints: {
          bingeGroup: `phimapi-${slug}-s${si}`
        }
      });
    }

    if (ep.link_embed) {
      streams.push({
        name: `PhimAPI Embed • ${serverName}`,
        title,
        externalUrl: ep.link_embed
      });
    }

    res.set("Cache-Control", "public, max-age=60, s-maxage=60");
    res.json({ streams });
  } catch (error) {
    console.error("STREAM ERROR", error);
    res.status(502).json({ streams: [], error: error.message });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Nuvio PhimAPI addon listening on ${PORT}`);
});
