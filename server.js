const express = require('express');

const app = express();
app.disable('x-powered-by');

const PORT = process.env.PORT || 10000;
const API_BASE = 'https://phimapi.com';
const PUBLIC_URL = (process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || '').replace(/\/+$/, '');
const DEFAULT_CDN = 'https://phimimg.com';
const API_PAGE_SIZE = 24;
const CLIENT_PAGE_SIZE = 100;

const CATALOGS = [
  { id: 'phim-moi', name: 'Phim Mới', type: 'movie', slug: 'phim-moi-cap-nhat' },
  { id: 'phim-bo', name: 'Phim Bộ', type: 'series', slug: 'phim-bo' },
  { id: 'phim-le', name: 'Phim Lẻ', type: 'movie', slug: 'phim-le' },
  { id: 'phim-chieu-rap', name: 'Phim Chiếu Rạp', type: 'movie', slug: 'phim-chieu-rap' },
  { id: 'hoat-hinh', name: 'Hoạt Hình', type: 'series', slug: 'hoat-hinh' }
];

const CATEGORIES = [
  ['Hành Động','hanh-dong'],['Tình Cảm','tinh-cam'],['Hài Hước','hai-huoc'],['Cổ Trang','co-trang'],
  ['Tâm Lý','tam-ly'],['Hình Sự','hinh-su'],['Chiến Tranh','chien-tranh'],['Thể Thao','the-thao'],
  ['Võ Thuật','vo-thuat'],['Viễn Tưởng','vien-tuong'],['Phiêu Lưu','phieu-luu'],['Khoa Học','khoa-hoc'],
  ['Kinh Dị','kinh-di'],['Âm Nhạc','am-nhac'],['Thần Thoại','than-thoai'],['Tài Liệu','tai-lieu'],
  ['Gia Đình','gia-dinh'],['Chính Kịch','chinh-kich'],['Bí Ẩn','bi-an'],['Học Đường','hoc-duong'],
  ['Kinh Điển','kinh-dien'],['Miền Tây','mien-tay'],['Trẻ Em','tre-em'],['Phim 18+','phim-18'],
  ['Phim Ngắn','phim-ngan'],['Lịch Sử','lich-su']
].map(([name, slug]) => ({ name, slug }));

// Quốc gia hiển thị thành bộ lọc riêng trong từng catalog.
const FEATURED_COUNTRIES = [
  { name: 'Hàn Quốc', slug: 'han-quoc' },
  { name: 'Trung Quốc', slug: 'trung-quoc' },
  { name: 'Âu Mỹ', slug: 'au-my' }
];

// Giữ tương thích nếu client cũ vẫn gửi extra country trực tiếp.
const COUNTRIES = [
  ...FEATURED_COUNTRIES,
  { name:'Việt Nam', slug:'viet-nam' }, { name:'Nhật Bản', slug:'nhat-ban' },
  { name:'Thái Lan', slug:'thai-lan' }, { name:'Hồng Kông', slug:'hong-kong' },
  { name:'Đài Loan', slug:'dai-loan' }, { name:'Ấn Độ', slug:'an-do' },
  { name:'Anh', slug:'anh' }, { name:'Pháp', slug:'phap' }, { name:'Đức', slug:'duc' },
  { name:'Canada', slug:'canada' }, { name:'Nga', slug:'nga' }, { name:'Úc', slug:'uc' },
  { name:'Tây Ban Nha', slug:'tay-ban-nha' }, { name:'Ý', slug:'y' },
  { name:'Indonesia', slug:'indonesia' }, { name:'Philippines', slug:'philippines' },
  { name:'Malaysia', slug:'malaysia' }, { name:'Mexico', slug:'mexico' },
  { name:'Thổ Nhĩ Kỳ', slug:'tho-nhi-ky' }, { name:'UAE', slug:'uae' }
];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = [];
for (let y = CURRENT_YEAR + 1; y >= 1970; y--) YEARS.push(String(y));

