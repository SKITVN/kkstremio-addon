const express = require("express");

const app = express();
app.disable("x-powered-by");

const PORT = process.env.PORT || 10000;
const API_BASE = "https://phimapi.com";
const IMAGE_BASE = "https://phimapi.com/uploads/movies/";

const CATALOGS = [
  {
    id: "phim-moi",
    name: "Phim Mới",
    type: "movie",
    endpoint: "/danh-sach/phim-moi-cap-nhat"
  },
  {
    id: "phim-bo",
    name: "Phim Bộ",
    type: "series",
    endpoint: "/danh-sach/phim-bo"
  },
  {
    id: "phim-le",
    name: "Phim Lẻ",
    type: "movie",
    endpoint: "/danh-sach/phim-le"
  },
  {
    id: "phim-chieu-rap",
    name: "Phim Chiếu Rạp",
    type: "movie",
    endpoint: "/danh-sach/phim-chieu-rap"
  },
  {
    id: "hoat-hinh",
    name: "Hoạt Hình",
    type: "series",
    endpoint: "/danh-sach/hoat-hinh"
  }
];

const FILTERS = [
  "page", "category", "country", "year",
  "sort_field", "sort_type", "sort_lang"
];

function normalizePage(query) {
  const explicitPage = Number(query.page);
  if (Number.isInteger(explicitPage) && explicitPage >= 1) return explicitPage;

  const skip = Number(query.skip);
  const limit = Number(query.limit) || 24;

  if (Number.isInteger(skip) && skip >= 0) {
    return Math.floor(skip / Math.max(limit, 1)) + 1;
  }

  return 1;
}

