
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
