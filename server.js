const express = require("express");

const app = express();
app.disable("x-powered-by");

const PORT = process.env.PORT || 10000;
const API_BASE = "https://phimapi.com";
const IMAGE_BASE = "https://phimapi.com/uploads/movies/";

const CATALOGS = [
  { id: "phim-moi", name: "Phim Mới", apiType: "phim-moi", type: "movie" },
  { id: "phim-bo", name: "Phim Bộ", apiType: "phim-bo", type: "series" },
  { id: "phim-le", name: "Phim Lẻ", apiType: "phim-le", type: "movie" },
  { id: "phim-chieu-rap", name: "Phim Chiếu Rạp", apiType: "phim-chieu-rap", type: "movie" },
  { id: "hoat-hinh", name: "Hoạt Hình", apiType: "hoat-hinh", type: "series" }
];

const ALLOWED_PARAMS = [
  "page", "limit", "category", "country", "year",
  "sort_field", "sort_type", "sort_lang"
];

function queryString(input) {
  const q = new URLSearchParams();
  for (const key of ALLOWED_PARAMS) {
    if (input[key] !== undefined && input[key] !== "") {
      q.set(key, String(input[key]));
    }
  }
  if (!q.has("page")) q.set("page", "1");
  return q.toString();
}

function imageUrl(value, pathImage) {
  if (!value) return undefined;
  if (/^https?:\/\//i.test(value)) return value;
  const base = pathImage || IMAGE_BASE;
  return `${String(base).replace(/\/$/, "")}/${String(value).replace(/^\//, "")}`;
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "Nuvio-PhimAPI-Addon/1.2"
    }
  });
  if (!response.ok) throw new Error(`PhimAPI HTTP ${response.status}`);
  return response.json();
}

function normalizeItem(item, catalog) {
  const slug = item.slug || item._id;
  if (!slug) return null;

  const typeText = String(item.type || "").toLowerCase();
  const type =
    typeText === "tv" ||
    typeText === "series" ||
    catalog.type === "series"
      ? "series"
      : "movie";

  return {
    id: `phimapi:${slug}`,
    type,
    name: item.name || item.origin_name || slug,
    poster: imageUrl(item.poster_url || item.poster || item.thumb_url),
    background: imageUrl(item.thumb_url || item.poster_url),
    posterShape: "poster",
    year: item.year ? Number(item.year) : undefined
  };
}

app.get("/", (_req, res) => {
  res.type("html").send(`
<!doctype html><html lang="vi"><head><meta charset="utf-8">
<title>PhimAPI Nuvio Addon</title>
<style>
body{font-family:Arial,sans-serif;background:#111;color:#eee;max-width:800px;margin:50px auto;padding:20px}
a{color:#6db3ff}.box{padding:20px;background:#1d1d1d;border-radius:10px}
</style></head><body>
<h1>PhimAPI Nuvio Addon</h1>
<div class="box">
<p>Addon đang hoạt động.</p>
<p><a href="/manifest.json">manifest.json</a></p>
<p><a href="/health">health</a></p>
</div></body></html>`);
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, addon: "nuvio-phimapi-addon", version: "1.2.0" });
});

app.get("/manifest.json", (_req, res) => {
  res.json({
    id: "vn.starskingit.phimapi",
    version: "1.2.0",
    name: "PhimAPI Việt Nam",
    description: "Addon Nuvio/Stremio: Phim Mới, Phim Bộ, Phim Lẻ, Phim Chiếu Rạp, Hoạt Hình.",
    logo: "https://www.google.com/s2/favicons?domain=phimapi.com&sz=128",
    resources: ["catalog", "meta", "stream"],
    types: ["movie", "series"],
    idPrefixes: ["phimapi:"],
    catalogs: CATALOGS.map(c => ({
      type: c.type,
      id: c.id,
      name: c.name,
      extra: [{ name: "skip", isRequired: false }]
    }))
  });
});

