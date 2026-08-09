# Nuvio PhimAPI Addon v3

Bản này sửa ba lỗi chính của các bản trước:

1. **Poster không hiện**
   - API trả `poster_url`/`thumb_url` từ nhiều CDN khác nhau.
   - Addon có `/image` proxy để Nuvio lấy ảnh thông qua chính server Render.

2. **Phim Bộ không hiện**
   - Dùng đúng endpoint:
     `/danh-sach/phim-bo`
   - Catalog khai báo đúng `type: series`.

3. **Mất Phim Mới / Phim Lẻ / Phim Chiếu Rạp**
   - Dùng đúng các endpoint danh sách:
     - `/danh-sach/phim-moi-cap-nhat`
     - `/danh-sach/phim-bo`
     - `/danh-sach/phim-le`
     - `/danh-sach/phim-chieu-rap`
     - `/danh-sach/hoat-hinh`

Các endpoint danh sách cũ của PhimAPI hỗ trợ `page` và trả `items`, `poster_url`, `thumb_url`, `slug`; tài liệu PhimAPI cũng xác nhận `phim-bo`, `phim-le`, `hoat-hinh`, `tv-shows`, `phim-chieu-rap` là các loại hợp lệ. citeturn2search0

## Render

Build Command:

```text
npm install
```

Start Command:

```text
npm start
```

Không cần thư mục `api`.

## Test sau deploy

Thay `TEN-SERVICE` bằng tên Render của bạn:

```text
https://TEN-SERVICE.onrender.com/health
```

```text
https://TEN-SERVICE.onrender.com/manifest.json
```

Catalog:

```text
https://TEN-SERVICE.onrender.com/catalog/movie/phim-moi.json
https://TEN-SERVICE.onrender.com/catalog/series/phim-bo.json
https://TEN-SERVICE.onrender.com/catalog/movie/phim-le.json
https://TEN-SERVICE.onrender.com/catalog/movie/phim-chieu-rap.json
https://TEN-SERVICE.onrender.com/catalog/series/hoat-hinh.json
```

## Quan trọng

Sau khi deploy bản v3:

1. Vào Nuvio.
2. Xóa addon PhimAPI cũ.
3. Thêm lại URL:
   `https://TEN-SERVICE.onrender.com/manifest.json`
4. Chờ Render thức dậy nếu đang dùng Free instance.

Không dùng manifest cũ đã cache trong Nuvio.
