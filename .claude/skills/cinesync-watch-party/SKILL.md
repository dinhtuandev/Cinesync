---
name: cinesync-watch-party
description: Pattern triển khai Watch Party (xem chung real-time) của CineSync — Socket.IO Gateway, in-memory room store, sync AUTO/MANUAL, cron đóng phòng. Dùng khi làm bất kỳ phần nào liên quan Watch Party, WebSocket, Player đồng bộ.
---

# CineSync Watch Party Patterns

Nguồn sự thật: `ba_docs/08_CineSync_Technical_Spec.md` mục 5.1, `05_CineSync_API_Specification.md` mục 9, Activity Diagram mục 5 trong `02_CineSync_Diagrams.md`.

## 1. Kiến trúc cốt lõi

- **1 Socket.IO Gateway** (`WatchPartyGateway`, namespace `/watch-party`) chạy chung process NestJS — KHÔNG service riêng
- **Trạng thái phòng = in-memory** Map `roomCode -> { members, syncMode, hostUserId, lastActivityAt }` (`watch-party-room.store.ts`)
- DB (`watch_party_rooms` / `watch_party_members`) chỉ ghi khi tạo/đóng phòng + audit vào/rời. KHÔNG ghi DB theo từng sự kiện play/pause/seek
- Không Redis/Socket.IO Adapter giai đoạn 1 (non-goal). 1 instance Railway là đủ

## 2. Business Rules bắt buộc

| Rule | Xử lý |
|---|---|
| BR-11 | Backend tự xác định `syncMode`: tập có `linkM3u8` → AUTO; chỉ `linkEmbed` → MANUAL. Client không được chọn |
| BR-12 | Tối đa 20 member/phòng → throw ConflictException "Phòng đã đầy" |
| BR-13 | Phòng tự đóng sau 30 phút không có sự kiện phát hoặc hết người — `@Cron('*/5 * * * *')` quét `roomStore.findStale()` |
| BR-14 | Chat KHÔNG lưu DB — chỉ broadcast qua socket |
| Host rời | Quyền Host chuyển cho member tham gia sớm nhất tiếp theo |

## 3. WebSocket events (đúng đặc tả API mục 9.2)

Client→Server: `join_room {roomCode}` · `leave_room {roomCode}` · `playback_event {type:"play"|"pause"|"seek", positionSeconds}` (CHỈ Host, bỏ qua nếu MANUAL) · `chat_message {text}` · `reaction {emoji}`.

Server→Client: `room_state` (khi vừa join) · `member_joined`/`member_left` · `playback_event` (broadcast) · `sync_correction {expectedPositionSeconds}` (gửi riêng member lệch > ~1-2s) · `chat_message`/`reaction` · `room_closed {reason:"HOST_CLOSED"|"INACTIVITY_TIMEOUT"}`.

## 4. Sync logic (NFR-09)

- Broadcast `positionSeconds` **tuyệt đối**, không gửi delta
- Client so sánh vị trí player với `expectedPositionSeconds`; chỉ điều chỉnh khi lệch vượt ngưỡng ~1-2 giây — tránh giật liên tục
- Reconnect tự động khi rớt mạng, không mất trạng thái phòng (NFR-10)

## 5. Auth

Handshake JWT: client connect `io(url, { auth: { token } })`. Server validate bằng `WsJwtGuard` đọc `client.handshake.auth.token`, gắn payload vào `client.data.user = { sub, role }`.

## 6. Frontend (Next.js)

- Page `app/(public)/watch-party/[roomCode]/page.tsx` = **Client Component toàn phần**
- Layout: Player trái + `ReactionOverlay` phủ trên; `ChatPanel` phải (mobile thu thành tab); đầu trang `RoomCodeBadge` + `MemberAvatarStack` + nút Rời phòng
- Chế độ AUTO: chỉ Host có nút điều khiển đầy đủ; Member xem-only + dòng "Đang đồng bộ với Host"
- Chế độ MANUAL: dải cảnh báo "Server này không hỗ trợ đồng bộ tự động — cùng đếm 3-2-1 qua chat nhé!"; mọi người tự điều khiển
- Toast hạn chế — badge nhỏ góc trên cho sự kiện sync
- Hiển thị trạng thái kết nối WS rõ ràng
- Chat/reaction content phải sanitize trước render (XSS)
