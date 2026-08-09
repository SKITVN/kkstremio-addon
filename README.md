# KKPhim Stremio Addon v5 — GitHub + Render

Bản này được xây dựng lại theo tài liệu API KKPhim hiện tại.

## Các phần chính

- Phim mới cập nhật **v2**: `/danh-sach/phim-moi-cap-nhat-v2`
- Phim bộ: `/v1/api/danh-sach/phim-bo`
- Phim lẻ: `/v1/api/danh-sach/phim-le`
- Phim chiếu rạp: `/v1/api/danh-sach/phim-chieu-rap`
- Hoạt hình và hoạt hình Trung Quốc
- Phân loại theo quốc gia
- Phân loại theo thể loại
- Phân loại theo năm
- Tìm kiếm phim / phim bộ
- Thông tin phim đầy đủ: nội dung, poster, backdrop, năm, thể loại, quốc gia, diễn viên, đạo diễn, rating, trailer, tập phim
- Stream HLS `link_m3u8` và fallback `link_embed`
- Phân biệt ID Movie/Series ngay từ catalog để không làm mất phim bộ do metadata TMDB bị thiếu/sai type
- Phân trang Stremio → `page` API KKPhim

## Deploy Render

Project này dùng `npm install`, không yêu cầu `package-lock.json`.

### GitHub

Upload toàn bộ project vào repository GitHub.

### Render

Dùng **New → Blueprint** và chọn repository. Render đọc `render.yaml`.

Hoặc Web Service:

- Build Command: `npm install`
- Start Command: `npm start`
- Health Check: `/manifest.json`

Manifest sau khi deploy:

```text
https://TEN-SERVICE.onrender.com/manifest.json
```

## Local

```bash
npm install
npm start
```

Mở:

```text
http://localhost:7000/manifest.json
```

## Lưu ý

- Sau khi thay addon trên GitHub, nên gỡ addon KKPhim cũ khỏi Stremio rồi cài lại manifest để tránh cache manifest/catalog cũ.
- API nguồn và stream phụ thuộc KKPhim/PhimAPI và có thể thay đổi.
- Render Free có thể sleep khi không có traffic.