app.get("/catalog/:type/:id.json", async (req, res) => {
  try {
    const catalog = CATALOGS.find(c => c.id === req.params.id);
    if (!catalog) return res.status(404).json({ metas: [] });

    const qs = queryString(req.query);
    const endpoint =
      catalog.apiType === "phim-moi"
        ? `${API_BASE}/v1/api/danh-sach?${qs}`
        : `${API_BASE}/v1/api/danh-sach/${catalog.apiType}?${qs}`;

    const data = await fetchJson(endpoint);
    const items =
      data?.data?.items ||
      data?.items ||
      [];

    const pathImage =
      data?.data?.pathImage ||
      data?.pathImage ||
      IMAGE_BASE;

    const metas = items
      .map(item => {
        const meta = normalizeItem(item, catalog);
        if (meta) {
          meta.poster = imageUrl(
            item.poster_url || item.poster || item.thumb_url,
            pathImage
          );
          meta.background = imageUrl(
            item.thumb_url || item.poster_url,
            pathImage
          );
        }
        return meta;
      })
      .filter(Boolean);

    res.set("Cache-Control", "public, max-age=300");
    res.json({ metas });
  } catch (error) {
    console.error("CATALOG ERROR:", error);
    res.status(502).json({ metas: [], error: error.message });
  }
});

async function getMovie(slug) {
  const data = await fetchJson(
    `${API_BASE}/v1/api/phim/${encodeURIComponent(slug)}`
  );
  return {
    data,
    item: data?.data?.item || data?.movie || data?.data?.movie
  };
}

function getServers(item) {
  return Array.isArray(item?.episodes) ? item.episodes : [];
}

app.get("/meta/:type/:id.json", async (req, res) => {
  try {
    const raw = decodeURIComponent(req.params.id);
    const slug = raw.replace(/^phimapi:/, "");
    const { data, item } = await getMovie(slug);

    if (!item) return res.status(404).json({ meta: null });

    const type =
      req.params.type === "series" ||
      ["tv", "series"].includes(String(item.type || "").toLowerCase())
        ? "series"
        : "movie";

    const pathImage = data?.data?.pathImage || data?.pathImage || IMAGE_BASE;

    const meta = {
      id: `phimapi:${item.slug || slug}`,
      type,
      name: item.name || item.origin_name || slug,
      poster: imageUrl(item.poster_url || item.poster || item.thumb_url, pathImage),
      background: imageUrl(item.thumb_url || item.poster_url, pathImage),
      posterShape: "poster",
      description: item.content || item.origin_name || undefined,
      year: item.year ? Number(item.year) : undefined
    };

    if (Array.isArray(item.category)) {
      meta.genres = item.category.map(x => x.name || x.slug).filter(Boolean);
    }

    const videos = [];
    const servers = getServers(item);

    servers.forEach((server, si) => {
      const eps = Array.isArray(server.server_data)
        ? server.server_data
        : Array.isArray(server.episodes)
          ? server.episodes
          : [];

      eps.forEach((ep, ei) => {
        videos.push({
          id: `phimapi:${slug}:s${si}:e${ei}`,
          title: `${server.server_name || `Server ${si + 1}`} — ${ep.name || `Tập ${ei + 1}`}`,
          season: 1,
          episode: Number(ep.episode || ep.episode_number || ei + 1)
        });
      });
    });

    if (videos.length) meta.videos = videos;

    res.set("Cache-Control", "public, max-age=300");
    res.json({ meta });
  } catch (error) {
    console.error("META ERROR:", error);
    res.status(502).json({ meta: null, error: error.message });
  }
});

app.get("/stream/:type/:id.json", async (req, res) => {
  try {
    const raw = decodeURIComponent(req.params.id);
    const match = raw.match(/^phimapi:(.+):s(\d+):e(\d+)$/);

    if (!match) return res.status(400).json({ streams: [] });

    const slug = match[1];
    const serverIndex = Number(match[2]);
    const episodeIndex = Number(match[3]);

    const { item } = await getMovie(slug);
    if (!item) return res.status(404).json({ streams: [] });

    const servers = getServers(item);
    const server = servers[serverIndex];
    if (!server) return res.status(404).json({ streams: [] });

    const eps = Array.isArray(server.server_data)
      ? server.server_data
      : Array.isArray(server.episodes)
        ? server.episodes
        : [];

    const ep = eps[episodeIndex];
    if (!ep) return res.status(404).json({ streams: [] });

    const serverName = server.server_name || `Server ${serverIndex + 1}`;
    const title = `${item.name || slug} — ${ep.name || `Tập ${episodeIndex + 1}`}`;
    const streams = [];

    if (ep.link_m3u8) {
      streams.push({
        name: `PhimAPI • ${serverName}`,
        title,
        url: ep.link_m3u8,
        behaviorHints: {
          bingeGroup: `phimapi-${slug}-${serverIndex}`
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

    res.set("Cache-Control", "public, max-age=60");
    res.json({ streams });
  } catch (error) {
    console.error("STREAM ERROR:", error);
    res.status(502).json({ streams: [], error: error.message });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`PhimAPI Nuvio Addon listening on port ${PORT}`);
});
