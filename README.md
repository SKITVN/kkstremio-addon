# Nuvio / Stremio KKPhim Addon v4.5

Addon dùng API KKPhim/PhimAPI.

## Catalog
- Phim Mới
- Phim Bộ
- Phim Lẻ
- Phim Chiếu Rạp
- Hoạt Hình

## Bộ lọc trong từng catalog
Bộ chọn `genre` gồm:
- Quốc gia • Hàn Quốc
- Quốc gia • Trung Quốc
- Quốc gia • Âu Mỹ
- Năm • 2027, 2026, 2025... đến 1970
- Các thể loại phim hiện có

Addon tự map lựa chọn sang tham số API `country`, `year` hoặc `category`.

## Deploy Render
1. Upload toàn bộ file trong ZIP lên repo GitHub.
2. Render deploy lại repo.
3. Mở `/manifest.json` để kiểm tra version `4.5.0`.
4. Gỡ addon cũ khỏi Nuvio/Stremio rồi cài lại manifest để tránh cache manifest cũ.

## Local
```bash
npm install
npm start
```
