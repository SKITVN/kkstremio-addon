# Nuvio PhimAPI Addon v4.3

Addon **Nuvio / Stremio** dùng [PhimAPI (KKPhim)](https://phimapi.com).

## v4.3 — Infinite scroll

**Lỗi:** client dừng load khi nhận **< 100** phim (chuẩn Stremio). API chỉ trả 24/trang → coi như hết catalog.

**Sửa:**
- Mỗi request trả **~100 phim** (gộp ~5 trang API)
- Đọc `skip` từ **query** (`?skip=100`) **và path** (`/catalog/movie/phim-le/skip=100.json`)
- Map `skip` → đúng trang API, không trùng / nhảy trang

## Catalog

| Catalog | Type | API |
|---------|------|-----|
| Phim Mới | movie | phim-moi-cap-nhat |
| Phim Bộ | series | phim-bo |
| Phim Lẻ | movie | phim-le |
| Phim Chiếu Rạp | movie | phim-chieu-rap |
| Hoạt Hình | series | hoat-hinh |

> Phim Bộ / Hoạt Hình nằm trong tab **Series**.

## Deploy Render

1. Push GitHub → Render deploy
2. Manifest: `https://YOUR-APP.onrender.com/manifest.json`
3. **Gỡ addon cũ trong Nuvio → cài lại** (xóa cache)

## Local

```bash
npm install && npm start
```

http://localhost:10000/manifest.json

## License

MIT
