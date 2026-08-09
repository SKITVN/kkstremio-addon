# Nuvio PhimAPI Addon v4

Bản này sử dụng đúng tài liệu API KKPhim/PhimAPI trong các ảnh người dùng cung cấp.

## API đã tích hợp

### Catalog
- Phim Mới: `GET /v1/api/danh-sach?page=1`
- Phim Bộ: `GET /v1/api/danh-sach/phim-bo?page=1`
- Phim Lẻ: `GET /v1/api/danh-sach/phim-le?page=1`
- Phim Chiếu Rạp: `GET /v1/api/danh-sach/phim-chieu-rap?page=1`
- Hoạt Hình: `GET /v1/api/danh-sach/hoat-hinh?page=1`

### Bộ lọc
Addon nhận và chuyển tiếp:
- `page`
- `limit`
- `category`
- `country`
- `year`
- `sort_field`
- `sort_type`
- `sort_lang`

### Tìm kiếm
`GET /v1/api/tim-kiem?keyword=...&limit=64`

### Chi tiết
`GET /v1/api/phim/{slug}`

### Hình ảnh
`GET /v1/api/phim/{slug}/images`

Addon ưu tiên ảnh TMDB từ endpoint `/images`, sau đó fallback về
`poster_url` / `thumb_url` của danh sách.

### Stream
Đọc `episodes`, `server_data`, `link_m3u8`, `link_embed`.

## Vì sao bản này nhiều phim hơn

API danh sách trả mặc định 24 phim/trang. Nuvio thường chỉ gọi một trang catalog.

Addon v4 mặc định tải **3 trang API** cho mỗi lần gọi catalog và gộp lại thành một danh sách. Có thể đổi bằng:

```text
?pages=1
?pages=3
?pages=5
```

Giới hạn 5 trang để tránh tạo request quá nặng.

## Poster

Tất cả poster/background được đi qua:

```text
/image?url=...
```

Proxy hỗ trợ:
- phimapi.com
- phimimg.com
- img.phimapi.com
- image.tmdb.org

Điều này xử lý trường hợp Nuvio/Stremio không tải trực tiếp được CDN poster.

## Render

Build Command:

```text
npm install
```

Start Command:

```text
npm start
```

Health Check:

```text
/health
```

Không dùng `api/index.js`.

## Sau khi deploy

Ví dụ:

```text
https://TEN-SERVICE.onrender.com/manifest.json
```

Test:

```text
https://TEN-SERVICE.onrender.com/catalog/movie/phim-moi.json
https://TEN-SERVICE.onrender.com/catalog/series/phim-bo.json
https://TEN-SERVICE.onrender.com/catalog/movie/phim-le.json
https://TEN-SERVICE.onrender.com/catalog/movie/phim-chieu-rap.json
https://TEN-SERVICE.onrender.com/catalog/series/hoat-hinh.json
```

Search:

```text
https://TEN-SERVICE.onrender.com/catalog/movie/search.json?search=avengers
```

Sau khi deploy bản v4, xóa addon cũ khỏi Nuvio rồi cài lại:

```text
https://TEN-SERVICE.onrender.com/manifest.json
```
