# CLAUDE.md — CineSync

Hướng dẫn cho AI coding agent khi làm việc trên repo này.

## 1. Dự án là gì

**CineSync** — website xem phim online (đồ án SV CNTT, tiếng Việt là ngôn ngữ UI). Nền tảng xem phim + Watch Party (xem chung real-time) + lớp xã hội (Follow/Feed) + gợi ý cá nhân hóa.

Dữ liệu phim lấy từ **MDP** (Movie Data Provider bên thứ ba) qua Backend proxy — **KHÔNG tự lưu dữ liệu phim vào DB**, chỉ lưu tham chiếu `movie_slug` + snapshot tối thiểu (`movie_name`, `poster_url`, `movie_year`).

## 2. Tài liệu nguồn sự thật (ba_docs/)

Đọc trước khi làm bất kỳ tính năng nào:

| File | Nội dung |
|---|---|
| `01_CineSync_Business_Analysis.md` | Use case, Business Rules (BR-01→16), NFR (NFR-01→10), tích hợp MDP |
| `02_CineSync_Diagrams.md` | Use Case / Activity Diagram |
| `03_CineSync_ERD.md` | ERD 15 bảng + ràng buộc ERD-R-01→18 |
| `04_CineSync_database_design.md` | Ghi chú triển khai DB |
| `05_CineSync_API_Specification.md` | Đặc tả REST/WebSocket đầy đủ — nguồn sự thật API |
| `06_CineSync_Wireframe_Specification.md` | Design system + wireframe từng màn hình (SCR-G/U/A-xx) |
| `07_CineSync_Architecture.md` | Kiến trúc tổng thể BE/FE/deploy |
| `08_CineSync_Technical_Spec.md` | Chi tiết kỹ thuật để code (cấu trúc thư mục, pseudocode, env) |
| `database/cinesync_postgresql_schema.sql` | DDL PostgreSQL — nguồn sự thật schema |

## 3. Tech Stack

- **Backend**: NestJS 11.x (Node.js 22 LTS, TypeScript) — monolith duy nhất chứa REST + Socket.IO Gateway `/watch-party`, chạy trên Railway
- **ORM**: Drizzle ORM + `pg` — schema TS map 1-1 với file SQL DDL, không định nghĩa lại ràng buộc
- **Frontend**: Next.js 15 App Router + TailwindCSS 4 + TanStack Query 5 + Socket.IO client, deploy Vercel
- **DB**: PostgreSQL 16+ (Railway)
- **Auth**: JWT AccessToken (1h) + RefreshToken random (30 ngày, lưu DB bảng `refresh_tokens`) trong cookie httpOnly
- **Validation**: Backend dùng `class-validator`; Frontend form dùng `zod`

## 4. Cấu trúc thư mục

```
backend/          # NestJS (chưa init — bootstrap khi bắt đầu làm)
  src/
    config/ common/ modules/{auth,users,movies,favorites,watchlists,
    watch-history,ratings,comments,watch-party,social,recommendations,admin}/
    integration/mdp-client.ts    # cache TTL + retry(2 lần backoff) + fallback + ghi api_call_logs
    db/{schema.ts, migrations/}
frontend/         # Next.js (chưa init)
  app/
    (public)/ page.tsx, movies/[slug]/, search/, watch-party/[roomCode]/
    (user)/ profile/, feed/, settings/
    (admin)/ admin/
    api/auth/route.ts            # Route Handler set/clear cookie JWT httpOnly
  lib/{api-client.ts, socket-client.ts}
database/         # cinesync_postgresql_schema.sql (nguồn sự thật DDL)
ba_docs/          # tài liệu phân tích
```

Chi tiết cấu trúc đầy đủ: `08_CineSync_Technical_Spec.md` mục 2 và `07_CineSync_Architecture.md` mục 3-4.

## 5. Quy ước bắt buộc

