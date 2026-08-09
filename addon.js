const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");

const API = "https://phimapi.com";
const IMG = "https://phimimg.com";

const CATALOGS = [
  { id: "kkphim-new", name: "Phim mới", type: "movie" },
  { id: "kkphim-new-series", name: "Phim mới", type: "series" },
  { id: "kkphim-series", name: "Phim bộ", type: "series" },
  { id: "kkphim-movies", name: "Phim lẻ", type: "movie" },
  { id: "kkphim-theatrical", name: "Phim chiếu rạp", type: "movie" },
  { id: "kkphim-anime", name: "Hoạt hình", type: "series" },
  { id: "kkphim-anime-movie", name: "Hoạt hình", type: "movie" }
];

const manifest = {
  id: "community.kkphim.final",
  version: "5.0.0",
  name: "KKPhim",
  description: "KKPhim catalog and streams",
  logo: "https://phimimg.com/images/logo.png",
  resources: ["catalog", "meta", "stream"],
  types: ["movie", "series"],
  catalogs: CATALOGS,
  idPrefixes: ["kkp:"]
};

const builder = new addonBuilder(manifest);

async function getJson(url) {
  const r = await fetch(url, {
    headers: { "User-Agent": "KKPhim-Stremio-Addon/5.0.0" }
  });
  if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
  return r.json();
}

function absImage(value) {
  if (!value) return null;
  const s = String(value).trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith("//")) return "https:" + s;
  if (s.startsWith("/")) return IMG + s;
  if (s.startsWith("upload/")) return IMG + "/" + s;
  if (s.includes("/")) return IMG + "/" + s;
  return IMG + "/upload/vod/" + s;
}

function slugOf(id) {
  return String(id || "").replace(/^kkp:(?:movie|series):/, "");
}

function itemArray(data) {
  return Array.isArray(data?.data?.items) ? data.data.items :
         Array.isArray(data?.items) ? data.items :
         Array.isArray(data?.data) ? data.data : [];
}

function itemType(catalogId) {
  if (catalogId === "kkphim-series" || catalogId === "kkphim-new-series" || catalogId === "kkphim-anime") return "series";
  return "movie";
}

function normalize(item, type) {
  const slug = item.slug || item._id || item.id;
  if (!slug) return null;

  const poster = absImage(item.poster_url || item.thumb_url || item.poster || item.thumb);
  const id = `kkp:${type}:${slug}`;

  return {
    id,
    type,
    name: item.name || item.origin_name || slug,
    poster,
    posterShape: "poster",
    description: item.content || item.description || undefined,
    releaseInfo: item.year ? String(item.year) : undefined
  };
}

