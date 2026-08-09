# KKPhim Stremio — GitHub + Render

Bản 4.0.0 tập trung đúng 5 nhóm người dùng yêu cầu:

- Phim mới (dùng `phim-moi-cap-nhat-v2`)
- Phim bộ
- Phim lẻ
- Phim chiếu rạp
- Hoạt hình

## API chính

- `GET /danh-sach/phim-moi-cap-nhat-v2`
- `GET /v1/api/danh-sach/phim-bo`
- `GET /v1/api/danh-sach/phim-le`
- `GET /danh-sach/phim-chieu-rap`
- `GET /v1/api/danh-sach/hoat-hinh`
- `GET /v1/api/phim/{slug}`
- `GET /v1/api/phim/{slug}/images`
- `GET /v1/api/phim/{slug}/peoples`
- `GET /v1/api/phim/{slug}/keywords`

## Poster

KKPhim v1 có trường `poster_url`/`thumb_url` ở một số danh sách chỉ là filename, trong khi API chi tiết trả URL `phimimg.com/upload/vod/...`. Addon tự bổ sung poster bằng API chi tiết cho các phim đầu tiên của mỗi trang catalog.

## Pagination

Stremio yêu cầu `skip` theo block 100. Addon chuyển mỗi block thành tối đa 5 trang KKPhim (24 phim/trang), không dùng `Promise.all` toàn bộ block để tránh một request lỗi làm mất cả catalog.

## Render

Build: `npm install`

Start: `npm start`

Health check: `/manifest.json`
