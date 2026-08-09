# PhimAPI Việt Nam — Nuvio Addon

Addon catalog cho **Nuvio/Stremio**, sử dụng API `phimapi.com`.

## Catalog

- Phim Mới
- Phim Bộ
- Phim Lẻ
- Phim Chiếu Rạp
- Hoạt Hình

## Các tham số API được hỗ trợ

Theo tài liệu PhimAPI:

- `page` — trang hiện tại, mặc định `1`
- `limit` — số phim/trang khi API hỗ trợ, tối đa `64`
- `category` — slug thể loại, ví dụ `hanh-dong`
- `country` — slug quốc gia, ví dụ `han-quoc`
- `year` — năm hoặc khoảng năm, ví dụ `2024` hoặc `2014,2024`
- `sort_field` — `modified.time`, `_id`, `year`
- `sort_type` — `desc`, `asc`
- `sort_lang` — `vietsub`, `thuyet-minh`, `long-tieng`

Addon truyền các tham số trên xuống API khi chúng được gửi vào catalog request.

## Chạy local

Yêu cầu Node.js 18+.

```bash
npm install
npm start
```

Mở:

```text
http://localhost:7000/manifest.json
```

## Deploy bằng GitHub + Vercel

1. Tạo repository GitHub mới.
2. Upload toàn bộ file trong repository này.
3. Đăng nhập Vercel.
4. Import repository GitHub.
5. Deploy, không cần thêm Environment Variable.
6. Sau khi deploy, manifest có dạng:

```text
https://TEN-MIỀN-CUA-BAN.vercel.app/manifest.json
```

7. Trong Nuvio vào **Settings → Addons → Add addon** và dán manifest URL.

## Endpoint kiểm tra

```text
GET /manifest.json
GET /health
GET /catalog/movie/phim-le.json
GET /catalog/series/phim-bo.json
GET /catalog/movie/phim-moi.json
GET /catalog/movie/phim-chieu-rap.json
GET /catalog/series/hoat-hinh.json
```

Ví dụ truyền bộ lọc:

```text
/catalog/movie/phim-le.json?country=han-quoc&year=2024&page=1
```

Hoặc:

```text
/catalog/movie/phim-le.json?category=hanh-dong&sort_field=year&sort_type=desc
```

## Lưu ý

Addon có cả **catalog + metadata + stream**. Khi PhimAPI trả về `link_m3u8`, addon đưa trực tiếp URL HLS đó vào Nuvio/Stremio; nếu không có M3U8 thì giữ `link_embed` làm phương án dự phòng.

Nguồn dữ liệu: `https://phimapi.com`.

## Cấu trúc

```text
nuvio-phimapi-addon/
├─ api/
│  └─ index.js
├─ .gitignore
├─ package.json
├─ server.js
├─ vercel.json
└─ README.md
```
