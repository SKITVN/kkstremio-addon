const express = require("express");

const app = express();
app.disable("x-powered-by");

const PORT = process.env.PORT || 10000;
const API_BASE = "https://phimapi.com";
// Public URL of this addon (Render sets RENDER_EXTERNAL_URL). Used for absolute image proxy links.
const PUBLIC_URL = (
  process.env.PUBLIC_URL ||
  process.env.RENDER_EXTERNAL_URL ||
  ""
).replace(/\/+$/, "");

const CATALOGS = [
  { id: "phim-moi", name: "Phim Mới", type: "movie", slug: "phim-moi-cap-nhat" },
  { id: "phim-bo", name: "Phim Bộ", type: "series", slug: "phim-bo" },
  { id: "phim-le", name: "Phim Lẻ", type: "movie", slug: "phim-le" },
  { id: "phim-chieu-rap", name: "Phim Chiếu Rạp", type: "movie", slug: "phim-chieu-rap" },
  { id: "hoat-hinh", name: "Hoạt Hình", type: "series", slug: "hoat-hinh" }
];

/*
 * Danh sách Thể loại (category) — lấy từ https://phimapi.com/the-loai
 * Đặt "Hàn Quốc / Trung Quốc / Mỹ" ưu tiên ở đầu danh sách Quốc gia bên dưới
 * theo yêu cầu; PhimAPI không có quốc gia "Mỹ" riêng nên dùng "Âu Mỹ" (au-my).
 */
const CATEGORIES = [
  { name: "Hành Động", slug: "hanh-dong" },
  { name: "Tình Cảm", slug: "tinh-cam" },
  { name: "Hài Hước", slug: "hai-huoc" },
  { name: "Cổ Trang", slug: "co-trang" },
  { name: "Tâm Lý", slug: "tam-ly" },
  { name: "Hình Sự", slug: "hinh-su" },
  { name: "Chiến Tranh", slug: "chien-tranh" },
  { name: "Thể Thao", slug: "the-thao" },
  { name: "Võ Thuật", slug: "vo-thuat" },
  { name: "Viễn Tưởng", slug: "vien-tuong" },
  { name: "Phiêu Lưu", slug: "phieu-luu" },
  { name: "Khoa Học", slug: "khoa-hoc" },
  { name: "Kinh Dị", slug: "kinh-di" },
  { name: "Âm Nhạc", slug: "am-nhac" },
  { name: "Thần Thoại", slug: "than-thoai" },
  { name: "Tài Liệu", slug: "tai-lieu" },
  { name: "Gia Đình", slug: "gia-dinh" },
  { name: "Chính Kịch", slug: "chinh-kich" },
  { name: "Bí Ẩn", slug: "bi-an" },
  { name: "Học Đường", slug: "hoc-duong" },
  { name: "Kinh Điển", slug: "kinh-dien" },
  { name: "Miền Tây", slug: "mien-tay" },
  { name: "Trẻ Em", slug: "tre-em" },
  { name: "Phim 18+", slug: "phim-18" },
  { name: "Phim Ngắn", slug: "phim-ngan" },
  { name: "Lịch Sử", slug: "lich-su" }
];

/*
 * Danh sách Quốc gia (country) — lấy từ https://phimapi.com/quoc-gia
 * Hàn Quốc / Trung Quốc / Mỹ (Âu Mỹ) đặt lên đầu theo yêu cầu.
 */
