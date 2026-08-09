const { addonBuilder } = require("stremio-addon-sdk");

const API_BASE = (process.env.KKPHIM_API_BASE || "https://phimapi.com").replace(/\/+$/, "");
const CACHE_SECONDS = Number(process.env.CACHE_SECONDS || 300);
const PAGE_SIZE = Math.min(Math.max(Number(process.env.PAGE_SIZE || 24), 1), 100);

const COUNTRIES = [
  ["Trung Quốc", "trung-quoc"], ["Hàn Quốc", "han-quoc"], ["Nhật Bản", "nhat-ban"],
  ["Việt Nam", "viet-nam"], ["Thái Lan", "thai-lan"], ["Hồng Kông", "hong-kong"],
  ["Đài Loan", "dai-loan"], ["Âu Mỹ", "au-my"], ["Anh", "anh"], ["Pháp", "phap"],
  ["Đức", "duc"], ["Tây Ban Nha", "tay-ban-nha"], ["Ý", "y"], ["Ấn Độ", "an-do"],
  ["Philippines", "philippines"], ["Indonesia", "indonesia"], ["Malaysia", "malaysia"],
  ["Canada", "canada"], ["Úc", "uc"], ["Nga", "nga"]
];

const GENRES = [
  ["Hành Động", "hanh-dong"], ["Cổ Trang", "co-trang"], ["Tình Cảm", "tinh-cam"],
  ["Chính Kịch", "chinh-kich"], ["Hài Hước", "hai-huoc"], ["Kinh Dị", "kinh-di"],
  ["Khoa Học", "khoa-hoc"], ["Viễn Tưởng", "vien-tuong"], ["Phiêu Lưu", "phieu-luu"],
  ["Võ Thuật", "vo-thuat"], ["Tâm Lý", "tam-ly"], ["Hình Sự", "hinh-su"],
  ["Gia Đình", "gia-dinh"], ["Hoạt Hình", "hoat-hinh"], ["Thể Thao", "the-thao"],
  ["Âm Nhạc", "am-nhac"], ["Lịch Sử", "lich-su"], ["Thần Thoại", "than-thoai"],
  ["Trẻ Em", "tre-em"], ["Tài Liệu", "tai-lieu"], ["Bí Ẩn", "bi-an"],
  ["Chiến Tranh", "chien-tranh"], ["Học Đường", "hoc-duong"], ["Kinh Điển", "kinh-dien"],
  ["Phim Ngắn", "phim-ngan"]
];

const YEARS = Array.from({ length: 15 }, (_, i) => String(new Date().getFullYear() - i));

function filterCatalogs(prefix, type, label, pairs, endpointKind) {
  return pairs.flatMap(([name, slug]) => [{
    id: `${prefix}-${slug}-movie`, type: "movie", name: `${label} ${name} - Phim lẻ`,
    extra: [{ name: "skip", isRequired: false }],
    _filter: { endpointKind, slug, expected: "movie" }
  }, {
    id: `${prefix}-${slug}-series`, type: "series", name: `${label} ${name} - Phim bộ`,
    extra: [{ name: "skip", isRequired: false }],
    _filter: { endpointKind, slug, expected: "series" }
  }]);
}

