# Nuvio PhimAPI Addon v4.2

Addon **Nuvio / Stremio** dùng [PhimAPI (KKPhim)](https://phimapi.com) — [Tài liệu API](https://kkphim.com/api-document).

## Changelog

### v4.2
- **Infinite scroll**: mỗi request = 1 trang API (24 phim), map đúng `skip` → page
- **Phim Bộ** (series) hoạt động ổn định, `type: "series"`
- Catalog Phim Mới dùng endpoint `phim-moi-cap-nhat`

### v4.1
- Poster absolute CDN `https://phimimg.com/...`
- Meta đầy đủ: origin name, cast, director, rating, quality, lang…

## Catalog

| Catalog | Type | API slug |
|---------|------|----------|
| Phim Mới | movie | phim-moi-cap-nhat |
| Phim Bộ | series | phim-bo |
| Phim Lẻ | movie | phim-le |
| Phim Chiếu Rạp | movie | phim-chieu-rap |
| Hoạt Hình | series | hoat-hinh |

> **Phim Bộ** nằm trong mục **Series** trên Nuvio (không phải Movies).

## Deploy Render

1. Push repo lên GitHub
2. Render → New Web Service → connect repo
3. Build: `npm install` | Start: `npm start`
4. Manifest: `https://YOUR-APP.onrender.com/manifest.json`
5. Nuvio → Settings → Add-ons → Install via URL  
   (nên **gỡ addon cũ** rồi cài lại để clear cache catalog)

## Local

```bash
npm install
npm start
```

http://localhost:10000/manifest.json

## License

MIT
