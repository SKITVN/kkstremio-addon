# Nuvio PhimAPI Addon — Render

Bản này đã được đóng gói để deploy trực tiếp trên **Render**.

## Sửa lỗi Render

Không còn:

```text
Cannot find module './api/index'
```

Toàn bộ server nằm trong `server.js`, nên Render chỉ cần chạy:

```text
npm start
```

## Deploy Render

- Build Command:
```text
npm install
```

- Start Command:
```text
npm start
```

Không cần Root Directory khác. Đặt repository root là nơi chứa `server.js` và `package.json`.

Sau khi deploy:

```text
https://TEN-SERVICE.onrender.com/manifest.json
```

## Catalog

- Phim Mới
- Phim Bộ
- Phim Lẻ
- Phim Chiếu Rạp
- Hoạt Hình

## Stream

Addon có resource `stream`.

PhimAPI trả `link_m3u8` thì addon trả URL HLS trực tiếp cho Nuvio/Stremio.

Nếu không có `link_m3u8`, addon trả `link_embed` dưới dạng `externalUrl`.

## Test

```text
/health
/manifest.json
/catalog/movie/phim-le.json
/catalog/series/phim-bo.json
```

Nguồn dữ liệu: phimapi.com.
