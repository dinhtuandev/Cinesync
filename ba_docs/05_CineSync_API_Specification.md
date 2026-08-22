# API Specification – CineSync

## 1. Quy ước chung

- Toàn bộ API backend nội bộ CineSync prefix bằng `/api/v1/`.
- Danh từ số nhiều cho tài nguyên, `kebab-case` khi nhiều từ (`/watch-history`, `/watch-parties`).
- Token xác thực: `Authorization: Bearer <JWT>` cho REST. Endpoint public: `/api/v1/auth/**`, `/api/v1/movies/**`.
- Mọi response thành công theo envelope chuẩn:

```json
{
  "success": true,
  "message": "Thao tác thành công",
  "data": { }
}
```

- Mọi response lỗi trả `errors` dạng object `field -> message`:

```json
{
  "success": false,
  "message": "Thông tin đầu vào không hợp lệ",
  "errors": {
    "content": "Nội dung bình luận không được để trống"
  }
}
```

- HTTP Status Code: `200`, `201`, `400`, `401`, `403`, `404`, `409` (đã tồn tại), `500`, `502` (lỗi khi gọi MDP).
- Danh sách hỗ trợ phân trang qua query `page` (bắt đầu từ 1).
- Khóa tham chiếu phim xuyên suốt API nội bộ là `movieSlug`.

**(MỚI)** Watch Party dùng thêm kênh **WebSocket (Socket.IO)** song song REST — REST để tạo/tham gia/rời phòng (thao tác một lần), WebSocket để trao đổi sự kiện real-time (playback, chat, reaction). Xác thực WebSocket dùng cùng JWT, gửi qua `handshake.auth.token` khi client kết nối `io(url, { auth: { token } })`.

## 2. Nhóm API Phim (Proxy tới MDP, có cache)

> Toàn bộ endpoint trong mục này là **wrapper/proxy** phía Backend CineSync gọi tới **MDP** (Movie Data Provider — nhà cung cấp dữ liệu phim bên thứ ba). **Domain/endpoint thật của MDP không ghi trong tài liệu này** (repo public/forkable) — cấu hình qua biến môi trường, xem `01_CineSync_Business_Analysis.md` mục 8.1 và `08_CineSync_Technical_Spec.md` mục 10. Backend chuẩn hóa response về DTO nội bộ, bọc trong envelope chuẩn `success/message/data`.

| Method | Endpoint nội bộ | Mô tả | Auth |
|---|---|---|---|
| GET | `/api/v1/movies/home` | Danh sách phim trang chủ (mới cập nhật). | Public |
| GET | `/api/v1/movies` | Danh sách phim theo bộ lọc. Query: `type` (`phim-le`/`phim-bo`/`long-tieng`/`thuyet-minh`/`dang-chieu`/`4k`...), `page`. | Public |
| GET | `/api/v1/movies/search` | Tìm kiếm phim theo từ khóa (tối thiểu 2 ký tự). Query: `keyword`, `page`, `limit`. | Public |
| GET | `/api/v1/genres` | Danh sách thể loại. | Public |
| GET | `/api/v1/genres/{genreSlug}` | Phim theo thể loại. Query: `page`. | Public |
| GET | `/api/v1/countries` | Danh sách quốc gia. | Public |
| GET | `/api/v1/countries/{countrySlug}` | Phim theo quốc gia. Query: `page`. | Public |
| GET | `/api/v1/release-years` | Danh sách năm phát hành. | Public |
| GET | `/api/v1/release-years/{year}` | Phim theo năm phát hành. Query: `page`. | Public |
| GET | `/api/v1/movies/{movieSlug}` | Chi tiết phim, gồm `movie` và `episodes` (tập/server phát). | Public |

