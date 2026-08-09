const { addonBuilder } = require("stremio-addon-sdk");

const API_BASE = (process.env.KKPHIM_API_BASE || "https://phimapi.com").replace(/\/+$/, "");
/*
 * FIX: KKPhim/PhimAPI list endpoints do NOT default to 24 items/page.
 * The official docs state the default `limit` is 10 when not specified.
 * We now request PAGE_SIZE explicitly via `limit` so pages are predictable,
 * instead of assuming a size the API never guaranteed.
 */
const PAGE_SIZE = 24;          // requested explicitly via `limit` param below
const STREMIO_PAGE_SIZE = 100; // Stremio catalog pagination standard
const API_TIMEOUT_MS = 15000;
const CACHE_SECONDS = 300;
// FIX: real CDN domain for relative poster/thumb paths returned by the v1 list
// endpoints (e.g. "upload/vod/xxx.jpg"). The API itself reports this domain
// as `APP_DOMAIN_CDN_IMAGE` on v1 list responses; we fall back to this
// constant when a response doesn't carry that field.
const IMAGE_CDN_FALLBACK = "https://phimimg.com";

const manifest = {
  id: "community.kkphim",
  version: "3.1.0",
  name: "KKPhim",
  description: "KKPhim: Phim mới, Phim bộ, Phim lẻ, Phim chiếu rạp và Hoạt hình.",
  logo: "https://kkphim.com/favicon.ico",
  resources: [
    "catalog",
    { name: "meta", types: ["movie", "series"], idPrefixes: ["kkp:"] },
    { name: "stream", types: ["movie", "series"], idPrefixes: ["kkp:"] }
  ],
  types: ["movie", "series"],
  idPrefixes: ["kkp:"],
  /*
   * Stremio catalogs are typed. A mixed movie+series section therefore
   * needs one catalog entry for each type. The two entries intentionally
   * use the same human-readable name so the addon still has only the
   * requested sections: Phim mới, Phim bộ, Phim lẻ, Phim chiếu rạp, Hoạt hình.
   */
  catalogs: [
    { id: "new-movie", type: "movie", name: "KKPhim - Phim mới", extra: [{ name: "skip", isRequired: false }] },
    { id: "new-series", type: "series", name: "KKPhim - Phim mới", extra: [{ name: "skip", isRequired: false }] },
    { id: "series", type: "series", name: "KKPhim - Phim bộ", extra: [{ name: "skip", isRequired: false }] },
    { id: "movie", type: "movie", name: "KKPhim - Phim lẻ", extra: [{ name: "skip", isRequired: false }] },
    { id: "theater", type: "movie", name: "KKPhim - Phim chiếu rạp", extra: [{ name: "skip", isRequired: false }] },
    { id: "animation-movie", type: "movie", name: "KKPhim - Hoạt hình", extra: [{ name: "skip", isRequired: false }] },
    { id: "animation-series", type: "series", name: "KKPhim - Hoạt hình", extra: [{ name: "skip", isRequired: false }] }
  ]
};

const builder = new addonBuilder(manifest);

async function api(path, params = {}) {
  const url = new URL(API_BASE + path);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: {
        accept: "application/json",
        "user-agent": "KKPhim-Stremio-Addon/3.0"
      },
      signal: controller.signal
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${url.pathname}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function itemsOf(data) {
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data?.items)) return data.data.items;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

function itemOf(data) {
  return data?.movie || data?.data?.item || data?.data?.movie || data?.item || null;
}

function episodesOf(data, movie) {
  if (Array.isArray(data?.episodes)) return data.episodes;
  if (Array.isArray(data?.data?.item?.episodes)) return data.data.item.episodes;
  if (Array.isArray(movie?.episodes)) return movie.episodes;
  return [];
}

/*
 * Important pagination fix:
 * Stremio normally asks for skip=0,100,200...
 * KKPhim list endpoints return about 24 items/page.
 * If we returned only 24 items, Stremio could consider the catalog finished.
 * Therefore one Stremio page is assembled from up to five KKPhim pages.
 */
function stremioPage(extra) {
  const skip = Math.max(0, Number(extra?.skip || 0));
  const firstApiPage = Math.floor(skip / STREMIO_PAGE_SIZE) * 5 + 1;
  return { skip, firstApiPage };
}

