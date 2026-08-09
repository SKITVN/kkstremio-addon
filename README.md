# Nuvio / Stremio KKPhim Addon v4.6

Addon dùng API KKPhim/PhimAPI.

## Catalog
- Phim Mới
- Phim Bộ
- Phim Lẻ
- Phim Chiếu Rạp
- Hoạt Hình

## Bộ lọc riêng trong từng catalog
Mỗi catalog khai báo 3 bộ lọc độc lập:
- `genre`: Thể loại phim
- `country`: Hàn Quốc / Trung Quốc / Âu Mỹ
- `year`: Năm phát hành từ năm kế tiếp đến 1970

Các bộ lọc có thể kết hợp. Ví dụ:
- Quốc gia = Hàn Quốc
- Năm = 2025

Addon sẽ gọi API danh sách với đồng thời `country=han-quoc&year=2025`.
Có thể kết hợp thêm thể loại, ví dụ `category=hanh-dong&country=han-quoc&year=2025`.

## Deploy Render
1. Upload toàn bộ file trong ZIP lên repo GitHub.
2. Render deploy lại repo.
3. Mở `/manifest.json` để kiểm tra version `4.6.0`.
4. Gỡ addon cũ khỏi Nuvio/Stremio rồi cài lại manifest để client tải manifest mới.

## Local
```bash
npm install
npm start
```