**GET `/api/v1/movies/{movieSlug}`** — Response `200` (rút gọn):
```json
{
  "success": true,
  "message": "Thao tác thành công",
  "data": {
    "movie": {
      "name": "Trở Về Tương Lai",
      "originName": "Back to the Future",
      "slug": "tro-ve-tuong-lai",
      "posterUrl": "https://cdn.example.com/posters/tro-ve-tuong-lai.jpg",
      "thumbUrl": "https://cdn.example.com/thumbs/tro-ve-tuong-lai.jpg",
      "year": 1985,
      "time": "116",
      "quality": "HD",
      "lang": "Vietsub",
      "content": "...",
      "actor": ["Michael J. Fox", "..."],
      "director": ["Robert Zemeckis"],
      "category": [{ "name": "Khoa Học Viễn Tưởng", "slug": "khoa-hoc-vien-tuong" }],
      "country": [{ "name": "Mỹ", "slug": "my" }]
    },
    "episodes": [
      {
        "serverName": "Server #1",
        "serverData": [
          { "name": "Full", "slug": "full", "linkEmbed": "https://...", "linkM3u8": "https://..." }
        ]
      }
    ],
    "internal": {
      "avgRating": 4.5,
      "ratingCount": 128,
      "isFavorited": false,
      "isInWatchlist": true,
      "myProgressSeconds": 340
    }
  }
}
```
> Trường `internal` là dữ liệu nội bộ CineSync ghép thêm khi User đã đăng nhập.
> `posterUrl`/`thumbUrl`/`linkEmbed`/`linkM3u8` ở trên là **ví dụ minh họa** — giá trị thật do MDP trả về tại runtime, không hard-code.

Lỗi khi MDP không phản hồi và không có cache hợp lệ, trả `502`:
```json
{
  "success": false,
  "message": "Không thể tải dữ liệu phim lúc này, vui lòng thử lại sau",
  "errors": { "upstream": "Nhà cung cấp dữ liệu phim không phản hồi" }
}
```

## 3. Authentication

| Method | Endpoint | Mô tả | Auth |
|---|---|---|---|
| POST | `/api/v1/auth/register` | Đăng ký tài khoản User mới. | Public |
| POST | `/api/v1/auth/login` | Đăng nhập, trả về JWT. Dùng chung cho User và Admin. | Public |
| POST | `/api/v1/auth/forgot-password` | Gửi yêu cầu đặt lại mật khẩu qua email. | Public |
| POST | `/api/v1/auth/reset-password` | Đặt lại mật khẩu bằng `resetToken` hợp lệ. | Public |
| POST | `/api/v1/auth/refresh-token` | **(MỚI, xem `08_CineSync_Technical_Spec.md` mục 4)** Cấp AccessToken mới từ RefreshToken còn hạn. | Public |

**POST `/api/v1/auth/login`** — Response `200`:
```json
{
  "success": true,
  "message": "Đăng nhập thành công",
  "data": {
    "accessToken": "eyJhbGciOi...",
    "user": { "userId": 12, "fullName": "Nguyen Van A", "email": "a@example.com", "role": "USER" }
  }
}
```

## 4. User Profile

| Method | Endpoint | Mô tả | Auth |
|---|---|---|---|
| GET | `/api/v1/me` | Lấy hồ sơ User hiện tại. | User |
| PUT | `/api/v1/me` | Cập nhật hồ sơ (`fullName`, `avatarUrl`). | User |
| PUT | `/api/v1/me/password` | Đổi mật khẩu. | User |
| PUT | `/api/v1/me/settings` | **(MỚI)** Cập nhật cài đặt cá nhân. Body: `{ "showActivity": boolean }` — bật/tắt hiển thị hoạt động trên Feed bạn bè (mục 4.6 BA). | User |

## 5. Favorites & Watchlist

| Method | Endpoint | Mô tả | Auth |
|---|---|---|---|
| GET | `/api/v1/favorites` | Danh sách phim Yêu thích của User hiện tại. Query: `page`, `pageSize`. | User |
| POST | `/api/v1/favorites` | Thêm Yêu thích. Body: `{ "movieSlug", "movieName", "posterUrl", "movieYear" }`. | User |
| DELETE | `/api/v1/favorites/{movieSlug}` | Bỏ Yêu thích. | User |
| GET | `/api/v1/watchlist` | Danh sách phim Xem sau. Query: `page`, `pageSize`. | User |
| POST | `/api/v1/watchlist` | Thêm vào Xem sau. Body tương tự Favorites. | User |
| DELETE | `/api/v1/watchlist/{movieSlug}` | Bỏ khỏi Xem sau. | User |

