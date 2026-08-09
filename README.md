# Nuvio PhimAPI Addon v5

Bản này sửa 3 lỗi chính:

1. Poster trong catalog dùng **URL tuyệt đối** từ `poster_url`/`thumb_url`.
2. Phim Bộ dùng đúng catalog `series` và endpoint `/v1/api/danh-sach/phim-bo`.
3. Pagination dùng đúng `skip` của Nuvio/Stremio:
   - skip=0 -> API page=1
   - skip=24 -> API page=2
   - skip=48 -> API page=3
   - ...

Không còn gộp 3 trang thành một response, vì cách đó làm Nuvio tính sai `skip` và có thể bỏ qua trang tiếp theo.

## Catalog

- Phim Mới
- Phim Bộ
- Phim Lẻ
- Phim Chiếu Rạp
- Hoạt Hình
- Tìm kiếm

## Render

Build:
`npm install`

Start:
`npm start`

Sau khi deploy:

`https://TEN-SERVICE.onrender.com/manifest.json`

## Test

- `/health`
- `/manifest.json`
- `/catalog/movie/phim-moi.json`
- `/catalog/series/phim-bo.json`
- `/catalog/movie/phim-le.json`
- `/catalog/movie/phim-chieu-rap.json`
- `/catalog/series/hoat-hinh.json`

## Cài vào Nuvio

Xóa addon v4 cũ trước, sau đó cài manifest v5:

`https://TEN-SERVICE.onrender.com/manifest.json`

Nếu Nuvio vẫn giữ cache catalog cũ, thoát Nuvio hoàn toàn rồi mở lại và cài manifest mới.
