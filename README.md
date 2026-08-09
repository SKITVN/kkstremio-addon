# KKPhim Stremio Addon v6

Bản v6 sửa lỗi `manifest size exceeds 8kb` của bản v5.

## Catalogs

- Phim mới cập nhật v2 — phim lẻ
- Phim mới cập nhật v2 — phim bộ
- Phim bộ
- Phim lẻ
- Phim chiếu rạp
- Hoạt hình — phim bộ/phim lẻ
- Hoạt hình Trung Quốc
- Tìm kiếm phim/phim bộ
- Lọc phim: quốc gia, thể loại, năm
- Lọc phim bộ: quốc gia, thể loại, năm

## Vì sao v5 lỗi?

Bản v5 tạo một catalog riêng cho từng quốc gia, thể loại và năm, đồng thời tách movie/series. Số lượng catalog làm manifest vượt giới hạn 8 KiB của `stremio-addon-sdk`.

V6 dùng 2 catalog lọc chung và khai báo các lựa chọn trong `extra.options`, nên manifest nhỏ hơn giới hạn. Stremio hỗ trợ `extra` với `options` cho catalog filters.

## Deploy Render

- Build: `npm install`
- Start: `npm start`
- Health check: `/manifest.json`

Sau khi Render deploy thành công, cài:

`https://kkphim-stremio-addon.onrender.com/manifest.json`

## Lưu ý

API nguồn và URL stream phụ thuộc vào KKPhim/PhimAPI và có thể thay đổi.