**POST `/api/v1/favorites`** — Response `201`:
```json
{
  "success": true,
  "message": "Đã thêm vào yêu thích",
  "data": { "favoriteId": 88, "movieSlug": "tro-ve-tuong-lai", "movieName": "Trở Về Tương Lai" }
}
```
Nếu đã yêu thích trước đó, trả `409`:
```json
{
  "success": false,
  "message": "Phim đã có trong danh sách yêu thích",
  "errors": { "movieSlug": "Đã tồn tại" }
}
```

## 6. Watch History (Xem tiếp)

| Method | Endpoint | Mô tả | Auth |
|---|---|---|---|
| GET | `/api/v1/watch-history` | Danh sách "Xem tiếp", sắp theo `lastWatchedAt` giảm dần, mặc định tối đa 10 mục. Query: `limit`. | User |
| PUT | `/api/v1/watch-history` | Ghi/cập nhật tiến độ xem hiện tại (UPSERT theo `movieSlug` + `episodeSlug`). Client gọi định kỳ mỗi ~15 giây trong lúc phát. | User |
| DELETE | `/api/v1/watch-history/{movieSlug}` | Xóa một mục khỏi lịch sử xem. Query tùy chọn: `episodeSlug`. | User |

**PUT `/api/v1/watch-history`** — Request:
```json
{
  "movieSlug": "tro-ve-tuong-lai",
  "episodeSlug": "",
  "movieName": "Trở Về Tương Lai",
  "posterUrl": "https://cdn.example.com/posters/tro-ve-tuong-lai.jpg",
  "progressSeconds": 340,
  "durationSeconds": 6960
}
```
Response `200`:
```json
{
  "success": true,
  "message": "Đã lưu tiến độ xem",
  "data": { "movieSlug": "tro-ve-tuong-lai", "progressSeconds": 340, "lastWatchedAt": "2026-08-18T10:32:00+07:00" }
}
```

## 7. Ratings

| Method | Endpoint | Mô tả | Auth |
|---|---|---|---|
| GET | `/api/v1/movies/{movieSlug}/rating` | Điểm trung bình + số lượt đánh giá, kèm điểm của chính User hiện tại nếu đã đăng nhập. | Public/User |
| PUT | `/api/v1/movies/{movieSlug}/rating` | Gửi/Cập nhật đánh giá sao. Body: `{ "stars": 1-5 }`. | User |
| DELETE | `/api/v1/movies/{movieSlug}/rating` | Xóa đánh giá của User hiện tại. | User |

**PUT `/api/v1/movies/{movieSlug}/rating`** — Response `200`:
```json
{
  "success": true,
  "message": "Đã ghi nhận đánh giá",
  "data": { "movieSlug": "tro-ve-tuong-lai", "stars": 5, "avgRating": 4.6, "ratingCount": 129 }
}
```

## 8. Comments

| Method | Endpoint | Mô tả | Auth |
|---|---|---|---|
| GET | `/api/v1/movies/{movieSlug}/comments` | Danh sách bình luận (kèm trả lời), chỉ trạng thái `VISIBLE`. Query: `episodeSlug`?, `page`, `pageSize`. | Public |
| POST | `/api/v1/movies/{movieSlug}/comments` | Đăng bình luận mới. Body: `{ "content", "episodeSlug"?, "parentCommentId"? }`. | User |
| PUT | `/api/v1/comments/{commentId}` | Sửa nội dung bình luận của chính mình. | User |
| DELETE | `/api/v1/comments/{commentId}` | Xóa bình luận của chính mình. | User |
| POST | `/api/v1/comments/{commentId}/report` | Báo cáo bình luận vi phạm. Body tùy chọn: `{ "reason" }`. | User |

**POST `/api/v1/movies/{movieSlug}/comments`** — Response `201`:
```json
{
  "success": true,
  "message": "Đã đăng bình luận",
  "data": {
    "commentId": 5501,
    "movieSlug": "tro-ve-tuong-lai",
    "parentCommentId": null,
    "content": "Phim kinh điển, xem lại vẫn hay!",
    "status": "VISIBLE",
    "createdAt": "2026-08-18T10:40:00+07:00"
  }
}
```
Lỗi khi trả lời một bình luận đã là trả lời (chỉ hỗ trợ 1 cấp), trả `400`:
```json
{
  "success": false,
  "message": "Thông tin đầu vào không hợp lệ",
  "errors": { "parentCommentId": "Chỉ hỗ trợ trả lời 1 cấp cho bình luận" }
}
```