const COUNTRIES = [
  { name: "Hàn Quốc", slug: "han-quoc" },
  { name: "Trung Quốc", slug: "trung-quoc" },
  { name: "Mỹ (Âu Mỹ)", slug: "au-my" },
  { name: "Việt Nam", slug: "viet-nam" },
  { name: "Nhật Bản", slug: "nhat-ban" },
  { name: "Thái Lan", slug: "thai-lan" },
  { name: "Hồng Kông", slug: "hong-kong" },
  { name: "Đài Loan", slug: "dai-loan" },
  { name: "Ấn Độ", slug: "an-do" },
  { name: "Anh", slug: "anh" },
  { name: "Pháp", slug: "phap" },
  { name: "Đức", slug: "duc" },
  { name: "Canada", slug: "canada" },
  { name: "Nga", slug: "nga" },
  { name: "Úc", slug: "uc" },
  { name: "Tây Ban Nha", slug: "tay-ban-nha" },
  { name: "Ý", slug: "y" },
  { name: "Indonesia", slug: "indonesia" },
  { name: "Philippines", slug: "philippines" },
  { name: "Malaysia", slug: "malaysia" },
  { name: "Mexico", slug: "mexico" },
  { name: "Thổ Nhĩ Kỳ", slug: "tho-nhi-ky" },
  { name: "Ả Rập Xê Út", slug: "a-rap-xe-ut" },
  { name: "UAE", slug: "uae" },
  { name: "Đan Mạch", slug: "dan-mach" },
  { name: "Thụy Điển", slug: "thuy-dien" },
  { name: "Thụy Sĩ", slug: "thuy-si" },
  { name: "Na Uy", slug: "na-uy" },
  { name: "Hà Lan", slug: "ha-lan" },
  { name: "Bồ Đào Nha", slug: "bo-dao-nha" },
  { name: "Ba Lan", slug: "ba-lan" },
  { name: "Ukraina", slug: "ukraina" },
  { name: "Brazil", slug: "brazil" },
  { name: "Nam Phi", slug: "nam-phi" },
  { name: "Châu Phi", slug: "chau-phi" },
  { name: "Quốc Gia Khác", slug: "quoc-gia-khac" }
];

/* Danh sách Năm — từ năm hiện tại lùi về 1970 */
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = [];
for (let y = CURRENT_YEAR + 1; y >= 1970; y--) {
  YEARS.push(String(y));
}

/**
 * Tra slug theo giá trị Stremio gửi lên (có thể là slug hoặc tên hiển thị).
 */
function resolveSlug(list, value) {
  if (value === undefined || value === null || value === "") return undefined;
  const v = String(value).trim();
  if (!v) return undefined;

  const bySlug = list.find(x => x.slug === v);
  if (bySlug) return bySlug.slug;

  const byName = list.find(x => x.name.toLowerCase() === v.toLowerCase());
  if (byName) return byName.slug;

  // Fallback: pass through as-is (in case PhimAPI adds a new slug we don't know yet)
  return v;
}

const ALLOWED_IMAGE_HOSTS = new Set([
  "phimapi.com",
  "phimimg.com",
  "img.phimapi.com",
  "image.tmdb.org"
]);

const DEFAULT_CDN = "https://phimimg.com";