// Mỗi nhóm lọc là một extra độc lập để client có thể kết hợp:
// Thể loại + Quốc gia + Năm phát hành.
const GENRE_OPTIONS = CATEGORIES.map(x => x.name);
const COUNTRY_OPTIONS = FEATURED_COUNTRIES.map(x => x.name);
const YEAR_OPTIONS = [...YEARS];

function num(value, fallback, min, max) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.floor(n))) : fallback;
}

function resolveSlug(list, value) {
  if (value == null || value === '') return undefined;
  const v = String(value).trim();
  const found = list.find(x => x.slug === v || x.name.toLowerCase() === v.toLowerCase());
  return found ? found.slug : v;
}

function parseExtras(req) {
  const extras = { ...req.query };
  const raw = req.params.extra;
  if (raw) {
    const cleaned = String(raw).replace(/\.json$/i, '');
    for (const part of cleaned.split('&')) {
      const eq = part.indexOf('=');
      if (eq < 0) continue;
      extras[decodeURIComponent(part.slice(0, eq))] = decodeURIComponent(part.slice(eq + 1));
    }
  }
  return extras;
}

function normalizeFilters(extras) {
  let category;
  let country;
  let year;

  // Thể loại là selector riêng.
  if (extras.genre != null && String(extras.genre).trim() !== '') {
    const genre = String(extras.genre).trim();
    // Tương thích với manifest v4.5 nếu client còn cache giá trị cũ.
    const oldCountry = genre.match(/^Quốc gia\s*•\s*(.+)$/i);
    const oldYear = genre.match(/^Năm\s*•\s*(\d{4})$/i);
    if (oldCountry) country = resolveSlug(FEATURED_COUNTRIES, oldCountry[1]);
    else if (oldYear) year = oldYear[1];
    else category = resolveSlug(CATEGORIES, genre);
  }

  // Quốc gia và năm là hai selector độc lập nên có thể chọn đồng thời.
  if (extras.country != null && String(extras.country).trim() !== '') {
    country = resolveSlug(COUNTRIES, extras.country);
  }
  if (extras.year != null && String(extras.year).trim() !== '') {
    const y = String(extras.year).trim().replace(/^Năm\s*•\s*/i, '');
    if (/^(19|20)\d{2}$/.test(y)) year = y;
  }
  if (!category && extras.category) category = resolveSlug(CATEGORIES, extras.category);

  return { category, country, year };
}

function buildFilterParams(extras, page) {
  const p = new URLSearchParams({ page: String(page), limit: String(API_PAGE_SIZE) });
  const f = normalizeFilters(extras);
  if (f.category) p.set('category', f.category);
  if (f.country) p.set('country', f.country);
  if (f.year) p.set('year', f.year);
  for (const key of ['sort_field','sort_type','sort_lang']) {
    if (extras[key] != null && extras[key] !== '') p.set(key, String(extras[key]));
  }
  return p;
}

async function fetchJson(path) {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  const r = await fetch(url, { headers: { accept:'application/json', 'user-agent':'Mozilla/5.0 Nuvio-KKPhim-Addon/4.6' } });
  if (!r.ok) throw new Error(`PhimAPI HTTP ${r.status}: ${url}`);
  return r.json();
}