async function fetchList(path, page, params = {}) {
  const u = new URL(API + path);
  u.searchParams.set("page", String(page));
  u.searchParams.set("limit", "100");
  for (const [k,v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") u.searchParams.set(k, String(v));
  }
  return getJson(u.toString());
}

async function enrichPosters(metas) {
  // Only enrich items whose catalog image is missing/relative.
  // The normal v2/v1 list image is already converted by absImage().
  return metas;
}

builder.defineCatalogHandler(async ({ type, id, extra }) => {
  const skip = Math.max(0, Number(extra?.skip || 0));
  const pageSize = 100;
  const startPage = Math.floor(skip / pageSize) + 1;

  let path;
  switch (id) {
    case "kkphim-series":
    case "kkphim-new-series":
      path = "/v1/api/danh-sach/phim-bo";
      break;
    case "kkphim-movies":
      path = "/v1/api/danh-sach/phim-le";
      break;
    case "kkphim-theatrical":
      path = "/danh-sach/phim-chieu-rap";
      break;
    case "kkphim-anime":
    case "kkphim-anime-movie":
      path = "/v1/api/danh-sach/hoat-hinh";
      break;
    case "kkphim-new":
    case "kkphim-new-series":
    default:
      path = "/danh-sach/phim-moi-cap-nhat-v2";
      break;
  }

  let data;
  try {
    data = await fetchList(path, startPage);
  } catch (e) {
    // For v2 "new", try the alternate v1 endpoint before returning empty.
    if (path === "/danh-sach/phim-moi-cap-nhat-v2") {
      try { data = await fetchList("/v1/api/danh-sach", startPage); }
      catch (_) { throw e; }
    } else {
      throw e;
    }
  }

  let items = itemArray(data);
  const wantedType = itemType(id);

  // New and anime catalogs may contain both movies and series.
  // Split them using the API's explicit type when available; otherwise use episode_current.
  if (id === "kkphim-new" || id === "kkphim-new-series" || id === "kkphim-anime" || id === "kkphim-anime-movie") {
    items = items.filter(x => {
      const apiType = String(x.type || "").toLowerCase();
      const hasEpisodes = !!x.episode_current || !!x.episode_total || apiType === "series";
      return wantedType === "series" ? hasEpisodes : !hasEpisodes;
    });
  }

  const metas = items.map(x => normalize(x, wantedType)).filter(Boolean);
  return { metas };
});

builder.defineMetaHandler(async ({ type, id }) => {
  const slug = slugOf(id);
  const data = await getJson(`${API}/v1/api/phim/${encodeURIComponent(slug)}`);
  const item = data?.data?.item || data?.item || data?.data || {};

  const poster = absImage(item.poster_url || item.thumb_url || item.poster || item.thumb);
  const background = absImage(item.backdrop_url || item.background || item.backdrop);

  const meta = {
    id,
    type,
    name: item.name || item.origin_name || slug,
    poster,
    background,
    posterShape: "poster",
    description: item.content || item.description,
    releaseInfo: item.year ? String(item.year) : undefined,
    runtime: item.time || undefined,
    genres: Array.isArray(item.category) ? item.category.map(x => x.name || x).filter(Boolean) : undefined,
    country: Array.isArray(item.country) ? item.country.map(x => x.name || x).filter(Boolean) : undefined,
    director: Array.isArray(item.director) ? item.director.map(x => x.name || x).filter(Boolean) : undefined,
    cast: Array.isArray(item.actor) ? item.actor.map(x => x.name || x).filter(Boolean) : undefined,
    videos: []
  };

  const episodes = Array.isArray(data?.data?.episodes) ? data.data.episodes :
                   Array.isArray(data?.episodes) ? data.episodes : [];

  let season = 1;
  for (const server of episodes) {
    const serverName = server?.server_name || "KKPhim";
    const list = Array.isArray(server?.server_data) ? server.server_data : [];
    for (const ep of list) {
      const epName = ep?.name || ep?.episode_name || "";
      const epNumMatch = String(epName).match(/\d+/);
      const epNum = epNumMatch ? Number(epNumMatch[0]) : meta.videos.length + 1;
      const videoId = `${id}:s${season}:e${epNum}`;
      meta.videos.push({
        id: videoId,
        title: epName || `Tập ${epNum}`,
        season,
        episode: epNum,
        thumbnail: poster,
        overview: serverName
      });
    }
  }

  return { meta };
});

builder.defineStreamHandler(async ({ type, id }) => {
  const parts = String(id).split(":");
  const baseId = parts.slice(0, 3).join(":");
  const slug = slugOf(baseId);
  const episode = parts[3] || "";
  const data = await getJson(`${API}/v1/api/phim/${encodeURIComponent(slug)}`);
  const servers = Array.isArray(data?.data?.episodes) ? data.data.episodes :
                  Array.isArray(data?.episodes) ? data.episodes : [];

  const streams = [];
  for (const server of servers) {
    const list = Array.isArray(server?.server_data) ? server.server_data : [];
    for (const ep of list) {
      const epName = String(ep?.name || ep?.episode_name || "");
      const n = (epName.match(/\d+/) || [""])[0];
      const target = `e${n}`;
      if (!episode || episode === target) {
        const url = ep?.link_m3u8 || ep?.link_embed;
        if (url) {
          streams.push({
            name: server?.server_name || "KKPhim",
            title: epName || "Stream",
            url,
            behaviorHints: ep?.link_m3u8 ? { notWebReady: true } : {}
          });
        }
      }
    }
  }
  return { streams };
});

module.exports = { manifest, builder };
