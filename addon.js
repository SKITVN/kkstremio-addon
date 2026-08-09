const { addonBuilder } = require("stremio-addon-sdk");

const API_BASE = (process.env.KKPHIM_API_BASE || "https://phimapi.com").replace(/\/+$/, "");
const CACHE_SECONDS = Number(process.env.CACHE_SECONDS || 300);
const PAGE_SIZE = Math.min(Number(process.env.PAGE_SIZE || 24), 64);

const TYPE_MAP = {
  "movie": "movie",
  "phim-le": "movie",
  "phim-chieu-rap": "movie",
  "phim-bo": "series",
  "tv-shows": "series"
};

const CATALOGS = [
  { id: "new", type: "movie", name: "KKPhim - Phim mới" },
  { id: "series", type: "series", name: "KKPhim - Phim bộ" },
  { id: "movies", type: "movie", name: "KKPhim - Phim lẻ" },
  { id: "animation-movie", type: "movie", name: "KKPhim - Hoạt hình (phim)" },
  { id: "animation-series", type: "series", name: "KKPhim - Hoạt hình (series)" },
  { id: "donghua-movie", type: "movie", name: "KKPhim - Hoạt hình Trung Quốc" },
  { id: "donghua-series", type: "series", name: "KKPhim - Hoạt hình Trung Quốc" },
  { id: "theater", type: "movie", name: "KKPhim - Chiếu rạp" },
  { id: "vietsub-movie", type: "movie", name: "KKPhim - Vietsub" },
  { id: "vietsub-series", type: "series", name: "KKPhim - Vietsub" },
  { id: "thuyet-minh-movie", type: "movie", name: "KKPhim - Thuyết minh" },
  { id: "thuyet-minh-series", type: "series", name: "KKPhim - Thuyết minh" },
  { id: "long-tieng-movie", type: "movie", name: "KKPhim - Lồng tiếng" },
  { id: "long-tieng-series", type: "series", name: "KKPhim - Lồng tiếng" },
  {
    id: "search-movie",
    type: "movie",
    name: "KKPhim - Tìm kiếm",
    extra: [{ name: "search", isRequired: true }]
  },
  {
    id: "search-series",
    type: "series",
    name: "KKPhim - Tìm kiếm",
    extra: [{ name: "search", isRequired: true }]
  }
];

const manifest = {
  id: "community.kkphim",
  version: "1.3.0",
  name: "KKPhim",
  description: "Catalog, metadata và stream từ API KKPhim/PhimAPI.",
  logo: "https://kkphim.com/favicon.ico",
  resources: [
    "catalog",
    { name: "meta", types: ["movie", "series"], idPrefixes: ["kkp:"] },
    { name: "stream", types: ["movie", "series"], idPrefixes: ["kkp:"] }
  ],
  types: ["movie", "series"],
  idPrefixes: ["kkp:"],
  catalogs: CATALOGS.map(c => c.extra ? c : { ...c, extra: [{ name: "skip" }] }),
  behaviorHints: {
    configurable: false
  }
};

const builder = new addonBuilder(manifest);

async function api(path, params = {}) {
  const url = new URL(API_BASE + path);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch(url, {
      headers: { accept: "application/json", "user-agent": "KKPhim-Stremio-Addon/1.0" },
      signal: controller.signal
    });

    if (!res.ok) {
      throw new Error(`KKPhim API HTTP ${res.status}`);
    }

    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

function unwrapItems(data) {
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data?.items)) return data.data.items;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

function unwrapMovie(data) {
  return data?.movie || data?.data?.item || data?.data?.movie || data?.item || null;
}

function unwrapEpisodes(data, movie) {
  if (Array.isArray(data?.episodes)) return data.episodes;
  if (Array.isArray(data?.data?.item?.episodes)) return data.data.item.episodes;
  if (Array.isArray(data?.data?.episodes)) return data.data.episodes;
  if (Array.isArray(movie?.episodes)) return movie.episodes;
  return [];
}