### Response format (Backend)
Mọi REST response bọc envelope chuẩn (dùng `ResponseInterceptor` / `HttpExceptionFilter`):
```json
// OK: { "success": true, "message": "...", "data": {...} }
// Lỗi: { "success": false, "message": "...", "errors": { "<field>": "<message>" } }
// Phân trang: data = { items: [...], pagination: {page,pageSize,total,totalPages} }
```
HTTP status: 200/201/400/401/403/404/409 (đã tồn tại)/500/**502** (lỗi gọi MDP).

### Naming
- API prefix `/api/v1/`, danh từ số nhiều, kebab-case nhiều từ (`/watch-history`, `/watch-parties`)
- Khóa tham chiếu phim xuyên suốt: `movieSlug` (API) / `movie_slug` (DB)
- `episode_slug` dùng `''` (chuỗi rỗng) làm sentinel cho phim lẻ, KHÔNG dùng NULL (để UNIQUE constraint hoạt động)

### Layered Architecture Backend
Controller → Service → Repository/Drizzle. Không viết query SQL trực tiếp ngoài Repository. Validation bằng DTO decorator. Guard: `JwtAuthGuard` (REST), `RolesGuard` (USER/ADMIN), `WsJwtGuard` (Socket.IO handshake qua `handshake.auth.token`).

### Frontend pattern
- Trang công khai = Server Component (SSR/ISR); nút tương tác = Client Component nhỏ nhúng vào
- **Watch Party page = Client Component toàn phần**
- Optimistic UI cho Yêu thích/Xem sau/Follow — rollback + Toast nếu lỗi
- Toast hạn chế ở trang Player/Watch Party (không che Player) — dùng badge nhỏ góc trên
- Không Redux — Context API cho Auth, TanStack Query cho fetch thường

## 6. Business Rules hay vi phạm (xem đầy đủ BR-01→16 trong BA)

| Rule | Nội dung | Implement tại |
|---|---|---|
| BR-08 | MDP lỗi → trả cache gần nhất (list 15 phút, detail 60 phút) kèm `stale: true`; retry tối đa 2 lần backoff | `MdpClient` |
| BR-11 | Watch Party syncMode AUTO chỉ khi tập có `linkM3u8`; chỉ linkEmbed → MANUAL. Backend tự quyết, client không chọn | `WatchPartyService.createRoom()` |
| BR-12 | Tối đa 20 member/phòng → 409 | `joinRoom()` |
| BR-13 | Phòng tự đóng sau 30 phút idle hoặc hết người | `@Cron` mỗi 5 phút |
| BR-14 | Chat phòng KHÔNG lưu DB — chỉ broadcast | `handleChat()` |
| BR-15 | Gợi ý cần ≥5 lượt đánh giá/xem; fallback trending real-time | batch job đêm |
| ERD-R-11 | Report comment đạt 5 → status PENDING_REVIEW (trigger DB) | SQL trigger |
| NFR-08 | Log API MDP chỉ lưu tên endpoint nội bộ (`movies.home`) — KHÔNG log domain/path thật của MDP | `api_call_logs` |

## 7. Bảo mật — TUYỆT ĐỐI tuân thủ

- Repo public/forkable. **Không bao giờ** commit tên/domain/endpoint thật của MDP — chỉ biến môi trường `MOVIE_PROVIDER_BASE_URL` trong `.env` (gitignore), `.env.example` chỉ khai báo tên biến giá trị rỗng
- JWT trong cookie httpOnly + Secure + SameSite=Lax — KHÔNG dùng localStorage
- Escape/lọc nội dung Comment + Chat trước hiển thị (XSS)
- CORS backend chỉ allow-list domain Vercel

## 8. Env variables (xem `08` mục 10)

Backend: `PORT`, `DATABASE_URL`, `JWT_SECRET`, `JWT_ACCESS_EXPIRES_IN=1h`, `JWT_REFRESH_EXPIRES_DAYS=30`, `MOVIE_PROVIDER_BASE_URL`, `CORS_ORIGIN`.
Frontend: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WS_URL` (WS thẳng Railway, KHÔNG qua Vercel).

## 9. Khi thêm tính năng mới

1. Tra use case + BR tương ứng trong `01_BA` → đặc tả API trong `05_API` → wireframe trong `06_Wireframe`
2. Nếu đụng DB: sửa `cinesync_postgresql_schema.sql` trước, rồi map sang `db/schema.ts` (Drizzle) — giữ 1-1
3. KISS/YAGNI: không thêm Redis/Microservices/message queue/deep learning — đã chốt non-goals trong `07` mục 7
4. UI tiếng Việt, message lỗi theo đúng mẫu trong `05` mục 14
