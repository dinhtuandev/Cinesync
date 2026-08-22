---
name: cinesync-api-conventions
description: Quy ước API CineSync — envelope response, HTTP status, phân trang, validation, mã lỗi tiếng Việt. Dùng khi viết Backend (NestJS Controller/Service/DTO) hoặc gọi API từ Frontend.
---

# CineSync API Conventions

Nguồn sự thật đầy đủ: `ba_docs/05_CineSync_API_Specification.md`

## 1. Envelope response

Mọi REST response bọc chuẩn qua `ResponseInterceptor` / `HttpExceptionFilter`:

```json
// OK: { "success": true, "message": "...", "data": {...} }
// Lỗi: { "success": false, "message": "...", "errors": { "<field>": "<msg>" } }
// Phân trang: data = { items: [...], pagination: { page, pageSize, total, totalPages } }
```

## 2. HTTP status

`200` OK · `201` created · `400` validation · `401` token hết hạn/không hợp lệ · `403` không có quyền/tài khoản khóa · `404` không tìm thấy · `409` đã tồn tại · `500` server · **`502` lỗi gọi MDP**.

## 3. Naming

- Prefix `/api/v1/`, danh từ số nhiều, kebab-case (`/watch-history`, `/watch-parties`)
- Khóa phim: `movieSlug`; `episodeSlug` dùng `''` cho phim lẻ, không NULL
- Tìm kiếm: tối thiểu 2 ký tự, debounce 400ms phía client
- Phân trang: query `page` (bắt đầu 1), `pageSize`

## 4. Validation DTO (class-validator)

| DTO | Field | Rule |
|---|---|---|
| RegisterRequest | email / password | `@NotBlank @Email` / `@Size(min=6,max=50)` |
| FavoriteRequest / WatchHistoryRequest | movieSlug | `@NotBlank` |
| WatchHistoryRequest | progressSeconds | `@Min(0)` |
| RatingRequest | stars | `@NotNull @Min(1) @Max(5)` |
| CommentRequest | content | `@NotBlank @Size(max=2000)` |
| SearchRequest | keyword | `@Size(min=2)` |
| CreateWatchPartyRequest | movieSlug | `@NotBlank` |
| JoinWatchPartyRequest | roomCode | `@NotBlank @Size(min=6,max=10)` |
| UpdateSettingsRequest | showActivity | `@NotNull` |

## 5. Mã lỗi nghiệp vụ (message tiếng Việt — copy đúng mẫu)

| HTTP | Trường hợp | Message |
|---|---|---|
| 400 | keyword < 2 ký tự | "Từ khóa tìm kiếm phải có tối thiểu 2 ký tự" |
| 400 | trả lời comment đã là reply | "Chỉ hỗ trợ trả lời 1 cấp cho bình luận" |
| 400 | stars ngoài 1-5 | "Điểm đánh giá phải từ 1 đến 5 sao" |
| 401 | token hết hạn | "Phiên đăng nhập đã hết hạn" |
| 403 | sửa/xóa comment người khác | "Bạn không có quyền chỉnh sửa bình luận này" |
| 403 | tài khoản bị khóa đăng nhập | "Tài khoản của bạn đã bị khóa" |
| 404 | phim không có trên MDP | "Không tìm thấy phim" |
| 409 | favorite/watchlist/rating đã tồn tại | "Phim đã có trong danh sách yêu thích" |
| 502 | MDP chết, không cache | "Không thể tải dữ liệu phim lúc này, vui lòng thử lại sau" |
| 400 | tự follow mình | "Không thể tự theo dõi chính mình" |
| 404 | phòng không tồn tại/đã đóng | "Phòng không tồn tại hoặc đã đóng" |
| 403 | playback khi không phải Host | "Chỉ Host mới có thể điều khiển phát trong phòng" |
| 409 | phòng đầy 20 member | "Phòng đã đầy" |
| 409 | đã follow trước đó | "Đã theo dõi người dùng này" |

## 6. Auth

- REST: JWT Bearer trong cookie httpOnly (không localStorage). Public endpoints: `/api/v1/auth/**`, `/api/v1/movies/**`
- AccessToken 1h + RefreshToken 30 ngày (DB bảng `refresh_tokens`). Hết hạn → Route Handler Next.js tự gọi `/auth/refresh-token`
- Socket.IO: JWT qua `handshake.auth.token`, validate bằng `WsJwtGuard`
- Guard: `JwtAuthGuard` (REST) → `RolesGuard` (USER/ADMIN)

## 7. Layered Architecture

Controller → Service → Repository/Drizzle. Không SQL trực tiếp ngoài Repository layer. Không định nghĩa lại ràng buộc DB trong Drizzle schema — map 1-1 với `database/cinesync_postgresql_schema.sql`.
