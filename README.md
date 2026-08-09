# KKPhim Addon cho Nuvio v4.8

Bản này tối ưu riêng cho **Nuvio**.

## Cách lọc trên Nuvio
Nuvio hiện hiển thị ổn định bộ lọc `genre`, nhưng không hiển thị riêng custom extra `country` và `year`. Vì vậy addon dùng cách sau:

1. Chọn nhóm phim: **Phim Mới / Phim Bộ / Phim Lẻ / Phim Chiếu Rạp / Hoạt Hình**.
2. Nếu muốn lọc quốc gia, chọn catalog tương ứng, ví dụ **Phim Bộ · Hàn Quốc**.
3. Trong catalog quốc gia, bộ chọn của Nuvio sẽ hiển thị **năm phát hành**. Chọn ví dụ **2025**.
4. Addon gọi PhimAPI với đồng thời `country=han-quoc&year=2025`.

## Catalog
Mỗi nhóm được xếp liền nhau:
- Phim Mới
- Phim Mới · Hàn Quốc
- Phim Mới · Trung Quốc
- Phim Mới · Âu Mỹ

Sau đó tương tự cho Phim Bộ, Phim Lẻ, Phim Chiếu Rạp và Hoạt Hình.

Catalog gốc giữ bộ lọc **thể loại**. Catalog quốc gia dùng bộ lọc **năm phát hành**.

## Giữ nguyên
- Poster / background
- Meta phim
- Stream M3U8 và embed
- Phân trang nhiều trang API, trả tối đa 100 phim/lần
- Tìm kiếm; khi tìm trong catalog quốc gia, preset quốc gia vẫn được giữ

## Deploy
1. Giải nén ZIP.
2. Upload đè toàn bộ file lên repo GitHub.
3. Chờ Render deploy lại.
4. Mở `/manifest.json`, kiểm tra version `4.8.0`.
5. Gỡ addon KKPhim cũ khỏi Nuvio rồi cài lại manifest để Nuvio tải danh sách catalog mới.

## Local
```bash
npm install
npm start
```