function unwrapData(data) { return data?.data ?? data ?? {}; }
function listItems(data) {
  const d = unwrapData(data);
  return Array.isArray(d?.items) ? d.items : Array.isArray(data?.items) ? data.items : [];
}
function pagination(data) {
  const d = unwrapData(data);
  return d?.params?.pagination || d?.pagination || data?.pagination || null;
}
function imageBase(data) {
  const d = unwrapData(data);
  return String(d?.APP_DOMAIN_CDN_IMAGE || data?.APP_DOMAIN_CDN_IMAGE || d?.pathImage || data?.pathImage || DEFAULT_CDN).replace(/\/+$/, '');
}
function absoluteImage(value, base) {
  if (!value) return null;
  let s = String(value).trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith('//')) return `https:${s}`;
  return `${String(base || DEFAULT_CDN).replace(/\/+$/, '')}/${s.replace(/^\/+/, '')}`;
}
function posterFor(item, base) { return absoluteImage(item.poster_url || item.poster || item.thumb_url || item.thumb, base); }
function backgroundFor(item, base) { return absoluteImage(item.thumb_url || item.thumb || item.poster_url || item.poster, base); }
function typeForItem(item, fallback='movie') {
  const t = String(item?.tmdb?.type || item?.type || '').toLowerCase();
  if (['tv','series','tvshow','tvshows','hoathinh'].includes(t)) return 'series';
  if (['single','movie'].includes(t)) return 'movie';
  return fallback;
}
function stripHtml(html) {
  if (!html) return undefined;
  return String(html).replace(/<br\s*\/?>/gi,'\n').replace(/<\/p>/gi,'\n').replace(/<[^>]+>/g,'')
    .replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/\n{3,}/g,'\n\n').trim() || undefined;
}
function namesOf(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map(x => typeof x === 'string' ? x : x?.name || x?.slug).filter(Boolean);
}
function metaFromItem(item, catalogType, base) {
  const slug = item?.slug;
  if (!slug) return null;
  const meta = {
    id: `phimapi:${slug}`,
    type: catalogType || typeForItem(item),
    name: item.name || item.origin_name || slug,
    poster: posterFor(item, base),
    background: backgroundFor(item, base),
    posterShape: 'poster'
  };
  if (item.origin_name && item.origin_name !== item.name) meta.originalTitle = item.origin_name;
  const desc = stripHtml(item.content || item.description);
  if (desc) meta.description = desc;
  if (item.year) meta.year = Number(item.year);
  const genres = namesOf(item.category); if (genres.length) meta.genres = genres;
  const score = item?.imdb?.vote_average || item?.tmdb?.vote_average; if (score) meta.imdbRating = String(Number(score).toFixed(1));
  const bits = [item.quality, item.lang, item.episode_current && item.episode_current !== 'Full' ? item.episode_current : null].filter(Boolean);
  if (bits.length) meta.releaseInfo = bits.join(' • ');
  return meta;
}

async function getCatalogItems(catalog, extras) {
  const skip = num(extras.skip, 0, 0, 1000000);
  const startPage = Math.floor(skip / API_PAGE_SIZE) + 1;
  const offset = skip % API_PAGE_SIZE;
  const pagesNeeded = Math.ceil((offset + CLIENT_PAGE_SIZE) / API_PAGE_SIZE);
  const paths = [];
  for (let i=0; i<pagesNeeded; i++) {
    const params = buildFilterParams(extras, startPage+i);
    paths.push(`/v1/api/danh-sach/${catalog.slug}?${params}`);
  }
  const responses = await Promise.allSettled(paths.map(fetchJson));
  let base = DEFAULT_CDN;
  const seen = new Set();
  const collected = [];
  for (const result of responses) {
    if (result.status !== 'fulfilled') { console.error(result.reason); continue; }
    const data = result.value; base = imageBase(data);
    for (const item of listItems(data)) {
      const key = item.slug || item._id || item.name;
      if (key && !seen.has(key)) { seen.add(key); collected.push(item); }
    }
  }
  return { items: collected.slice(offset, offset + CLIENT_PAGE_SIZE), base };
}