**POST `/api/v1/comments/{commentId}/report`** — Response `200`:
```json
{
  "success": true,
  "message": "Đã ghi nhận báo cáo, cảm ơn bạn",
  "data": { "commentId": 5501, "reportCount": 3 }
}
```
Nếu User đã báo cáo bình luận này trước đó, trả `409`:
```json
{
  "success": false,
  "message": "Bạn đã báo cáo bình luận này rồi",
  "errors": { "commentId": "Đã báo cáo trước đó" }
}
```

## 9. Watch Party **(MỚI)**

### 9.1. REST — tạo/tham gia/rời/đóng phòng

| Method | Endpoint | Mô tả | Auth |
|---|---|---|---|
| POST | `/api/v1/watch-parties` | Tạo phòng mới. Body: `{ "movieSlug", "episodeSlug"? }`. | User |
| GET | `/api/v1/watch-parties/{roomCode}` | Xem thông tin phòng trước khi vào (tên phim, `syncMode`, số thành viên hiện tại, `status`). | User |
| POST | `/api/v1/watch-parties/{roomCode}/join` | Tham gia phòng; trả về thông tin cần thiết để client kết nối WebSocket. | User |
| POST | `/api/v1/watch-parties/{roomCode}/leave` | Rời phòng. | User |
| DELETE | `/api/v1/watch-parties/{roomCode}` | Host đóng phòng thủ công (chỉ Host mới gọi được). | User |

**POST `/api/v1/watch-parties`** — Response `201`:
```json
{
  "success": true,
  "message": "Đã tạo phòng xem chung",
  "data": {
    "roomId": 501,
    "roomCode": "K7QX2P",
    "movieSlug": "tro-ve-tuong-lai",
    "syncMode": "AUTO",
    "status": "ACTIVE"
  }
}
```
`syncMode` do Backend tự xác định dựa trên tập phim có `linkM3u8` hay chỉ `linkEmbed` (BR-11), Client không tự chọn.

**POST `/api/v1/watch-parties/{roomCode}/join`** — lỗi khi phòng đầy, trả `409`:
```json
{
  "success": false,
  "message": "Phòng đã đầy",
  "errors": { "roomCode": "Đã đạt tối đa 20 thành viên" }
}
```
Lỗi khi phòng không tồn tại/đã đóng, trả `404` với message `"Phòng không tồn tại hoặc đã đóng"`.

### 9.2. WebSocket (Socket.IO, namespace `/watch-party`)

| Chiều | Event | Payload | Mô tả |
|---|---|---|---|
| Client → Server | `join_room` | `{ roomCode }` | Tham gia kênh real-time của phòng (sau khi đã gọi REST `join`). |
| Client → Server | `leave_room` | `{ roomCode }` | Rời kênh real-time. |
| Client → Server | `playback_event` | `{ type: "play"\|"pause"\|"seek", positionSeconds }` | **Chỉ Host** được phép gửi (Server kiểm tra `hostUserId`); bị bỏ qua nếu `syncMode = MANUAL`. |
| Client → Server | `chat_message` | `{ text }` | Gửi tin nhắn chat trong phòng (không lưu DB — giả định 1.11). |
| Client → Server | `reaction` | `{ emoji }` | Gửi reaction nổi theo timestamp hiện tại của video. |
| Server → Client | `room_state` | `{ members[], syncMode, hostUserId, status }` | Gửi khi client vừa `join_room`, đồng bộ trạng thái hiện tại. |
| Server → Client | `member_joined` / `member_left` | `{ userId, fullName }` | Thông báo thay đổi thành viên. |
| Server → Client | `playback_event` | `{ type, positionSeconds }` | Broadcast lại sự kiện phát của Host tới toàn bộ Member. |
| Server → Client | `sync_correction` | `{ expectedPositionSeconds }` | Gửi riêng cho 1 Member khi lệch vượt ngưỡng ~1–2 giây (NFR-09). |
| Server → Client | `chat_message` / `reaction` | như phía Client gửi | Broadcast tới toàn phòng. |
| Server → Client | `room_closed` | `{ reason: "HOST_CLOSED"\|"INACTIVITY_TIMEOUT" }` | Phòng đã đóng (BR-13), Client tự ngắt kết nối. |