function makeQuery(query) {
  const params = new URLSearchParams();
  params.set("page", String(normalizePage(query)));

  for (const key of FILTERS) {
    if (key === "page") continue;
    if (query[key] !== undefined && query[key] !== "") {
      params.set(key, String(query[key]));
    }
  }

  return params.toString();
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "Mozilla/5.0 Nuvio-PhimAPI-Addon/3.0"
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${url}`);
  }

  return response.json();
}

function extractItems(data) {
  return (
    data?.items ||
    data?.data?.items ||
    data?.data?.data?.items ||
    []
  );
}

function extractPathImage(data) {
  return (
    data?.pathImage ||
    data?.data?.pathImage ||
    IMAGE_BASE
  );
}

function absoluteImage(value, pathImage) {
  if (!value) return null;

  const s = String(value).trim();

  if (/^https?:\/\//i.test(s)) {
    return s;
  }

  return `${String(pathImage || IMAGE_BASE).replace(/\/+$/, "")}/${s.replace(/^\/+/, "")}`;
}

/*
 * Use our own image proxy in the poster URL.
 * This avoids Nuvio/Stremio being blocked by phimimg.com/phimapi.com
 * hotlink/CDN differences.
 */
function proxiedImage(value, pathImage) {
  const absolute = absoluteImage(value, pathImage);
  if (!absolute) return null;

  return `/image?url=${encodeURIComponent(absolute)}`;
}

async function getCatalog(catalog, query) {
  const qs = makeQuery(query);
  const url = `${API_BASE}${catalog.endpoint}?${qs}`;
  const data = await fetchJson(url);
  const items = extractItems(data);
  const pathImage = extractPathImage(data);

  return {
    items: Array.isArray(items) ? items : [],
    pathImage,
    pagination:
      data?.pagination ||
      data?.data?.pagination ||
      data?.data?.params?.pagination ||
      null
  };
}

function catalogMeta(item, catalog, pathImage) {
  const slug = item?.slug || item?._id;
  if (!slug) return null;

  const posterValue =
    item.poster_url ||
    item.poster ||
    item.thumb_url;

  const backgroundValue =
    item.thumb_url ||
    item.poster_url ||
    item.poster;

  return {
    id: `phimapi:${slug}`,
    type: catalog.type,
    name: item.name || item.origin_name || slug,
    poster: proxiedImage(posterValue, pathImage),
    background: proxiedImage(backgroundValue, pathImage),
    posterShape: "poster",
    ...(item.year ? { year: Number(item.year) } : {})
  };
}

async function getMovie(slug) {
  const url = `${API_BASE}/v1/api/phim/${encodeURIComponent(slug)}`;
  const data = await fetchJson(url);

  return {
    data,
    item:
      data?.data?.item ||
      data?.movie ||
      data?.data?.movie
  };
}

function getServers(item) {
  return Array.isArray(item?.episodes) ? item.episodes : [];
}

/* Homepage */
app.get("/", (_req, res) => {
  res.type("html").send(`<!doctype html>
<html lang="vi">
<head><meta charset="utf-8"><title>PhimAPI Nuvio Addon</title>
<style>
body{font-family:Arial;background:#111;color:#eee;max-width:850px;margin:50px auto;padding:25px}
a{color:#6db5ff}
li{margin:10px 0}
</style></head>
<body>
<h1>PhimAPI Nuvio Addon v3</h1>
<ul>
<li><a href="/health">Health</a></li>
<li><a href="/manifest.json">Manifest</a></li>
<li><a href="/catalog/movie/phim-moi.json">Test Phim Mới</a></li>
<li><a href="/catalog/series/phim-bo.json">Test Phim Bộ</a></li>
<li><a href="/catalog/movie/phim-le.json">Test Phim Lẻ</a></li>
<li><a href="/catalog/movie/phim-chieu-rap.json">Test Phim Chiếu Rạp</a></li>
<li><a href="/catalog/series/hoat-hinh.json">Test Hoạt Hình</a></li>
</ul>
</body>
</html>`);
});

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    addon: "vn.starskingit.phimapi",
    version: "3.0.0"
  });
});

/* Image proxy */
app.get("/image", async (req, res) => {
  try {
    const target = String(req.query.url || "");

    if (!/^https?:\/\//i.test(target)) {
      return res.status(400).end();
    }

    const allowed = [
      "phimapi.com",
      "phimimg.com",
      "img.phimapi.com",
      "img.phimimg.com"
    ];

    const parsed = new URL(target);
    const host = parsed.hostname.toLowerCase();

    if (!allowed.some(domain => host === domain || host.endsWith(`.${domain}`))) {
      return res.status(403).end();
    }

    const response = await fetch(target, {
      headers: {
        accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "user-agent": "Mozilla/5.0"
      }
    });

    if (!response.ok) {
      return res.status(response.status).end();
    }

    const contentType =
      response.headers.get("content-type") || "image/jpeg";

    const buffer = Buffer.from(await response.arrayBuffer());

    res.set("Content-Type", contentType);
    res.set("Cache-Control", "public, max-age=86400, s-maxage=86400");
    res.send(buffer);
  } catch (error) {
    console.error("IMAGE ERROR", error);
    res.status(502).end();
  }
});

/* Manifest */
app.get("/manifest.json", (_req, res) => {
  res.json({
    id: "vn.starskingit.phimapi",
    version: "3.0.0",
    name: "PhimAPI Việt Nam",
    description:
      "Phim Mới, Phim Bộ, Phim Lẻ, Phim Chiếu Rạp, Hoạt Hình.",
    logo: "https://www.google.com/s2/favicons?domain=phimapi.com&sz=128",

    resources: [
      "catalog",
      "meta",
      "stream"
    ],

    types: ["movie", "series"],
    idPrefixes: ["phimapi:"],

    catalogs: CATALOGS.map(c => ({
      type: c.type,
      id: c.id,
      name: c.name,
      extra: [
        { name: "skip", isRequired: false },
        { name: "search", isRequired: false }
      ]
    }))
  });
});

/* Catalog */
app.get("/catalog/:type/:id.json", async (req, res) => {
  try {
    const catalog = CATALOGS.find(c => c.id === req.params.id);

    if (!catalog || catalog.type !== req.params.type) {
      return res.json({ metas: [] });
    }

    const { items, pathImage, pagination } =
      await getCatalog(catalog, req.query);

    const metas = items
      .map(item => catalogMeta(item, catalog, pathImage))
      .filter(Boolean);

    res.set("Cache-Control", "public, max-age=120, s-maxage=120");

    res.json({
      metas,
      // Extra diagnostic information is ignored by Nuvio but useful for testing.
      pagination
    });
  } catch (error) {
    console.error("CATALOG ERROR", error);

    res.status(502).json({
      metas: [],
      error: error.message
    });
  }
});

/* Metadata */
app.get("/meta/:type/:id.json", async (req, res) => {
  try {
    const rawId = decodeURIComponent(req.params.id);
    const slug = rawId.replace(/^phimapi:/, "");

    const { data, item } = await getMovie(slug);

    if (!item) {
      return res.status(404).json({ meta: null });
    }

    const pathImage =
      data?.data?.pathImage ||
      data?.pathImage ||
      IMAGE_BASE;

    const itemType =
      String(item?.tmdb?.type || item?.type || "").toLowerCase();

    const type =
      itemType === "tv" ||
      itemType === "series" ||
      req.params.type === "series"
        ? "series"
        : "movie";

    const posterValue =
      item.poster_url ||
      item.poster ||
      item.thumb_url;

    const backgroundValue =
      item.thumb_url ||
      item.poster_url ||
      item.poster;

    const meta = {
      id: `phimapi:${item.slug || slug}`,
      type,
      name: item.name || item.origin_name || slug,
      poster: proxiedImage(posterValue, pathImage),
      background: proxiedImage(backgroundValue, pathImage),
      posterShape: "poster",
      description:
        item.content ||
        item.description ||
        item.origin_name ||
        undefined,
      ...(item.year ? { year: Number(item.year) } : {})
    };

    if (Array.isArray(item.category)) {
      meta.genres = item.category
        .map(x => x?.name || x?.slug)
        .filter(Boolean);
    }

    const videos = [];
    const servers = getServers(item);

    servers.forEach((server, serverIndex) => {
      const episodes =
        Array.isArray(server?.server_data)
          ? server.server_data
          : Array.isArray(server?.episodes)
            ? server.episodes
            : [];

      episodes.forEach((ep, episodeIndex) => {
        videos.push({
          id: `phimapi:${slug}:s${serverIndex}:e${episodeIndex}`,
          title:
            `${server?.server_name || `Server ${serverIndex + 1}`} — ` +
            `${ep?.name || `Tập ${episodeIndex + 1}`}`,
          season: Number(ep?.season || 1),
          episode: Number(
            ep?.episode ||
            ep?.episode_number ||
            episodeIndex + 1
          )
        });
      });
    });

    if (videos.length > 0) {
      meta.videos = videos;
    }

    res.set("Cache-Control", "public, max-age=300, s-maxage=300");
    res.json({ meta });
  } catch (error) {
    console.error("META ERROR", error);
    res.status(502).json({
      meta: null,
      error: error.message
    });
  }
});

/* Stream */
app.get("/stream/:type/:id.json", async (req, res) => {
  try {
    const rawId = decodeURIComponent(req.params.id);
    const match =
      rawId.match(/^phimapi:(.+):s(\d+):e(\d+)$/);

    if (!match) {
      return res.json({ streams: [] });
    }

    const slug = match[1];
    const serverIndex = Number(match[2]);
    const episodeIndex = Number(match[3]);

    const { item } = await getMovie(slug);
    const server = getServers(item)[serverIndex];

    if (!server) {
      return res.json({ streams: [] });
    }

    const episodes =
      Array.isArray(server.server_data)
        ? server.server_data
        : Array.isArray(server.episodes)
          ? server.episodes
          : [];

    const episode = episodes[episodeIndex];

    if (!episode) {
      return res.json({ streams: [] });
    }

    const serverName =
      server.server_name || `Server ${serverIndex + 1}`;

    const title =
      `${item.name || slug} — ` +
      `${episode.name || `Tập ${episodeIndex + 1}`}`;

    const streams = [];

    if (episode.link_m3u8) {
      streams.push({
        name: `PhimAPI • ${serverName}`,
        title,
        url: episode.link_m3u8,
        behaviorHints: {
          bingeGroup:
            `phimapi-${slug}-s${serverIndex}`
        }
      });
    }

    if (episode.link_embed) {
      streams.push({
        name: `PhimAPI Embed • ${serverName}`,
        title,
        externalUrl: episode.link_embed
      });
    }

    res.set("Cache-Control", "public, max-age=60, s-maxage=60");
    res.json({ streams });
  } catch (error) {
    console.error("STREAM ERROR", error);
    res.status(502).json({
      streams: [],
      error: error.message
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `PhimAPI Nuvio Addon v3 listening on port ${PORT}`
  );
});