const CATALOGS = [
  { id: "new-v2-movie", type: "movie", name: "KKPhim - Phim mới cập nhật v2 - Phim lẻ", extra: [{ name: "skip", isRequired: false }] },
  { id: "new-v2-series", type: "series", name: "KKPhim - Phim mới cập nhật v2 - Phim bộ", extra: [{ name: "skip", isRequired: false }] },
  { id: "series", type: "series", name: "KKPhim - Phim bộ", extra: [{ name: "skip", isRequired: false }] },
  { id: "movies", type: "movie", name: "KKPhim - Phim lẻ", extra: [{ name: "skip", isRequired: false }] },
  { id: "theater", type: "movie", name: "KKPhim - Phim chiếu rạp", extra: [{ name: "skip", isRequired: false }] },
  { id: "animation-series", type: "series", name: "KKPhim - Hoạt hình", extra: [{ name: "skip", isRequired: false }] },
  { id: "animation-movie", type: "movie", name: "KKPhim - Hoạt hình - Phim lẻ", extra: [{ name: "skip", isRequired: false }] },
  { id: "donghua-series", type: "series", name: "KKPhim - Hoạt hình Trung Quốc", extra: [{ name: "skip", isRequired: false }] },
  { id: "search-movie", type: "movie", name: "KKPhim - Tìm kiếm phim", extra: [{ name: "search", isRequired: true }, { name: "skip", isRequired: false }] },
  { id: "search-series", type: "series", name: "KKPhim - Tìm kiếm phim bộ", extra: [{ name: "search", isRequired: true }, { name: "skip", isRequired: false }] },
  ...filterCatalogs("country", "", "KKPhim -", COUNTRIES, "country"),
  ...filterCatalogs("genre", "", "KKPhim -", GENRES, "genre"),
  ...YEARS.flatMap(year => [
    { id: `year-${year}-movie`, type: "movie", name: `KKPhim - Năm ${year} - Phim lẻ`, extra: [{ name: "skip", isRequired: false }], _filter: { endpointKind: "year", slug: year, expected: "movie" } },
    { id: `year-${year}-series`, type: "series", name: `KKPhim - Năm ${year} - Phim bộ`, extra: [{ name: "skip", isRequired: false }], _filter: { endpointKind: "year", slug: year, expected: "series" } }
  ])
];

// _filter is server-side metadata and must not be exposed in the manifest.
const manifest = {
  id: "community.kkphim",
  version: "2.0.0",
  name: "KKPhim",
  description: "KKPhim: phim mới v2, phim bộ, phim lẻ, chiếu rạp, phân loại theo quốc gia/thể loại/năm, metadata và stream.",
  logo: "https://kkphim.com/favicon.ico",
  resources: [
    "catalog",
    { name: "meta", types: ["movie", "series"], idPrefixes: ["kkp:"] },
    { name: "stream", types: ["movie", "series"], idPrefixes: ["kkp:"] }
  ],
  types: ["movie", "series"],
  idPrefixes: ["kkp:"],
  catalogs: CATALOGS.map(({ _filter, ...c }) => c),
  behaviorHints: { configurable: false }
};

const builder = new addonBuilder(manifest);

