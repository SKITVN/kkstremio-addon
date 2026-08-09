# KKPhim Stremio Addon — GitHub + Render

Addon Stremio sử dụng API KKPhim/PhimAPI.

## Deploy nhanh bằng GitHub + Render

1. Tạo một repository GitHub mới, ví dụ `kkphim-stremio-addon`.
2. Upload toàn bộ file trong thư mục project này vào repository.
3. Vào Render → **New → Blueprint**.
4. Chọn repository GitHub vừa tạo.
5. Render sẽ đọc `render.yaml` và tạo Web Service.
6. Sau khi deploy xong, Render sẽ cấp URL dạng:
   `https://kkphim-stremio-addon.onrender.com`
7. Manifest để cài vào Stremio:
   `https://kkphim-stremio-addon.onrender.com/manifest.json`

## Deploy thủ công trên Render

Nếu không dùng Blueprint:

- Runtime: Node
- Build Command: `npm ci`
- Start Command: `npm start`
- Health Check Path: `/manifest.json`

Không hard-code port; server phải sử dụng biến môi trường `PORT` do Render cung cấp.

## Chạy local

```bash
npm ci
npm start
```

Mở:

```text
http://localhost:7000/manifest.json
```

## Cấu trúc

```text
.
├── addon.js
├── server.js
├── package.json
├── render.yaml
├── Dockerfile
├── .dockerignore
├── .gitignore
├── LICENSE
├── README.md
└── .github/
    └── workflows/
        └── node-check.yml
```

## Lưu ý

- Render Free có thể đưa service vào trạng thái ngủ khi không có traffic; request đầu tiên sau thời gian không hoạt động có thể chậm.
- API nguồn và URL stream phụ thuộc vào KKPhim/PhimAPI và có thể thay đổi.
- Chỉ sử dụng addon với nội dung/nguồn mà bạn có quyền truy cập.
