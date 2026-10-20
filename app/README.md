# TechVerse frontend

Frontend dùng Next.js + TypeScript và đã gọi REST API Spring Boot qua `services/index.ts`. URL mặc định là `http://localhost:8080/api`; có thể đổi bằng `NEXT_PUBLIC_API_URL`.

## Chạy local

```bash
npm install
npm run dev
```

Các lệnh kiểm tra:

```bash
npm run typecheck
npm run lint
npm run build
```

## Kiến trúc dữ liệu

- `types/`: entity bám theo migration PostgreSQL và service contract dự kiến.
- `mocks/`: dữ liệu cũ để tham khảo UI, không được dùng bởi service production.
- `services/`: HTTP adapter và boundary mà UI sử dụng.
- `services/`: boundary mà UI sử dụng, không gọi trực tiếp mock hoặc database.
- `components/`: layout và UI dùng chung.
- `app/`: route/page của Next.js App Router.

## Endpoint đã nối

- `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`
- `GET /topics`, `/articles`, `/articles/{slug}`, `/documents`, `/courses/{id}`
- `GET /exercises`, `/exercises/{id}`, `POST /exercises/{id}/submit`, `GET /interviews`
- `GET /community/questions`, `POST /community/questions`
- `POST/DELETE /articles/{id}/save`, `POST/DELETE /documents/{id}/save`, `POST /courses/{id}/enroll`

OAuth, payment, realtime chat, AI, notification và admin moderation vẫn là các UC phase sau; schema đã có nền cho payment/moderation.
