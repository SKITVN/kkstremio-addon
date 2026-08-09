# KKPhim Stremio Addon — GitHub + Render

Addon Stremio dùng API KKPhim/PhimAPI (`https://phimapi.com`).

## Quan trọng: lỗi poster đã được sửa

API v1 của KKPhim có thể trả `poster_url`/`thumb_url` dưới dạng đường dẫn tương đối, ví dụ `upload/vod/...`. Trong khi API cũ `/danh-sach/...` và `/phim/{slug}` trả URL đầy đủ trên `phimimg.com`.

Addon này:

- ưu tiên URL poster đầy đủ từ API;
- dùng API cũ `/phim/{slug}` để lấy URL poster chuẩn khi catalog v1 chỉ trả filename/relative path;
- dùng `/v1/api/phim/{slug}/images` để lấy poster/backdrop TMDB khi API cung cấp ảnh;
- metadata lấy thêm diễn viên/ê-kíp và keywords.

## Các nhóm GET KKPhim đã tích hợp

### Phim mới / danh sách

- `/danh-sach/phim-moi-cap-nhat`
- `/v1/api/home`
- `/v1/api/danh-sach`
- `/danh-sach/{type}` với `phim-le`, `phim-bo`, `hoat-hinh`, `tv-shows`, `phim-chieu-rap`
- `/v1/api/tim-kiem`

### Chi tiết

- `/phim/{slug}`
- `/phim/id/{id}`
- `/tmdb/{type}/{id}`
- `/imdb/title/{id}`
- `/v1/api/phim/{slug}`
- `/v1/api/phim/{slug}/images`
- `/v1/api/phim/{slug}/peoples`
- `/v1/api/phim/{slug}/keywords`

### Bộ lọc

- `/the-loai`
- `/v1/api/the-loai`
- `/v1/api/the-loai/{slug}`
- `/quoc-gia`
- `/v1/api/quoc-gia/{slug}`
- `/nam-phat-hanh`
- `/v1/api/nam/{year}`

Các bộ lọc v1 dùng `page`, `limit`, `category`, `country`, `year`, `sort_field`, `sort_type`, `sort_lang`.

## Catalog trong Stremio

- Phim mới
- Phim bộ
- Phim lẻ
- Hoạt hình (movie/series)
- Hoạt hình Trung Quốc (movie/series)
- Chiếu rạp
- Vietsub
- Thuyết minh
- Lồng tiếng
- Tìm kiếm movie/series

## Deploy GitHub + Render

1. Tạo repository GitHub mới.
2. Upload toàn bộ file của project.
3. Render → **New → Blueprint** → chọn repository.
4. Render đọc `render.yaml` và deploy.
5. Sau khi deploy, dùng:

```text
https://TEN-SERVICE.onrender.com/manifest.json
```

để cài addon vào Stremio.

## Nếu Render đã có service

Nếu service hiện tại đang lỗi vì `npm ci`, đổi Build Command thành:

```text
npm install
```

Start Command:

```text
npm start
```

## Chạy local

```bash
npm install
npm start
```

Manifest:

```text
http://localhost:7000/manifest.json
```

## Lưu ý

API nguồn và URL stream có thể thay đổi. Render Free có thể sleep khi không có traffic, nên request đầu tiên sau một thời gian không hoạt động có thể chậm.


## v1.3 pagination / phim bộ

Bản 1.3 dùng các endpoint v1 `/v1/api/danh-sach/{type}` thay cho endpoint legacy `/danh-sach/{type}` cho các catalog phim bộ/phim lẻ/hoạt hình. API v1 có pagination và bộ lọc đầy đủ. Catalog manifest cũng khai báo `extra.skip` để Stremio có thể yêu cầu các trang tiếp theo.
