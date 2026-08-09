# Nuvio PhimAPI Addon v2

Bản sửa hoàn chỉnh cho Render/Nuvio.

## Đã sửa

- Phim Bộ dùng `type: series` và endpoint riêng.
- Phim Lẻ dùng `type: movie`.
- Hoạt Hình dùng `type: series`.
- Poster lấy trực tiếp từ `poster_url`; nếu API trả filename thì ghép với `pathImage`.
- Có fallback API legacy nếu endpoint v1 không trả dữ liệu.
- Có metadata và danh sách tập.
- Có stream `link_m3u8` và fallback `link_embed`.
- Render chạy bằng duy nhất `server.js`, không phụ thuộc `api/index.js`.

## Render

Build:
```text
npm install
```

Start:
```text
npm start
```

Health:
```text
/health
```

Manifest:
```text
/manifest.json
```

Sau khi deploy, dùng:

```text
https://TEN-SERVICE.onrender.com/manifest.json
```

### Quan trọng khi cập nhật

Nuvio lưu manifest/catalog đã cài. Sau khi deploy bản mới:

1. Xóa addon cũ khỏi Nuvio.
2. Thêm lại URL `/manifest.json`.
3. Nếu Render Free đang sleep, mở `/health` trước để đánh thức service.
4. Sau đó mở lại Nuvio.

PhimAPI API v1 cung cấp `poster_url`, `thumb_url`, danh sách phim trong `data.items`, và episode trong `data.item.episodes`; episode có `link_m3u8`/`link_embed`.
