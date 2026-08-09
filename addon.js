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
  { id: "animation", type: "movie", name: "KKPhim - Hoạt hình" },
  { id: "theater", type: "movie", name: "KKPhim - Chiếu rạp" },
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
  version: "1.0.0",
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
  catalogs: CATALOGS,
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

  const base = movie?.pathImage || "https://phimapi.com/uploads/movies/";
  return base.replace(/\/+$/, "") + "/" + String(value).replace(/^\/+/, "");
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

function listEndpoint(catalogId) {
  switch (catalogId) {
    case "series": return "/v1/api/danh-sach/phim-bo";
    case "movies": return "/v1/api/danh-sach/phim-le";
    case "animation": return "/v1/api/danh-sach/hoat-hinh";
    case "theater": return "/v1/api/danh-sach/phim-chieu-rap";
    case "new":
    default: return "/v1/api/danh-sach";
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

      const metas = unwrapItems(data)
        .filter((item) => contentType(item) === args.type)
        .map(catalogMeta);

      return {
        metas,
        cacheMaxAge: 120,
        staleRevalidate: 600
      };
    }

    const data = await api(listEndpoint(catalogId), {
      page,
      limit: PAGE_SIZE,
      sort_field: "modified.time",
      sort_type: "desc"
    });

    const metas = unwrapItems(data)
      .filter((item) => contentType(item) === args.type)
      .map(catalogMeta);

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
      poster: imageUrl(movie, "poster_url") || imageUrl(movie, "thumb_url"),
      background: imageUrl(movie, "thumb_url") || imageUrl(movie, "poster_url"),
      logo: imageUrl(movie, "poster_url"),
      posterShape: "poster",
      description: stripHtml(movie.content || ""),
      releaseInfo: movie.year ? String(movie.year) : undefined,
      runtime: movie.time,
      genres,
      country: countries,
      director: Array.isArray(movie.director) ? movie.director : [],
      cast: Array.isArray(movie.actor) ? movie.actor : [],
      imdbRating: movie.imdb?.vote_average || movie.tmdb?.vote_average || undefined,
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