function num(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

// PhimAPI danh-sach page size
const API_PAGE_SIZE = 24;
// Stremio/Nuvio treat < ~100 items as end-of-catalog
const CLIENT_PAGE_SIZE = 100;

/**
 * Parse extras from:
 * - query: ?skip=100
 * - path:  /catalog/movie/phim-le/skip=100.json
 * - path:  /catalog/movie/phim-le/genre=Hanh%20Dong&skip=100.json
 */
function parseExtras(req) {
  const extras = { ...req.query };

  // Path segment after catalog id, e.g. "skip=100" or "search=foo&skip=100"
  const raw = req.params.extra;
  if (raw) {
    const cleaned = String(raw).replace(/\.json$/i, "");
    for (const part of cleaned.split("&")) {
      const eq = part.indexOf("=");
      if (eq === -1) continue;
      const key = decodeURIComponent(part.slice(0, eq));
      const val = decodeURIComponent(part.slice(eq + 1));
      extras[key] = val;
    }
  }

  return extras;
}

function getSkip(extras) {
  return num(extras.skip, 0, 0, 1000000);
}

function buildFilterParams(extras, page) {
  const p = new URLSearchParams();
  p.set("page", String(page));
  p.set("limit", String(API_PAGE_SIZE));

  // Stremio gửi extra "genre" (Thể loại) — map sang "category" mà PhimAPI cần.
  const categorySlug = resolveSlug(CATEGORIES, extras.genre ?? extras.category);
  if (categorySlug) p.set("category", categorySlug);

  // Quốc gia (Hàn Quốc / Trung Quốc / Mỹ / ...)
  const countrySlug = resolveSlug(COUNTRIES, extras.country);
  if (countrySlug) p.set("country", countrySlug);

  // Theo Năm
  if (extras.year !== undefined && extras.year !== "") {
    p.set("year", String(extras.year));
  }

  const passthrough = ["sort_field", "sort_type", "sort_lang"];
  for (const key of passthrough) {
    if (extras[key] !== undefined && extras[key] !== "") {
      p.set(key, String(extras[key]));
    }
  }

  return p;
}

async function fetchJson(path) {
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;

  const r = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "Mozilla/5.0 Nuvio-PhimAPI-Addon/4.1"
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

/**
 * CDN base từ API:
 * - APP_DOMAIN_CDN_IMAGE = "https://phimimg.com"  (list + detail)
 * - poster_url trong list là relative: "uploads/movies/..."
 * - poster_url trong detail thường đã absolute
 */
function imageBase(data) {
  const d = unwrapData(data);
  const base =
    d?.APP_DOMAIN_CDN_IMAGE ||
    data?.APP_DOMAIN_CDN_IMAGE ||
    d?.pathImage ||
    data?.pathImage ||
    DEFAULT_CDN;

  return String(base).replace(/\/+$/, "");
}

function absoluteImage(value, base) {
  if (!value) return null;

  let s = String(value).trim();
  if (!s) return null;

  // Already absolute
  if (/^https?:\/\//i.test(s)) return s;

  // Protocol-relative
  if (s.startsWith("//")) return `https:${s}`;

  s = s.replace(/^\/+/, "");
  const b = String(base || DEFAULT_CDN).replace(/\/+$/, "");
  return `${b}/${s}`;
}

/**
 * Prefer direct CDN URL (works in Nuvio/Stremio).
 * Fallback to absolute proxy URL if PUBLIC_URL is set and direct fails policy.
 */
function imageProxyUrl(absoluteUrl, req) {
  if (!absoluteUrl) return null;

  // Direct CDN is preferred — phimimg.com allows hotlinking and is fast.
  // Only use proxy when explicitly forced.
  if (process.env.FORCE_IMAGE_PROXY !== "1") {
    return absoluteUrl;
  }

  const origin =
    PUBLIC_URL ||
    (req
      ? `${req.protocol}://${req.get("host")}`
      : "");

  if (!origin) {
    // Relative proxy is useless for clients — return direct instead
    return absoluteUrl;
  }

  return `${origin}/image?url=${encodeURIComponent(absoluteUrl)}`;
}

function posterFor(item, base, req) {
  const value =
    item.poster_url ||
    item.poster ||
    item.thumb_url ||
    item.thumb;

  const direct = absoluteImage(value, base);
  return imageProxyUrl(direct, req);
}

function backgroundFor(item, base, req) {
  const value =
    item.thumb_url ||
    item.thumb ||
    item.poster_url ||
    item.poster;

  const direct = absoluteImage(value, base);
  return imageProxyUrl(direct, req);
}

function typeForItem(item, fallback) {
  const t = String(item?.tmdb?.type || item?.type || "").toLowerCase();

  if (
    t === "tv" ||
    t === "series" ||
    t === "tvshow" ||
    t === "hoathinh" ||
    item?.type === "series" ||
    item?.type === "tvshows"
  ) {
    return "series";
  }

  // API uses type: "single" for movies
  if (t === "single" || t === "movie") return "movie";

  return fallback || "movie";
}

function stripHtml(html) {
  if (!html) return undefined;
  return String(html)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim() || undefined;
}

function namesOf(arr) {
  if (!Array.isArray(arr)) return [];
  return arr
    .map(x => (typeof x === "string" ? x : x?.name || x?.slug))
    .filter(Boolean);
}

function metaFromItem(item, catalogType, base, req) {
  const slug = item?.slug;
  if (!slug) return null;

  // Prefer catalog type so series catalogs always emit type:"series"
  // (avoids empty series rows when clients filter strictly by catalog type)
  const detected = typeForItem(item, catalogType);
  const type = catalogType === "series" || catalogType === "movie"
    ? catalogType
    : detected;

  const poster = posterFor(item, base, req);
  const background = backgroundFor(item, base, req);

  const imdbScore =
    item?.imdb?.vote_average ||
    item?.tmdb?.vote_average ||
    null;

  const genres = namesOf(item.category);
  const countries = namesOf(item.country);

  const meta = {
    id: `phimapi:${slug}`,
    type,
    name: item.name || item.origin_name || slug,
    poster,
    background,
    posterShape: "poster"
  };

  if (item.origin_name && item.origin_name !== item.name) {
    meta.originalTitle = item.origin_name;
  }

  const desc = stripHtml(item.content || item.description);
  if (desc) meta.description = desc;

  if (item.year) meta.year = Number(item.year);

  if (genres.length) meta.genres = genres;

  if (imdbScore) {
    meta.imdbRating = String(Number(imdbScore).toFixed(1));
  }

  // Extra release info line for catalog cards
  const bits = [];
  if (item.quality) bits.push(item.quality);
  if (item.lang) bits.push(item.lang);
  if (item.episode_current && item.episode_current !== "Full") {
    bits.push(item.episode_current);
  }
  if (bits.length) {
    meta.releaseInfo = bits.join(" • ");
  }

  return meta;
}

/*
 * Stremio/Nuvio pagination rules:
 * - skip is multiples of ~100
 * - if response has < 100 metas → client stops loading
 *
 * PhimAPI returns 24/page → fetch enough consecutive API pages,
 * then slice to CLIENT_PAGE_SIZE starting at `skip`.
 */
async function getCatalogItems(catalog, extras) {
  const skip = getSkip(extras);
  const want = CLIENT_PAGE_SIZE;

  // First API page that contains item at index `skip`
  const startPage = Math.floor(skip / API_PAGE_SIZE) + 1;
  const offsetInFirst = skip % API_PAGE_SIZE;

  // Need offsetInFirst + want items → enough API pages
  const pagesNeeded = Math.ceil((offsetInFirst + want) / API_PAGE_SIZE);

  const slug = catalog.slug || "phim-moi-cap-nhat";
  const paths = [];

  for (let i = 0; i < pagesNeeded; i++) {
    const page = startPage + i;
    const params = buildFilterParams(extras, page);
    paths.push(`/v1/api/danh-sach/${slug}?${params.toString()}`);
  }

  const responses = await Promise.allSettled(paths.map(fetchJson));

  const seen = new Set();
  const collected = [];
  let base = DEFAULT_CDN;
  let lastPag = null;
  let hitEnd = false;

  for (const result of responses) {
    if (result.status !== "fulfilled") {
      console.error(result.reason);
      continue;
    }

    const data = result.value;
    const batch = listItems(data);
    lastPag = pagination(data) || lastPag;
    base = imageBase(data);

    if (!batch.length) {
      hitEnd = true;
      break;
    }

    for (const item of batch) {
      const key = item.slug || item._id || item.name;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      collected.push(item);
    }

    if (batch.length < API_PAGE_SIZE) {
      hitEnd = true;
      break;
    }
  }

  // collected[0] corresponds to global index (startPage-1)*API_PAGE_SIZE
  // We need global index `skip` → local index `offsetInFirst`
  const slice = collected.slice(offsetInFirst, offsetInFirst + want);

  const hasMore =
    !hitEnd &&
    slice.length >= want &&
    (lastPag
      ? Number(lastPag.currentPage || startPage) <
        Number(lastPag.totalPages || 1)
      : true);

  return {
    items: slice,
    base,
    pagination: lastPag,
    skip,
    hasMore
  };
}

async function getMovie(slug) {
  const data = await fetchJson(`/v1/api/phim/${encodeURIComponent(slug)}`);
  const d = unwrapData(data);

  return {
    raw: data,
    item:
      d?.item ||
      data?.item ||
      data?.movie ||
      d?.movie ||
      null,
    base: imageBase(data)
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

    const eps = Array.isArray(server?.server_data)
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
<title>Nuvio PhimAPI Addon v4.3</title>
<style>
body{font-family:Arial,sans-serif;background:#0f1117;color:#eee;max-width:900px;margin:40px auto;padding:20px}
a{color:#69b7ff}li{margin:12px 0}
code{background:#181c25;padding:3px 6px;border-radius:5px}
</style>
</head>
<body>
<h1>Nuvio PhimAPI Addon v4.3</h1>
<p>Poster CDN + infinite scroll (1 API page / request) + Phim Bộ series.</p>
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
    version: "4.4.0",
    publicUrl: PUBLIC_URL || null
  });
});

/*
 * Poster proxy (optional).
 * Supports: phimimg.com, phimapi.com, img.phimapi.com, image.tmdb.org
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
        accept:
          "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "user-agent": "Mozilla/5.0"
      }
    });

    if (!r.ok) return res.status(r.status).end();

    const contentType = r.headers.get("content-type") || "image/jpeg";
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
    version: "4.4.0",
    name: "KKPhim • PhimAPI",
    description:
      "Phim Mới, Phim Bộ, Phim Lẻ, Phim Chiếu Rạp, Hoạt Hình — API v1 (poster + infinite scroll, lọc theo Thể loại / Quốc gia / Năm).",
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
        {
          name: "genre",
          isRequired: false,
          options: CATEGORIES.map(x => x.name),
          optionsLimit: CATEGORIES.length
        },
        {
          name: "country",
          isRequired: false,
          options: COUNTRIES.map(x => x.name),
          optionsLimit: COUNTRIES.length
        },
        {
          name: "year",
          isRequired: false,
          options: YEARS,
          optionsLimit: YEARS.length
        },
        { name: "skip", isRequired: false }
      ]
    }))
  });
});

async function handleSearch(req, res) {
  try {
    const extras = parseExtras(req);
    const keyword = String(extras.search || extras.keyword || "").trim();

    if (!keyword) {
      return res.json({ metas: [] });
    }

    const skip = getSkip(extras);
    const page = Math.floor(skip / API_PAGE_SIZE) + 1;
    const limit = 64;

    const params = new URLSearchParams({
      keyword,
      page: String(page),
      limit: String(limit)
    });

    const categorySlug = resolveSlug(CATEGORIES, extras.genre ?? extras.category);
    if (categorySlug) params.set("category", categorySlug);

    const countrySlug = resolveSlug(COUNTRIES, extras.country);
    if (countrySlug) params.set("country", countrySlug);

    if (extras.year !== undefined && extras.year !== "") {
      params.set("year", String(extras.year));
    }

    for (const key of ["sort_field", "sort_type", "sort_lang"]) {
      if (extras[key] !== undefined && extras[key] !== "") {
        params.set(key, String(extras[key]));
      }
    }

    const data = await fetchJson(`/v1/api/tim-kiem?${params.toString()}`);
    const items = listItems(data);
    const base = imageBase(data);

    const metas = items
      .map(item => metaFromItem(item, req.params.type, base, req))
      .filter(Boolean);

    res.set("Cache-Control", "public, max-age=60, s-maxage=60");
    res.json({ metas });
  } catch (e) {
    console.error("SEARCH ERROR", e);
    res.status(502).json({ metas: [], error: e.message });
  }
}

async function handleCatalog(req, res) {
  try {
    let catalog = CATALOGS.find(
      c => c.id === req.params.id && c.type === req.params.type
    );

    if (!catalog) {
      catalog = CATALOGS.find(c => c.id === req.params.id);
    }

    if (!catalog) {
      return res.status(404).json({ metas: [] });
    }

    const extras = parseExtras(req);

    // Dedicated search inside a catalog: /catalog/movie/phim-le/search=avengers.json
    if (extras.search) {
      req.query = { ...req.query, ...extras };
      return handleSearch(req, res);
    }

    const { items, base, pagination, skip, hasMore } = await getCatalogItems(
      catalog,
      extras
    );

    const metas = items
      .map(item => metaFromItem(item, catalog.type, base, req))
      .filter(Boolean);

    // Short cache so scroll requests stay fresh
    res.set("Cache-Control", "public, max-age=30, s-maxage=30");

    res.json({
      metas,
      pagination,
      skip,
      hasMore
    });
  } catch (e) {
    console.error("CATALOG ERROR", e);
    res.status(502).json({
      metas: [],
      error: e.message
    });
  }
}

/* Search — query form */
app.get("/catalog/:type/search.json", handleSearch);

/*
 * Catalog routes:
 *   /catalog/movie/phim-le.json
 *   /catalog/movie/phim-le/skip=100.json          ← Stremio path extras
 *   /catalog/movie/phim-le/skip=100               ← some clients omit .json
 *   /catalog/series/phim-bo/search=one%20piece.json
 */
app.get("/catalog/:type/:id.json", handleCatalog);
app.get("/catalog/:type/:id/:extra.json", handleCatalog);
app.get("/catalog/:type/:id/:extra", handleCatalog);

/* Meta — đầy đủ thông tin từ API */
app.get("/meta/:type/:id.json", async (req, res) => {
  try {
    const rawId = decodeURIComponent(req.params.id);
    const slug = rawId.replace(/^phimapi:/, "");

    const [{ raw, item, base: detailBase }, images] = await Promise.all([
      getMovie(slug),
      getMovieImages(slug)
    ]);

    if (!item) {
      return res.status(404).json({ meta: null });
    }

    const base = detailBase || imageBase(raw) || DEFAULT_CDN;

    const tmdbPoster = extractTMDBPoster(images);
    const tmdbBackdrop = extractTMDBBackdrop(images);

    // Prefer TMDB HD if available, else API poster (already absolute on detail)
    const poster =
      tmdbPoster ||
      absoluteImage(item.poster_url || item.poster, base) ||
      posterFor(item, base, req);

    const background =
      tmdbBackdrop ||
      absoluteImage(item.thumb_url || item.thumb, base) ||
      backgroundFor(item, base, req);

    const type = typeForItem(item, req.params.type);

    const imdbScore =
      item?.imdb?.vote_average || item?.tmdb?.vote_average || null;

    const genres = namesOf(item.category);
    const countries = namesOf(item.country);
    const directors = namesOf(
      Array.isArray(item.director) ? item.director : item.director ? [item.director] : []
    );
    const actors = namesOf(
      Array.isArray(item.actor) ? item.actor : item.actor ? [item.actor] : []
    );

    const meta = {
      id: `phimapi:${item.slug || slug}`,
      type,
      name: item.name || item.origin_name || slug,
      poster,
      background,
      posterShape: "poster"
    };

    if (item.origin_name && item.origin_name !== item.name) {
      meta.originalTitle = item.origin_name;
    }

    const desc = stripHtml(item.content || item.description);
    if (desc) meta.description = desc;

    if (item.year) meta.year = Number(item.year);
    if (genres.length) meta.genres = genres;
    if (imdbScore) meta.imdbRating = String(Number(imdbScore).toFixed(1));
    if (item.imdb?.id) meta.imdb_id = item.imdb.id;
    if (directors.length) meta.director = directors;
    if (actors.length) meta.cast = actors.slice(0, 15);
    if (item.time) meta.runtime = String(item.time);
    if (countries.length) meta.country = countries.join(", ");
    if (item.trailer_url) meta.trailers = [{ source: item.trailer_url, type: "Trailer" }];

    // Extra info block
    const extras = [];
    if (item.quality) extras.push(`Chất lượng: ${item.quality}`);
    if (item.lang) extras.push(`Ngôn ngữ: ${item.lang}`);
    if (item.episode_current) extras.push(`Tập: ${item.episode_current}`);
    if (item.episode_total) extras.push(`Tổng: ${item.episode_total}`);
    if (item.view) extras.push(`Lượt xem: ${item.view}`);
    if (extras.length) {
      meta.description = [meta.description, extras.join(" • ")]
        .filter(Boolean)
        .join("\n\n");
    }

    const eps = episodeEntries(item);

    if (type === "series" || eps.length > 1) {
      meta.videos = eps.map((x, i) => ({
        id: `phimapi:${slug}:s${x.serverIndex}:e${x.episodeIndex}`,
        title: `${x.serverName} — ${x.episode?.name || `Tập ${i + 1}`}`,
        season: Number(x.episode?.season || 1),
        episode: Number(
          x.episode?.episode ||
            x.episode?.episode_number ||
            i + 1
        ),
        released: item.year ? `${item.year}-01-01T00:00:00.000Z` : undefined
      }));
    } else if (eps.length === 1) {
      // Movie single: still expose one video id so stream works consistently
      const x = eps[0];
      meta.videos = [
        {
          id: `phimapi:${slug}:s${x.serverIndex}:e${x.episodeIndex}`,
          title: x.episode?.name || "Full",
          season: 1,
          episode: 1
        }
      ];
    }

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

/* Stream — movie (no :s:e) + series episode */
app.get("/stream/:type/:id.json", async (req, res) => {
  try {
    const rawId = decodeURIComponent(req.params.id);

    let slug;
    let serverIndex = 0;
    let episodeIndex = 0;
    let hasEpisode = false;

    const m = rawId.match(/^phimapi:(.+):s(\d+):e(\d+)$/);
    if (m) {
      slug = m[1];
      serverIndex = Number(m[2]);
      episodeIndex = Number(m[3]);
      hasEpisode = true;
    } else if (rawId.startsWith("phimapi:")) {
      slug = rawId.replace(/^phimapi:/, "");
    } else {
      return res.json({ streams: [] });
    }

    const { item } = await getMovie(slug);
    if (!item) return res.json({ streams: [] });

    const entries = episodeEntries(item);
    const streams = [];

    const pushStream = (entry) => {
      const ep = entry.episode;
      if (!ep) return;

      const title =
        `${item.name || slug} — ${ep.name || `Tập ${entry.episodeIndex + 1}`}`;

      if (ep.link_m3u8) {
        streams.push({
          name: `PhimAPI • ${entry.serverName}`,
          title,
          url: ep.link_m3u8,
          behaviorHints: {
            bingeGroup: `phimapi-${slug}-${entry.serverIndex}`
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
    };

    if (hasEpisode) {
      const entry = entries.find(
        x =>
          x.serverIndex === serverIndex &&
          x.episodeIndex === episodeIndex
      );
      if (entry) pushStream(entry);
    } else {
      // Movie / all servers first episode
      entries.forEach(pushStream);
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
  console.log(`Nuvio PhimAPI v4.4 listening on ${PORT}`);
  if (PUBLIC_URL) console.log(`PUBLIC_URL=${PUBLIC_URL}`);
});