## 10. Xã hội – Follow & Feed **(MỚI)**

| Method | Endpoint | Mô tả | Auth |
|---|---|---|---|
| POST | `/api/v1/users/{userId}/follow` | Follow một User khác. | User |
| DELETE | `/api/v1/users/{userId}/follow` | Unfollow. | User |
| GET | `/api/v1/me/following` | Danh sách đang theo dõi. Query: `page`. | User |
| GET | `/api/v1/me/followers` | Danh sách người theo dõi mình. Query: `page`. | User |
| GET | `/api/v1/feed` | Feed hoạt động của những người mình follow (chỉ hiển thị nếu `showActivity = true` phía họ). Query: `page`. | User |

**GET `/api/v1/feed`** — Response `200`:
```json
{
  "success": true,
  "message": "Thao tác thành công",
  "data": {
    "items": [
      {
        "type": "RATED",
        "user": { "userId": 12, "fullName": "Nguyen Van A", "avatarUrl": "..." },
        "movieSlug": "tro-ve-tuong-lai",
        "movieName": "Trở Về Tương Lai",
        "stars": 5,
        "createdAt": "2026-08-19T20:10:00+07:00"
      }
    ],
    "page": 1,
    "hasMore": true
  }
}
```
Lỗi khi follow chính mình, trả `400` message `"Không thể tự theo dõi chính mình"`; follow người đã follow, trả `409` message `"Đã theo dõi người dùng này"`.

## 11. Gợi ý cá nhân hóa **(MỚI)**

| Method | Endpoint | Mô tả | Auth |
|---|---|---|---|
| GET | `/api/v1/recommendations` | Danh sách phim gợi ý "Dành cho bạn", sắp theo `score` giảm dần. Query: `limit` (mặc định 20). | User |

**GET `/api/v1/recommendations`** — Response `200`:
```json
{
  "success": true,
  "message": "Thao tác thành công",
  "data": {
    "results": [
      { "movieSlug": "tro-ve-tuong-lai", "movieName": "Trở Về Tương Lai", "score": 0.9231, "reason": "similar_to:back-to-the-future-2" }
    ],
    "isFallbackTrending": false
  }
}
```
Nếu User chưa đủ 5 lượt đánh giá/xem (BR-15), `isFallbackTrending: true` và `results` là danh sách "Phim thịnh hành" tính real-time theo lượt Yêu thích nội bộ.

## 12. Admin

| Method | Endpoint | Mô tả | Auth |
|---|---|---|---|
| GET | `/api/v1/admin/dashboard` | Số liệu tổng quan: tổng User, User hoạt động hôm nay, tổng Yêu thích/Đánh giá/Bình luận, top 10 phim được yêu thích/xem nhiều nhất. | Admin |
| GET | `/api/v1/admin/users` | Danh sách User. Query: `keyword`, `isActive`, `page`, `pageSize`. | Admin |
| POST | `/api/v1/admin/users/{userId}/lock` | Khóa tài khoản (`isActive = false`). | Admin |
| POST | `/api/v1/admin/users/{userId}/unlock` | Mở khóa tài khoản (`isActive = true`). | Admin |
| GET | `/api/v1/admin/comments` | Danh sách bình luận để kiểm duyệt. Query: `status` (mặc định `PENDING_REVIEW`), `movieSlug`, `page`, `pageSize`. | Admin |
| POST | `/api/v1/admin/comments/{commentId}/approve` | Duyệt hợp lệ, chuyển `status = VISIBLE`. | Admin |
| POST | `/api/v1/admin/comments/{commentId}/hide` | Xác nhận vi phạm, chuyển `status = HIDDEN`. | Admin |
| GET | `/api/v1/admin/api-logs` | Log lời gọi API MDP: tỷ lệ lỗi, thời gian phản hồi trung bình. Query: `from`, `to`, `endpoint` (endpoint **nội bộ**, VD `movies.home` — không lộ đường dẫn thật của MDP). | Admin |