async function getMovie(slug) {
  const data = await fetchJson(`/v1/api/phim/${encodeURIComponent(slug)}`);
  const d = unwrapData(data);
  return { raw:data, item:d?.item || data?.item || data?.movie || d?.movie || null, base:imageBase(data) };
}
function episodeList(item) {
  if (Array.isArray(item?.episodes)) return item.episodes;
  if (Array.isArray(item?.server_data)) return [{ server_data:item.server_data }];
  return [];
}
function episodeEntries(item) {
  const out=[];
  episodeList(item).forEach((server, si) => {
    const serverName = server?.server_name || server?.name || `Server ${si+1}`;
    const eps = Array.isArray(server?.server_data) ? server.server_data : Array.isArray(server?.episodes) ? server.episodes : [];
    eps.forEach((episode, ei) => out.push({ serverIndex:si, episodeIndex:ei, serverName, episode }));
  });
  return out;
}

app.get('/', (_req,res) => res.type('html').send(`<!doctype html><meta charset="utf-8"><title>KKPhim Addon v4.6</title><body style="font-family:Arial;background:#10131a;color:#eee;max-width:900px;margin:40px auto"><h1>KKPhim • PhimAPI v4.6</h1><p>5 catalog + poster + infinite scroll + bộ lọc riêng Thể loại / Quốc gia / Năm phát hành.</p><p><a href="/manifest.json">manifest.json</a> · <a href="/health">health</a></p></body>`));
app.get('/health', (_req,res) => res.json({ ok:true, addon:'vn.starskingit.phimapi', version:'4.6.0', publicUrl:PUBLIC_URL || null }));

app.get('/manifest.json', (_req,res) => res.json({
  id:'vn.starskingit.phimapi', version:'4.6.0', name:'KKPhim • PhimAPI',
  description:'Phim Mới, Phim Bộ, Phim Lẻ, Phim Chiếu Rạp, Hoạt Hình — bộ lọc riêng Thể loại / Quốc gia / Năm phát hành, có thể kết hợp đồng thời.',
  logo:'https://www.google.com/s2/favicons?domain=phimapi.com&sz=128',
  resources:['catalog','meta','stream'], types:['movie','series'], idPrefixes:['phimapi:'],
  catalogs: CATALOGS.map(c => ({
    type:c.type, id:c.id, name:c.name,
    extra:[
      { name:'search', isRequired:false },
      { name:'genre', isRequired:false, options:GENRE_OPTIONS, optionsLimit:GENRE_OPTIONS.length },
      { name:'country', isRequired:false, options:COUNTRY_OPTIONS, optionsLimit:COUNTRY_OPTIONS.length },
      { name:'year', isRequired:false, options:YEAR_OPTIONS, optionsLimit:YEAR_OPTIONS.length },
      { name:'skip', isRequired:false }
    ]
  }))
}));

async function handleSearch(req,res) {
  try {
    const extras=parseExtras(req); const keyword=String(extras.search || extras.keyword || '').trim();
    if (!keyword) return res.json({ metas:[] });
    const skip=num(extras.skip,0,0,1000000); const page=Math.floor(skip/64)+1;
    const params=new URLSearchParams({ keyword, page:String(page), limit:'64' });
    const f=normalizeFilters(extras); if(f.category)params.set('category',f.category); if(f.country)params.set('country',f.country); if(f.year)params.set('year',f.year);
    const data=await fetchJson(`/v1/api/tim-kiem?${params}`); const base=imageBase(data);
    const metas=listItems(data).map(x=>metaFromItem(x,req.params.type,base)).filter(Boolean);
    res.set('Cache-Control','public, max-age=120, s-maxage=120'); res.json({ metas });
  } catch(e) { console.error('SEARCH ERROR',e); res.status(502).json({ metas:[], error:e.message }); }
}
app.get('/catalog/:type/search.json', handleSearch);
app.get('/catalog/:type/search/:extra', handleSearch);