function imageUrl(movie, field) {
  const value = movie?.[field];
  if (!value) return undefined;
  if (/^https?:\/\//i.test(value)) return value;

  // v1 endpoints return relative paths such as upload/vod/... .
  // The media host is phimimg.com; using phimapi.com/uploads/movies here
  // produces broken poster URLs in Stremio.
  const clean = String(value).replace(/^\/+/, "");
  return `https://phimimg.com/${clean}`;
}

function tmdbImage(path, size = "original") {
  if (!path) return undefined;
  if (/^https?:\/\//i.test(path)) return path;
  return `https://image.tmdb.org/t/p/${size}/${String(path).replace(/^\/+/, "")}`;
}

function imageFromImagesResponse(data, kind = "poster") {
  const d = data?.data || data || {};
  const sizes = d?.image_sizes?.[kind] || {};
  const images = Array.isArray(d?.images) ? d.images : [];
  const first = images.find(x => x?.file_path || x?.url || x?.src);
  if (first?.url || first?.src) return first.url || first.src;
  if (first?.file_path) return tmdbImage(first.file_path, sizes.original ? "original" : "w780");
  return undefined;
}

function contentType(item) {
  if (item?.tmdb?.type === "tv") return "series";
  if (item?.tmdb?.type === "movie") return "movie";
  if (TYPE_MAP[item?.type]) return TYPE_MAP[item.type];

  const total = Number(item?.episode_total || 0);
  if (total > 1) return "series";

  return "movie";
}

function catalogMeta(item) {
  const type = contentType(item);
  const id = `kkp:${item.slug || item._id}`;

  const meta = {
    id,
    type,
    name: item.name || item.origin_name || item.slug,
    poster: imageUrl(item, "poster_url") || imageUrl(item, "thumb_url"),
    posterShape: "poster",
    releaseInfo: item.year ? String(item.year) : undefined,
    description: item.origin_name ? `${item.origin_name}${item.year ? ` (${item.year})` : ""}` : undefined
  };

  if (item.tmdb?.vote_average) {
    meta.imdbRating = Number(item.tmdb.vote_average);
  }

  return Object.fromEntries(Object.entries(meta).filter(([, v]) => v !== undefined));
}

function parseCatalogPage(args) {
  const extra = args.extra || {};
  const skip = Math.max(0, Number(extra.skip || 0));
  const page = Math.floor(skip / PAGE_SIZE) + 1;
  return { page, extra };
}

async function resolveCatalogPoster(item) {
  const poster = imageUrl(item, "poster_url") || imageUrl(item, "thumb_url");
  if (poster && /^https?:\/\//i.test(item?.poster_url || item?.thumb_url || "")) return poster;

  // v1 list responses may contain only a filename. The legacy detail GET
  // returns the canonical https://phimimg.com/... URL, so use it as a
  // fallback for Stremio catalog cards.
  if (item?.slug) {
    try {
      const detail = await api(`/phim/${encodeURIComponent(item.slug)}`);
      const movie = unwrapMovie(detail);
      const resolved = imageUrl(movie, "poster_url") || imageUrl(movie, "thumb_url");
      if (resolved) return resolved;
    } catch (_) {}
  }
  return poster;
}

async function catalogMetaResolved(item) {
  const meta = catalogMeta(item);
  if (!meta.poster || !/^https?:\/\//.test(meta.poster) || /phimimg\.com\/$/.test(meta.poster)) {
    const poster = await resolveCatalogPoster(item);
    if (poster) meta.poster = poster;
  }
  return meta;
}

async function mapWithConcurrency(items, limit, fn) {
  const result = new Array(items.length);
  let next = 0;
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      result[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return result;
}

function listConfig(catalogId) {
  switch (catalogId) {
    // Use the current v1 endpoints. The legacy /danh-sach/{type}
    // currently exposes only a small subset (for example, the docs show
    // phim-bo with 16 items), which is why the previous addon appeared
    // to have very few movies.
    case "series": return { path: "/v1/api/danh-sach/phim-bo", expected: "series" };
    case "movies": return { path: "/v1/api/danh-sach/phim-le", expected: "movie" };
    case "animation-movie": return { path: "/v1/api/danh-sach/hoat-hinh", expected: "movie" };
    case "animation-series": return { path: "/v1/api/danh-sach/hoat-hinh", expected: "series" };
    case "donghua-movie": return { path: "/v1/api/danh-sach/hoat-hinh", country: "trung-quoc", expected: "movie" };
    case "donghua-series": return { path: "/v1/api/danh-sach/hoat-hinh", country: "trung-quoc", expected: "series" };
    case "theater": return { path: "/v1/api/danh-sach/phim-chieu-rap", expected: "movie" };
    case "vietsub-movie": return { path: "/v1/api/danh-sach", sort_lang: "vietsub", expected: "movie" };
    case "vietsub-series": return { path: "/v1/api/danh-sach", sort_lang: "vietsub", expected: "series" };
    case "thuyet-minh-movie": return { path: "/v1/api/danh-sach", sort_lang: "thuyet-minh", expected: "movie" };
    case "thuyet-minh-series": return { path: "/v1/api/danh-sach", sort_lang: "thuyet-minh", expected: "series" };
    case "long-tieng-movie": return { path: "/v1/api/danh-sach", sort_lang: "long-tieng", expected: "movie" };
    case "long-tieng-series": return { path: "/v1/api/danh-sach", sort_lang: "long-tieng", expected: "series" };
    case "new":
    default: return { path: "/v1/api/danh-sach" };
  }
}

builder.defineCatalogHandler(async (args) => {
  const catalogId = args.id;
  const { page, extra } = parseCatalogPage(args);

  try {
    if (catalogId === "search-movie" || catalogId === "search-series") {
      const keyword = String(extra.search || "").trim();
      if (!keyword) return { metas: [] };

      const data = await api("/v1/api/tim-kiem", {
        keyword,
        page,
        limit: PAGE_SIZE,
        sort_field: "modified.time",
        sort_type: "desc"
      });

      const filtered = unwrapItems(data)
        .filter((item) => contentType(item) === args.type);

      const metas = await mapWithConcurrency(
        filtered,
        6,
        catalogMetaResolved
      );

      return {
        metas,
        cacheMaxAge: 120,
        staleRevalidate: 600
      };
    }

    const cfg = listConfig(catalogId);
    const data = await api(cfg.path, {
      page,
      limit: PAGE_SIZE,
      sort_field: "modified.time",
      sort_type: "desc",
      sort_lang: cfg.sort_lang,
      country: cfg.country,
      category: cfg.category
    });

    const filtered = unwrapItems(data)
      .filter((item) => !cfg.expected || contentType(item) === cfg.expected)
      .filter((item) => contentType(item) === args.type);

    const metas = await mapWithConcurrency(
      filtered,
      6,
      catalogMetaResolved
    );

    return {
      metas,
      cacheMaxAge: CACHE_SECONDS,
      staleRevalidate: CACHE_SECONDS * 2
    };
  } catch (error) {
    console.error("catalog:", error);
    return { metas: [] };
  }
});

function buildVideos(slug, type, episodes) {
  const videos = [];

  episodes.forEach((server, serverIndex) => {
    const serverName = server?.server_name || `Server ${serverIndex + 1}`;
    const data = Array.isArray(server?.server_data) ? server.server_data : [];

    data.forEach((episode, episodeIndex) => {
      const season = Number(episode?.season || 1);
      const episodeNumber = Number(
        episode?.episode ||
        episode?.episode_number ||
        episode?.number ||
        episodeIndex + 1
      );

      const id = type === "series"
        ? `kkp:${slug}:s${serverIndex}:e${episodeIndex}`
        : `kkp:${slug}:s${serverIndex}:e${episodeIndex}`;

      videos.push({
        id,
        title: episode?.name || episode?.filename || `Tập ${episodeIndex + 1}`,
        season,
        episode: type === "series" ? episodeNumber : undefined,
        released: undefined,
        thumbnail: undefined,
        overview: serverName
      });
    });
  });

  return videos.map(v => Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined)));
}

builder.defineMetaHandler(async (args) => {
  const id = String(args.id || "");
  if (!id.startsWith("kkp:")) return { meta: null };

  const slug = id.slice(4);
  if (!slug) return { meta: null };

  try {
    const data = await api(`/v1/api/phim/${encodeURIComponent(slug)}`);
    const movie = unwrapMovie(data);

    if (!movie) return { meta: null };

    const type = contentType(movie);
    const episodes = unwrapEpisodes(data, movie);

    // Use the dedicated v1 GET endpoints as enrichment/fallbacks.
    // They are intentionally fetched in parallel so metadata loading stays fast.
    const [imagesData, peopleData, keywordsData] = await Promise.allSettled([
      api(`/v1/api/phim/${encodeURIComponent(slug)}/images`),
      api(`/v1/api/phim/${encodeURIComponent(slug)}/peoples`),
      api(`/v1/api/phim/${encodeURIComponent(slug)}/keywords`)
    ]);

    const posterFromApi = imagesData.status === "fulfilled" ? imageFromImagesResponse(imagesData.value, "poster") : undefined;
    const backdropFromApi = imagesData.status === "fulfilled" ? imageFromImagesResponse(imagesData.value, "backdrop") : undefined;
    const people = peopleData.status === "fulfilled" ? (peopleData.value?.data || peopleData.value) : null;
    const keywordData = keywordsData.status === "fulfilled" ? (keywordsData.value?.data || keywordsData.value) : null;

    const enrichedCast = Array.isArray(movie.actor) ? movie.actor :
      (Array.isArray(people?.cast) ? people.cast.map(x => x.name || x.original_name).filter(Boolean) : []);
    const enrichedDirector = Array.isArray(movie.director) ? movie.director :
      (Array.isArray(people?.crew) ? people.crew.filter(x => String(x.job || "").toLowerCase() === "director").map(x => x.name).filter(Boolean) : []);

    const genres = Array.isArray(movie.category)
      ? movie.category.map(x => x.name).filter(Boolean)
      : [];

    const countries = Array.isArray(movie.country)
      ? movie.country.map(x => x.name).filter(Boolean)
      : [];

    const meta = {
      id: `kkp:${movie.slug || slug}`,
      type,
      name: movie.name || movie.origin_name || slug,
      poster: imageUrl(movie, "poster_url") || imageUrl(movie, "thumb_url") || posterFromApi,
      background: backdropFromApi || imageUrl(movie, "thumb_url") || imageUrl(movie, "poster_url"),
      logo: imageUrl(movie, "poster_url") || posterFromApi,
      posterShape: "poster",
      description: stripHtml(movie.content || ""),
      releaseInfo: movie.year ? String(movie.year) : undefined,
      runtime: movie.time,
      genres,
      country: countries,
      director: enrichedDirector,
      cast: enrichedCast,
      imdbRating: movie.imdb?.vote_average || movie.tmdb?.vote_average || undefined,
      // Keep keywords when the dedicated endpoint provides them.
      tags: Array.isArray(keywordData?.keywords)
        ? keywordData.keywords.map(x => typeof x === "string" ? x : x?.name).filter(Boolean)
        : undefined,
      videos: buildVideos(movie.slug || slug, type, episodes)
    };

    if (movie.trailer_url) {
      meta.trailerStreams = [{ ytId: extractYouTubeId(movie.trailer_url) }].filter(x => x.ytId);
    }

    return {
      meta: Object.fromEntries(Object.entries(meta).filter(([, v]) => v !== undefined)),
      cacheMaxAge: 300,
      staleRevalidate: 900
    };
  } catch (error) {
    console.error("meta:", error);
    return { meta: null };
  }
});

function parseVideoId(id) {
  const match = /^kkp:(.+):s(\d+):e(\d+)$/.exec(id);
  if (!match) return null;
  return {
    slug: match[1],
    serverIndex: Number(match[2]),
    episodeIndex: Number(match[3])
  };
}

builder.defineStreamHandler(async (args) => {
  const parsed = parseVideoId(String(args.id || ""));
  if (!parsed) return { streams: [] };

  try {
    const data = await api(`/v1/api/phim/${encodeURIComponent(parsed.slug)}`);
    const movie = unwrapMovie(data);
    const episodes = unwrapEpisodes(data, movie);
    const server = episodes[parsed.serverIndex];

    if (!server || !Array.isArray(server.server_data)) {
      return { streams: [] };
    }

    const episode = server.server_data[parsed.episodeIndex];
    if (!episode) return { streams: [] };

    const streams = [];

    if (episode.link_m3u8) {
      streams.push({
        name: "KKPhim",
        title: `${server.server_name || "Server"} • ${movie?.quality || "HLS"}${server.is_ai ? " • AI" : ""}`,
        url: episode.link_m3u8,
        behaviorHints: {
          bingeGroup: `kkphim-${server.server_name || parsed.serverIndex}`
        }
      });
    }

    if (episode.link_embed) {
      streams.push({
        name: "KKPhim",
        title: `${server.server_name || "Server"} • Embed`,
        externalUrl: episode.link_embed,
        behaviorHints: {
          notWebReady: true
        }
      });
    }

    return { streams };
  } catch (error) {
    console.error("stream:", error);
    return { streams: [] };
  }
});

function stripHtml(value) {
  return String(value)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .trim();
}

function extractYouTubeId(url) {
  const m = String(url || "").match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{6,})/
  );
  return m ? m[1] : null;
}

module.exports = builder.getInterface();