async function api(path, params = {}) {
  const url = new URL(API_BASE + path);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, {
      headers: { accept: "application/json", "user-agent": "KKPhim-Stremio-Addon/2.0" },
      signal: controller.signal
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${url.pathname}`);
    return await res.json();
  } finally { clearTimeout(timer); }
}

function itemsOf(data) {
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data?.items)) return data.data.items;
  if (Array.isArray(data?.data?.item)) return data.data.item;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}
function itemOf(data) { return data?.movie || data?.data?.item || data?.data?.movie || data?.item || null; }
function episodesOf(data, movie) { return Array.isArray(data?.episodes) ? data.episodes : (Array.isArray(movie?.episodes) ? movie.episodes : (Array.isArray(data?.data?.item?.episodes) ? data.data.item.episodes : [])); }

function mediaUrl(value) {
  if (!value) return undefined;
  if (/^https?:\/\//i.test(String(value))) return String(value);
  return `https://phimimg.com/${String(value).replace(/^\/+/, "")}`;
}
function tmdbImage(value, size) {
  if (!value) return undefined;
  if (/^https?:\/\//i.test(String(value))) return String(value);
  return `https://image.tmdb.org/t/p/${size}/${String(value).replace(/^\/+/, "")}`;
}
function imageFromResponse(data, kind) {
  const d = data?.data || data || {};
  const sizes = d?.image_sizes?.[kind] || {};
  const imgs = Array.isArray(d?.images) ? d.images : [];
  const first = imgs.find(x => x?.file_path || x?.url || x?.src);
  if (first?.url || first?.src) return first.url || first.src;
  if (first?.file_path) return tmdbImage(first.file_path, sizes.w780 ? "w780" : "original");
  return undefined;
}

function detectType(item, forced) {
  if (forced) return forced;
  const t = String(item?.type || "").toLowerCase();
  if (["series", "tv", "phim-bo", "tv-shows"].includes(t)) return "series";
  if (["single", "movie", "phim-le"].includes(t)) return "movie";
  if (item?.tmdb?.type === "tv") return "series";
  if (item?.tmdb?.type === "movie") return "movie";
  const cur = String(item?.episode_current || "").toLowerCase();
  const total = Number(item?.episode_total || 0);
  if (total > 1 || /tập|tap|episode|ep\.?\s*\d/.test(cur)) return "series";
  return "movie";
}

function idFor(type, slug) { return `kkp:${type}:${slug}`; }
function parseId(id) {
  const m = /^kkp:(movie|series):(.+)$/.exec(String(id || ""));
  if (m) return { type: m[1], slug: m[2] };
  const legacy = /^kkp:(.+)$/.exec(String(id || ""));
  return legacy ? { type: null, slug: legacy[1] } : null;
}
function pageFromSkip(extra) {
  const skip = Math.max(0, Number(extra?.skip || 0));
  return { skip, page: Math.floor(skip / PAGE_SIZE) + 1 };
}

async function posterFor(item) {
  let p = mediaUrl(item?.poster_url) || mediaUrl(item?.thumb_url);
  if (p && /^https?:\/\//.test(String(item?.poster_url || item?.thumb_url || ""))) return p;
  if (item?.slug) {
    try {
      const d = await api(`/phim/${encodeURIComponent(item.slug)}`);
      const m = itemOf(d);
      p = mediaUrl(m?.poster_url) || mediaUrl(m?.thumb_url) || p;
    } catch (_) {}
  }
  return p;
}

function preview(item, forcedType) {
  const type = detectType(item, forcedType);
  return {
    id: idFor(type, item.slug || item._id),
    type,
    name: item.name || item.origin_name || item.slug,
    poster: mediaUrl(item.poster_url) || mediaUrl(item.thumb_url),
    posterShape: "poster",
    releaseInfo: item.year ? String(item.year) : undefined,
    description: item.origin_name ? `${item.origin_name}${item.year ? ` (${item.year})` : ""}` : undefined
  };
}

async function resolvePreview(item, forcedType) {
  const m = preview(item, forcedType);
  if (!m.poster || !/^https?:\/\//.test(m.poster)) m.poster = await posterFor(item);
  return Object.fromEntries(Object.entries(m).filter(([, v]) => v !== undefined));
}

function filterItems(items, expected) {
  if (!expected) return items;
  return items.filter(x => detectType(x) === expected);
}

function configFor(id) {
  const fixed = CATALOGS.find(x => x.id === id)?._filter;
  if (fixed) return fixed;
  switch (id) {
    case "new-v2-movie": return { endpointKind: "new-v2", expected: "movie" };
    case "new-v2-series": return { endpointKind: "new-v2", expected: "series" };
    case "series": return { endpointKind: "type", slug: "phim-bo", expected: "series" };
    case "movies": return { endpointKind: "type", slug: "phim-le", expected: "movie" };
    case "theater": return { endpointKind: "type", slug: "phim-chieu-rap", expected: "movie" };
    case "animation-series": return { endpointKind: "type", slug: "hoat-hinh", expected: "series" };
    case "animation-movie": return { endpointKind: "type", slug: "hoat-hinh", expected: "movie" };
    case "donghua-series": return { endpointKind: "type", slug: "hoat-hinh", country: "trung-quoc", expected: "series" };
    default: return null;
  }
}

async function catalogData(cfg, page) {
  if (cfg.endpointKind === "new-v2") {
    return api("/danh-sach/phim-moi-cap-nhat-v2", { page });
  }
  if (cfg.endpointKind === "type") {
    return api(`/v1/api/danh-sach/${encodeURIComponent(cfg.slug)}`, {
      page, sort_field: "modified.time", sort_type: "desc", sort_lang: cfg.sort_lang, country: cfg.country, category: cfg.category, year: cfg.year
    });
  }
  if (cfg.endpointKind === "country") return api(`/v1/api/quoc-gia/${encodeURIComponent(cfg.slug)}`, { page, sort_field: "modified.time", sort_type: "desc" });
  if (cfg.endpointKind === "genre") return api(`/v1/api/the-loai/${encodeURIComponent(cfg.slug)}`, { page, sort_field: "modified.time", sort_type: "desc" });
  if (cfg.endpointKind === "year") return api(`/v1/api/nam/${encodeURIComponent(cfg.slug)}`, { page, sort_field: "modified.time", sort_type: "desc" });
  throw new Error("Unknown catalog endpoint");
}

builder.defineCatalogHandler(async ({ id, type, extra = {} }) => {
  try {
    if (id === "search-movie" || id === "search-series") {
      const keyword = String(extra.search || "").trim();
      if (!keyword) return { metas: [] };
      const { page } = pageFromSkip(extra);
      const d = await api("/v1/api/tim-kiem", { keyword, page, limit: PAGE_SIZE });
      const items = filterItems(itemsOf(d), type);
      return { metas: await Promise.all(items.map(x => resolvePreview(x, type))), cacheMaxAge: 120, staleRevalidate: 600 };
    }

    const cfg = configFor(id);
    if (!cfg) return { metas: [] };
    const { page } = pageFromSkip(extra);
    const d = await catalogData(cfg, page);
    const items = filterItems(itemsOf(d), cfg.expected || type);
    const metas = await Promise.all(items.map(x => resolvePreview(x, cfg.expected || type)));
    return { metas, cacheMaxAge: CACHE_SECONDS, staleRevalidate: CACHE_SECONDS * 2 };
  } catch (e) {
    console.error("catalog", id, e.message);
    return { metas: [] };
  }
});

function stripHtml(s) {
  return String(s || "").replace(/<br\s*\/?>(\n)?/gi, "\n").replace(/<\/p>/gi, "\n").replace(/<[^>]*>/g, "").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&#39;/gi, "'").trim();
}
function youtubeId(url) {
  const m = String(url || "").match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{6,})/);
  return m?.[1];
}
function episodeNumber(ep, index) {
  const direct = Number(ep?.episode || ep?.episode_number || ep?.number);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const s = `${ep?.name || ""} ${ep?.filename || ""}`;
  const m = s.match(/(?:tập|tap|episode|ep)\s*[-.]?\s*(\d+)/i);
  return m ? Number(m[1]) : index + 1;
}

function buildVideos(slug, type, episodes) {
  const videos = [];
  episodes.forEach((server, si) => {
    const serverName = server?.server_name || `Server ${si + 1}`;
    const data = Array.isArray(server?.server_data) ? server.server_data : [];
    data.forEach((ep, ei) => {
      const epNo = episodeNumber(ep, ei);
      const season = Number(ep?.season || 1);
      const id = `kkp:${type}:${slug}:s${si}:e${ei}`;
      videos.push({
        id,
        title: type === "series" ? `${ep?.name || `Tập ${epNo}`} • ${serverName}` : `${serverName}${ep?.name ? ` • ${ep.name}` : ""}`,
        season,
        episode: type === "series" ? epNo : 1,
        overview: serverName,
        thumbnail: undefined
      });
    });
  });
  return videos;
}

builder.defineMetaHandler(async ({ id }) => {
  const parsed = parseId(id);
  if (!parsed?.slug) return { meta: null };
  try {
    const d = await api(`/v1/api/phim/${encodeURIComponent(parsed.slug)}`);
    const movie = itemOf(d);
    if (!movie) return { meta: null };
    const type = parsed.type || detectType(movie);
    const episodes = episodesOf(d, movie);
    const [images, people, keywords] = await Promise.allSettled([
      api(`/v1/api/phim/${encodeURIComponent(parsed.slug)}/images`),
      api(`/v1/api/phim/${encodeURIComponent(parsed.slug)}/peoples`),
      api(`/v1/api/phim/${encodeURIComponent(parsed.slug)}/keywords`)
    ]);
    const imageData = images.status === "fulfilled" ? images.value : null;
    const peopleData = people.status === "fulfilled" ? (people.value?.data || people.value) : null;
    const keywordData = keywords.status === "fulfilled" ? (keywords.value?.data || keywords.value) : null;
    const poster = mediaUrl(movie.poster_url) || mediaUrl(movie.thumb_url) || imageFromResponse(imageData, "poster");
    const background = imageFromResponse(imageData, "backdrop") || mediaUrl(movie.thumb_url) || poster;
    const cast = Array.isArray(movie.actor) ? movie.actor : (Array.isArray(peopleData?.peoples) ? peopleData.peoples.filter(x => String(x.known_for_department || x.department || "").toLowerCase() === "acting").map(x => x.name).filter(Boolean) : []);
    const directors = Array.isArray(movie.director) ? movie.director : (Array.isArray(peopleData?.peoples) ? peopleData.peoples.filter(x => String(x.job || "").toLowerCase() === "director").map(x => x.name).filter(Boolean) : []);
    const genres = Array.isArray(movie.category) ? movie.category.map(x => x.name).filter(Boolean) : [];
    const countries = Array.isArray(movie.country) ? movie.country.map(x => x.name).filter(Boolean) : [];
    const keywordsList = Array.isArray(keywordData?.keywords) ? keywordData.keywords.map(x => typeof x === "string" ? x : x?.name).filter(Boolean) : [];
    const meta = {
      id: idFor(type, movie.slug || parsed.slug), type,
      name: movie.name || movie.origin_name || parsed.slug,
      poster, background, logo: poster, posterShape: "poster",
      description: stripHtml(movie.content || ""),
      releaseInfo: movie.year ? String(movie.year) : undefined,
      runtime: movie.time, genres, country: countries,
      director: directors, cast,
      imdbRating: Number(movie.imdb?.vote_average || movie.tmdb?.vote_average || 0) || undefined,
      videos: buildVideos(movie.slug || parsed.slug, type, episodes),
      links: [
        movie.tmdb?.id ? { name: "TMDB", category: "info", url: `https://www.themoviedb.org/${movie.tmdb.type || (type === "series" ? "tv" : "movie")}/${movie.tmdb.id}` } : null,
        movie.imdb?.id ? { name: "IMDb", category: "info", url: `https://www.imdb.com/title/${movie.imdb.id}/` } : null,
        genres.length ? { name: "Thể loại", category: "genre", url: `https://kkphim.com/the-loai/${movie.category?.[0]?.slug || ""}` } : null,
        countries.length ? { name: "Quốc gia", category: "country", url: `https://kkphim.com/quoc-gia/${movie.country?.[0]?.slug || ""}` } : null
      ].filter(Boolean),
      trailers: youtubeId(movie.trailer_url) ? [{ source: youtubeId(movie.trailer_url), type: "Trailer" }] : undefined,
      behaviorHints: { defaultVideoId: buildVideos(movie.slug || parsed.slug, type, episodes)[0]?.id }
    };
    return { meta: Object.fromEntries(Object.entries(meta).filter(([, v]) => v !== undefined)), cacheMaxAge: 300, staleRevalidate: 900 };
  } catch (e) {
    console.error("meta", parsed.slug, e.message);
    return { meta: null };
  }
});

function parseVideoId(id) {
  const m = /^kkp:(movie|series):(.+):s(\d+):e(\d+)$/.exec(String(id || ""));
  return m ? { type: m[1], slug: m[2], serverIndex: Number(m[3]), episodeIndex: Number(m[4]) } : null;
}

async function streamsFor(movie, episodes, parsed) {
  const server = episodes[parsed.serverIndex];
  const ep = server?.server_data?.[parsed.episodeIndex];
  if (!ep) return [];
  const out = [];
  if (ep.link_m3u8) out.push({ name: "KKPhim", title: `${server.server_name || "Server"} • ${movie?.quality || "HLS"}${server.is_ai ? " • AI" : ""}`, url: ep.link_m3u8, behaviorHints: { bingeGroup: `kkphim-${parsed.serverIndex}` } });
  if (ep.link_embed) out.push({ name: "KKPhim", title: `${server.server_name || "Server"} • Embed`, externalUrl: ep.link_embed, behaviorHints: { notWebReady: true } });
  return out;
}

builder.defineStreamHandler(async ({ id }) => {
  const parsed = parseVideoId(id);
  try {
    if (!parsed) {
      const p = parseId(id);
      if (!p?.slug) return { streams: [] };
      const d = await api(`/v1/api/phim/${encodeURIComponent(p.slug)}`);
      const movie = itemOf(d), episodes = episodesOf(d, movie);
      for (let si = 0; si < episodes.length; si++) {
        const data = episodes[si]?.server_data || [];
        for (let ei = 0; ei < data.length; ei++) {
          const streams = await streamsFor(movie, episodes, { serverIndex: si, episodeIndex: ei });
          if (streams.length) return { streams };
        }
      }
      return { streams: [] };
    }
    const d = await api(`/v1/api/phim/${encodeURIComponent(parsed.slug)}`);
    const movie = itemOf(d), episodes = episodesOf(d, movie);
    return { streams: await streamsFor(movie, episodes, parsed) };
  } catch (e) {
    console.error("stream", id, e.message);
    return { streams: [] };
  }
});

module.exports = builder.getInterface();