async function getKkphimPage(endpoint, page, params = {}) {
  // FIX: explicitly request PAGE_SIZE items/page. Without `limit`, the API
  // defaults to only 10 items/page, which broke the 5-page block assumption
  // below and made catalogs (especially "Phim bộ") look empty/sparse.
  return api(endpoint, { ...params, page, limit: PAGE_SIZE });
}

function cdnBaseOf(data) {
  return data?.data?.APP_DOMAIN_CDN_IMAGE || data?.APP_DOMAIN_CDN_IMAGE || IMAGE_CDN_FALLBACK;
}

async function getKkphimBlock(endpoint, firstPage, params = {}) {
  const requests = [];
  for (let i = 0; i < 5; i++) {
    requests.push(getKkphimPage(endpoint, firstPage + i, params));
  }
  const responses = await Promise.all(requests);

  const all = [];
  for (const data of responses) {
    const cdnBase = cdnBaseOf(data);
    const pageItems = itemsOf(data);
    // FIX: tag each item with the CDN domain from ITS OWN response so
    // posterUrl() can resolve relative poster/thumb paths correctly,
    // instead of always assuming the wrong hardcoded domain.
    for (const item of pageItems) item.__cdnBase = cdnBase;
    all.push(...pageItems);

    // FIX: rely on the API's own pagination metadata to know when to stop,
    // instead of an item-count heuristic tied to a wrong assumed page size.
    const p = data?.data?.params?.pagination || data?.pagination;
    if (p && Number(p.currentPage) >= Number(p.totalPages || 0)) break;
    if (pageItems.length === 0) break;
  }

  // De-duplicate by slug/id because APIs can overlap around updates.
  const seen = new Set();
  return all.filter(item => {
    const key = item?.slug || item?._id;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, STREMIO_PAGE_SIZE);
}

function forcedPreview(item, type) {
  const slug = item?.slug || item?._id;
  return {
    id: `kkp:${type}:${slug}`,
    type,
    name: item?.name || item?.origin_name || slug,
    poster: posterUrl(item),
    posterShape: "poster",
    releaseInfo: item?.year ? String(item.year) : undefined,
    description: item?.origin_name ? `${item.origin_name}${item.year ? ` (${item.year})` : ""}` : undefined
  };
}

function mediaUrl(value) {
  if (!value) return undefined;
  const s = String(value);
  if (/^https?:\/\//i.test(s)) return s;
  return undefined;
}

/*
 * FIX: v1 list responses return only a relative path (e.g.
 * "upload/vod/20240410-1/xxx.jpg"). The real image CDN is
 * https://phimimg.com (reported by the API itself as
 * APP_DOMAIN_CDN_IMAGE), NOT https://phimapi.com/uploads/movies/ as this
 * was previously hardcoded — that wrong domain was why posters were
 * broken across catalogs. We use the per-response CDN base tagged onto
 * the item in getKkphimBlock(), falling back to the known CDN domain.
 */
function posterUrl(item) {
  const raw = item?.poster_url || item?.thumb_url;
  if (!raw) return undefined;
  if (/^https?:\/\//i.test(String(raw))) return String(raw);
  const cdnBase = item?.__cdnBase || IMAGE_CDN_FALLBACK;
  return `${cdnBase.replace(/\/+$/, "")}/${String(raw).replace(/^\/+/, "")}`;
}

async function catalog(id, type, extra) {
  const { firstApiPage } = stremioPage(extra);

  let endpoint;
  let expectedType = type;
  let params = { sort_field: "modified.time", sort_type: "desc" };

  switch (id) {
    case "new-movie":
    case "new-series":
      // User specifically requested the -v2 "Phim mới cập nhật" API.
      endpoint = "/danh-sach/phim-moi-cap-nhat-v2";
      break;

    case "series":
      endpoint = "/v1/api/danh-sach/phim-bo";
      expectedType = "series";
      break;

    case "movie":
      endpoint = "/v1/api/danh-sach/phim-le";
      expectedType = "movie";
      break;

    case "theater":
      // The v1 type list intentionally omits phim-chieu-rap in its documented
      // supported types; use the documented legacy endpoint for this catalog.
      endpoint = "/danh-sach/phim-chieu-rap";
      expectedType = "movie";
      break;

    case "animation-movie":
    case "animation-series":
      endpoint = "/v1/api/danh-sach/hoat-hinh";
      break;

    default:
      return [];
  }

  const items = await getKkphimBlock(endpoint, firstApiPage, params);

  /*
   * For dedicated movie/series endpoints, DO NOT filter using TMDB type.
   * KKPhim already classified the list. This was the main reason earlier
   * versions could return an empty "Phim bộ" catalog.
   */
  if (id === "series" || id === "movie" || id === "theater") {
    return items.map(item => forcedPreview(item, expectedType));
  }

  /*
   * FIX: "Phim mới" (new-movie / new-series) and "Hoạt hình" both come from
   * mixed endpoints containing both movies and series. The previous code
   * force-labeled EVERY item as whatever type Stremio asked for, so the
   * "new-movie" and "new-series" catalogs showed the identical list with
   * roughly half the items mislabeled. Classify conservatively instead.
   */
  return items
    .map(item => ({ item, detected: detectType(item) }))
    .filter(x => x.detected === expectedType)
    .map(x => forcedPreview(x.item, expectedType));
}

function detectType(item) {
  const tmdb = String(item?.tmdb?.type || "").toLowerCase();
  if (tmdb === "tv") return "series";
  if (tmdb === "movie") return "movie";

  const t = String(item?.type || "").toLowerCase();
  if (["series", "tv", "phim-bo", "tv-shows", "tvshow"].includes(t)) return "series";
  if (["single", "movie", "phim-le"].includes(t)) return "movie";

  const current = String(item?.episode_current || "").toLowerCase();
  const total = Number(item?.episode_total || 0);
  if (total > 1 || /tập|tap|episode|ep\.?\s*\d/.test(current)) return "series";
  return "movie";
}

builder.defineCatalogHandler(async ({ id, type, extra = {} }) => {
  try {
    const metas = await catalog(id, type, extra);
    return {
      metas: metas.map(m => Object.fromEntries(Object.entries(m).filter(([, v]) => v !== undefined))),
      cacheMaxAge: CACHE_SECONDS,
      staleRevalidate: CACHE_SECONDS * 2,
      staleError: CACHE_SECONDS * 4
    };
  } catch (error) {
    console.error(`[catalog] ${id}/${type}:`, error.message);
    return { metas: [] };
  }
});

function stripHtml(s) {
  return String(s || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .trim();
}

function imageFromResponse(data, kind) {
  const d = data?.data || data || {};
  const direct = d?.[kind] || d?.[`${kind}_url`];
  if (direct && /^https?:\/\//i.test(String(direct))) return String(direct);

  const images = Array.isArray(d?.images) ? d.images : [];
  const found = images.find(x => x?.file_path || x?.url || x?.src);
  if (found?.url || found?.src) return found.url || found.src;
  if (found?.file_path) return `https://image.tmdb.org/t/p/original${found.file_path}`;
  return undefined;
}

function youtubeId(url) {
  const m = String(url || "").match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{6,})/);
  return m?.[1];
}

function episodeNumber(ep, index) {
  const direct = Number(ep?.episode || ep?.episode_number || ep?.number);
  if (Number.isFinite(direct) && direct > 0) return direct;

  const text = `${ep?.name || ""} ${ep?.filename || ""}`;
  const m = text.match(/(?:tập|tap|episode|ep)\s*[-.]?\s*(\d+)/i);
  return m ? Number(m[1]) : index + 1;
}

function buildVideos(slug, type, episodes) {
  const videos = [];
  episodes.forEach((server, serverIndex) => {
    const serverName = server?.server_name || `Server ${serverIndex + 1}`;
    const data = Array.isArray(server?.server_data) ? server.server_data : [];

    data.forEach((ep, episodeIndex) => {
      const n = episodeNumber(ep, episodeIndex);
      const season = Number(ep?.season || 1);
      videos.push({
        id: `kkp:${type}:${slug}:s${serverIndex}:e${episodeIndex}`,
        title: type === "series"
          ? `${ep?.name || `Tập ${n}`} • ${serverName}`
          : `${serverName}${ep?.name ? ` • ${ep.name}` : ""}`,
        season,
        episode: type === "series" ? n : 1,
        overview: serverName
      });
    });
  });
  return videos;
}

async function getImages(slug) {
  try {
    return await api(`/v1/api/phim/${encodeURIComponent(slug)}/images`);
  } catch (_) {
    return null;
  }
}

builder.defineMetaHandler(async ({ id }) => {
  const match = /^kkp:(movie|series):(.+)$/.exec(String(id || ""));
  if (!match) return { meta: null };

  const type = match[1];
  const slug = match[2];

  try {
    // Use v1 detail because it contains item + episodes in the documented shape.
    const data = await api(`/v1/api/phim/${encodeURIComponent(slug)}`);
    const movie = itemOf(data);
    if (!movie) return { meta: null };

    const episodes = episodesOf(data, movie);
    const images = await getImages(slug);

    const poster =
      mediaUrl(movie.poster_url) ||
      mediaUrl(movie.thumb_url) ||
      imageFromResponse(images, "poster") ||
      posterUrl(movie);

    const background =
      imageFromResponse(images, "backdrop") ||
      mediaUrl(movie.thumb_url) ||
      poster;

    const genres = Array.isArray(movie.category) ? movie.category.map(x => x?.name).filter(Boolean) : [];
    const countries = Array.isArray(movie.country) ? movie.country.map(x => x?.name).filter(Boolean) : [];
    const directors = Array.isArray(movie.director) ? movie.director.filter(Boolean) : [];
    const cast = Array.isArray(movie.actor) ? movie.actor.filter(Boolean) : [];
    const videos = buildVideos(movie.slug || slug, type, episodes);

    const meta = {
      id: `kkp:${type}:${movie.slug || slug}`,
      type,
      name: movie.name || movie.origin_name || slug,
      poster,
      background,
      posterShape: "poster",
      description: stripHtml(movie.content || ""),
      releaseInfo: movie.year ? String(movie.year) : undefined,
      runtime: movie.time || undefined,
      genres,
      country: countries,
      director: directors,
      cast,
      imdbRating: Number(movie.imdb?.vote_average || movie.tmdb?.vote_average || 0) || undefined,
      videos,
      trailers: youtubeId(movie.trailer_url)
        ? [{ source: youtubeId(movie.trailer_url), type: "Trailer" }]
        : undefined,
      behaviorHints: videos[0] ? { defaultVideoId: videos[0].id } : undefined
    };

    return {
      meta: Object.fromEntries(Object.entries(meta).filter(([, v]) => v !== undefined)),
      cacheMaxAge: 300,
      staleRevalidate: 900,
      staleError: 1800
    };
  } catch (error) {
    console.error(`[meta] ${slug}:`, error.message);
    return { meta: null };
  }
});

function parseVideoId(id) {
  const m = /^kkp:(movie|series):(.+):s(\d+):e(\d+)$/.exec(String(id || ""));
  return m
    ? { type: m[1], slug: m[2], serverIndex: Number(m[3]), episodeIndex: Number(m[4]) }
    : null;
}

function parseMetaId(id) {
  const m = /^kkp:(movie|series):(.+)$/.exec(String(id || ""));
  return m ? { type: m[1], slug: m[2] } : null;
}

function streamObjects(movie, episodes, parsed) {
  const server = episodes[parsed.serverIndex];
  const ep = server?.server_data?.[parsed.episodeIndex];
  if (!ep) return [];

  const streams = [];

  if (ep.link_m3u8) {
    streams.push({
      name: "KKPhim",
      title: `${server.server_name || "Server"} • ${movie?.quality || "HLS"}`,
      url: ep.link_m3u8,
      behaviorHints: { bingeGroup: `kkphim-${parsed.serverIndex}` }
    });
  }

  if (ep.link_embed) {
    streams.push({
      name: "KKPhim",
      title: `${server.server_name || "Server"} • Embed`,
      externalUrl: ep.link_embed,
      behaviorHints: { notWebReady: true }
    });
  }

  return streams;
}

builder.defineStreamHandler(async ({ id }) => {
  const parsed = parseVideoId(id);

  try {
    if (!parsed) {
      const p = parseMetaId(id);
      if (!p) return { streams: [] };

      const data = await api(`/v1/api/phim/${encodeURIComponent(p.slug)}`);
      const movie = itemOf(data);
      const episodes = episodesOf(data, movie);

      for (let s = 0; s < episodes.length; s++) {
        for (let e = 0; e < (episodes[s]?.server_data || []).length; e++) {
          const streams = streamObjects(movie, episodes, { serverIndex: s, episodeIndex: e });
          if (streams.length) return { streams };
        }
      }
      return { streams: [] };
    }

    const data = await api(`/v1/api/phim/${encodeURIComponent(parsed.slug)}`);
    const movie = itemOf(data);
    const episodes = episodesOf(data, movie);

    return { streams: streamObjects(movie, episodes, parsed) };
  } catch (error) {
    console.error(`[stream] ${id}:`, error.message);
    return { streams: [] };
  }
});

module.exports = builder.getInterface();
