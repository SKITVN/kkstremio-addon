# KKPhim Stremio Addon — Final

Bản này được tối giản đúng theo yêu cầu:

1. **KKPhim - Phim mới**
2. **KKPhim - Phim bộ**
3. **KKPhim - Phim lẻ**
4. **KKPhim - Phim chiếu rạp**
5. **KKPhim - Hoạt hình**

Stremio bắt buộc catalog phải có `type` riêng cho `movie` và `series`, vì vậy các mục có cả hai loại được khai báo thành hai catalog nội bộ nhưng dùng cùng tên hiển thị. Đây là yêu cầu của giao thức Stremio, không phải thêm mục lọc. 

## Điểm sửa quan trọng

### Phim bộ
Dùng trực tiếp:

`/v1/api/danh-sach/phim-bo`

Không lọc lại bằng TMDB/type. Endpoint này đã là danh sách phim bộ.

### Phân trang
Stremio thường yêu cầu `skip=0,100,200...`, trong khi KKPhim trả khoảng 24 phim/trang. Addon ghép tối đa 5 trang KKPhim thành 100 item cho mỗi trang Stremio. Vì vậy catalog không còn dừng ở 24 phim.

### Phim mới
Dùng:

`/danh-sach/phim-moi-cap-nhat-v2`

theo yêu cầu.

### Phim lẻ
Dùng:

`/v1/api/danh-sach/phim-le`

### Phim chiếu rạp
Dùng endpoint KKPhim được tài liệu hóa:

`/danh-sach/phim-chieu-rap`

### Hoạt hình
Dùng:

`/v1/api/danh-sach/hoat-hinh`

và phân loại movie/series theo TMDB/type.

### Thông tin phim
Khi mở phim, addon gọi:

`/v1/api/phim/{slug}`

để lấy mô tả, poster, thể loại, quốc gia, diễn viên, đạo diễn, trailer và danh sách tập/server. Stream dùng `link_m3u8` và fallback `link_embed`.

## GitHub + Render

1. Xóa các file addon cũ trong repository.
2. Upload toàn bộ file của project này.
3. Commit/push.
4. Render sẽ tự deploy.
5. Manifest:

`https://kkphim-stremio-addon.onrender.com/manifest.json`

Sau khi deploy bản mới, gỡ addon KKPhim cũ khỏi Stremio và cài lại manifest.

## Lưu ý

Addon lấy dữ liệu/stream từ API KKPhim/PhimAPI. Việc nguồn phim có tồn tại và URL stream còn hoạt động phụ thuộc API bên ngoài.