async function handleCatalog(req,res) {
  try {
    const catalog=CATALOGS.find(c=>c.id===req.params.id && c.type===req.params.type);
    if (!catalog) return res.status(404).json({ metas:[] });
    const extras=parseExtras(req);
    if (extras.search) { req.params.type=catalog.type; return handleSearch(req,res); }
    const {items,base}=await getCatalogItems(catalog,extras);
    const metas=items.map(x=>metaFromItem(x,catalog.type,base)).filter(Boolean);
    res.set('Cache-Control','public, max-age=120, s-maxage=120'); res.json({ metas });
  } catch(e) { console.error('CATALOG ERROR',e); res.status(502).json({ metas:[], error:e.message }); }
}
app.get('/catalog/:type/:id.json', handleCatalog);
app.get('/catalog/:type/:id/:extra', handleCatalog);

app.get('/meta/:type/:id.json', async (req,res) => {
  try {
    const slug=decodeURIComponent(req.params.id).replace(/^phimapi:/,'');
    const {item,base}=await getMovie(slug); if(!item)return res.status(404).json({meta:null});
    const type=typeForItem(item,req.params.type);
    const meta={ id:`phimapi:${item.slug||slug}`, type, name:item.name||item.origin_name||slug, poster:posterFor(item,base), background:backgroundFor(item,base), posterShape:'poster' };
    if(item.origin_name&&item.origin_name!==item.name)meta.originalTitle=item.origin_name;
    const desc=stripHtml(item.content||item.description); if(desc)meta.description=desc;
    if(item.year)meta.year=Number(item.year);
    const genres=namesOf(item.category); if(genres.length)meta.genres=genres;
    const countries=namesOf(item.country); if(countries.length)meta.country=countries.join(', ');
    if(item.time)meta.runtime=String(item.time);
    const score=item?.imdb?.vote_average||item?.tmdb?.vote_average; if(score)meta.imdbRating=String(Number(score).toFixed(1));
    const eps=episodeEntries(item);
    if(eps.length) meta.videos=eps.map((x,i)=>({ id:`phimapi:${slug}:s${x.serverIndex}:e${x.episodeIndex}`, title:`${x.serverName} — ${x.episode?.name||`Tập ${i+1}`}`, season:Number(x.episode?.season||1), episode:Number(x.episode?.episode||x.episode?.episode_number||i+1), released:item.year?`${item.year}-01-01T00:00:00.000Z`:undefined }));
    res.set('Cache-Control','public, max-age=300, s-maxage=300'); res.json({meta});
  } catch(e) { console.error('META ERROR',e); res.status(502).json({meta:null,error:e.message}); }
});

app.get('/stream/:type/:id.json', async (req,res) => {
  try {
    const rawId=decodeURIComponent(req.params.id); let slug,si=0,ei=0;
    const m=rawId.match(/^phimapi:(.+):s(\d+):e(\d+)$/);
    if(m){slug=m[1];si=Number(m[2]);ei=Number(m[3]);} else if(rawId.startsWith('phimapi:')) slug=rawId.slice(8); else return res.json({streams:[]});
    const {item}=await getMovie(slug); if(!item)return res.json({streams:[]});
    const entries=episodeEntries(item); const selected=m?entries.filter(x=>x.serverIndex===si&&x.episodeIndex===ei):entries;
    const streams=[];
    for(const x of selected){ const ep=x.episode; if(!ep)continue; const title=`${item.name||slug} — ${ep.name||`Tập ${x.episodeIndex+1}`}`;
      if(ep.link_m3u8)streams.push({name:`PhimAPI • ${x.serverName}`,title,url:ep.link_m3u8,behaviorHints:{bingeGroup:`phimapi-${slug}-${x.serverIndex}`}});
      if(ep.link_embed)streams.push({name:`PhimAPI Embed • ${x.serverName}`,title,externalUrl:ep.link_embed});
    }
    res.set('Cache-Control','public, max-age=60, s-maxage=60'); res.json({streams});
  } catch(e){console.error('STREAM ERROR',e);res.status(502).json({streams:[],error:e.message});}
});

app.listen(PORT,()=>console.log(`KKPhim addon listening on ${PORT}`));