**GET `/api/v1/admin/dashboard`** — Response `200`:
```json
{
  "success": true,
  "message": "Thao tác thành công",
  "data": {
    "totalUsers": 340,
    "activeUsersToday": 52,
    "totalFavorites": 1890,
    "totalRatings": 940,
    "totalComments": 2210,
    "topFavoritedMovies": [
      { "movieSlug": "tro-ve-tuong-lai", "movieName": "Trở Về Tương Lai", "favoriteCount": 47 }
    ]
  }
}
```
> Admin **không có** endpoint chỉnh sửa nội dung phim vì CineSync không sở hữu dữ liệu phim (BR-09); Admin chỉ thao tác trên tài khoản và bình luận.

Bổ sung/mở rộng:

| Method | Endpoint | Mô tả | Auth |
|---|---|---|---|
| GET | `/api/v1/admin/watch-parties` | **(MỚI)** Danh sách phòng xem chung. Query: `status` (`ACTIVE`\|`CLOSED`), `page`. Mỗi dòng gồm `roomCode`, `movieSlug`, `hostFullName`, `memberCount` hiện tại, `createdAt`. | Admin |
| POST | `/api/v1/admin/watch-parties/{roomCode}/force-close` | **(MỚI)** Đóng cưỡng chế 1 phòng vi phạm. | Admin |

## 13. Bean Validation tóm tắt theo Entity

| Entity | Field | Validation |
|---|---|---|
| RegisterRequest | `email` | `@NotBlank @Email` |
| RegisterRequest | `password` | `@NotBlank @Size(min = 6, max = 50)` |
| FavoriteRequest | `movieSlug` | `@NotBlank` |
| WatchHistoryRequest | `movieSlug` | `@NotBlank` |
| WatchHistoryRequest | `progressSeconds` | `@Min(0)` |
| RatingRequest | `stars` | `@NotNull @Min(1) @Max(5)` |
| CommentRequest | `content` | `@NotBlank @Size(max = 2000)` |
| SearchRequest | `keyword` | `@Size(min = 2)` |
| CreateWatchPartyRequest | `movieSlug` | `@NotBlank` |
| JoinWatchPartyRequest | `roomCode` | `@NotBlank @Size(min = 6, max = 10)` |
| UpdateSettingsRequest | `showActivity` | `@NotNull` |

## 14. Mã lỗi nghiệp vụ thường gặp

| HTTP | Trường hợp | Message ví dụ |
|---|---|---|
| 400 | `keyword` tìm kiếm dưới 2 ký tự | "Từ khóa tìm kiếm phải có tối thiểu 2 ký tự" |
| 400 | Trả lời một bình luận đã là trả lời | "Chỉ hỗ trợ trả lời 1 cấp cho bình luận" |
| 400 | `stars` ngoài khoảng 1–5 | "Điểm đánh giá phải từ 1 đến 5 sao" |
| 401 | Token hết hạn/không hợp lệ | "Phiên đăng nhập đã hết hạn" |
| 403 | Sửa/xóa bình luận không thuộc sở hữu | "Bạn không có quyền chỉnh sửa bình luận này" |
| 403 | Tài khoản bị khóa cố đăng nhập | "Tài khoản của bạn đã bị khóa" |
| 404 | Không tìm thấy phim (MDP không trả về kết quả) | "Không tìm thấy phim" |
| 409 | Yêu thích/Xem sau/Đánh giá đã tồn tại | "Phim đã có trong danh sách yêu thích" |
| 502 | Gọi MDP thất bại, không có cache | "Không thể tải dữ liệu phim lúc này, vui lòng thử lại sau" |
| 400 | Tự follow chính mình | "Không thể tự theo dõi chính mình" |
| 404 | Phòng xem chung không tồn tại/đã đóng | "Phòng không tồn tại hoặc đã đóng" |
| 403 | Gửi `playback_event` khi không phải Host | "Chỉ Host mới có thể điều khiển phát trong phòng" |
| 409 | Phòng xem chung đã đầy (20 thành viên) | "Phòng đã đầy" |
| 409 | Đã theo dõi người dùng này trước đó | "Đã theo dõi người dùng này" |
