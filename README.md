# Nuvio PhimAPI Addon v4.1

Addon **Nuvio / Stremio** dùng [PhimAPI (KKPhim)](https://phimapi.com) — [Tài liệu API](https://kkphim.com/api-document).

## Sửa lỗi poster (v4.1)

**Nguyên nhân:** v4 trả poster dạng relative `/image?url=...` → Nuvio/Stremio không load được.

**Cách sửa:**
- Dùng CDN tuyệt đối `https://phimimg.com/...` (từ `APP_DOMAIN_CDN_IMAGE` của API)
- Bỏ phụ thuộc proxy cho poster (proxy vẫn giữ, bật bằng `FORCE_IMAGE_PROXY=1` nếu cần)

## Meta bổ sung từ API

- Tên gốc (`originalTitle`)
- Mô tả (strip HTML)
- Thể loại, quốc gia
- Đạo diễn, diễn viên
- IMDb / TMDB rating
- Chất lượng, ngôn ngữ (Vietsub…), runtime
- Trailer (nếu có)
- Tập / tổng tập

## Catalog

- Phim Mới
- Phim Bộ
- Phim Lẻ
- Phim Chiếu Rạp
- Hoạt Hình

## Deploy Render

1. Push repo lên GitHub
2. Render → **New Web Service** → connect repo
3. Build: `npm install` | Start: `npm start`
4. Manifest: `https://YOUR-APP.onrender.com/manifest.json`
5. Nuvio → Settings → Add-ons → Install via URL

`render.yaml` đã có sẵn trong repo.

## Local

```bash
npm install
npm start
```

http://localhost:10000/manifest.json

## Env (tùy chọn)

| Biến | Mô tả |
|------|--------|
| `PORT` | Port (Render tự gán) |
| `PUBLIC_URL` / `RENDER_EXTERNAL_URL` | URL public (proxy ảnh tuyệt đối) |
| `FORCE_IMAGE_PROXY=1` | Bắt buộc đi qua `/image` proxy |

## License

MIT
