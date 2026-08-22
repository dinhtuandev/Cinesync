---
name: cinesync-design-system
description: Design system và pattern UI của CineSync (Next.js + TailwindCSS 4). Dùng khi tạo/sửa bất kỳ component hoặc trang frontend nào — màu sắc, badge, component tái sử dụng, responsive, optimistic UI, quy tắc Toast.
---

# CineSync Design System

Nguồn sự thật đầy đủ: `ba_docs/06_CineSync_Wireframe_Specification.md`

## 1. Bảng màu (theme tối rạp chiếu)

| Mục đích | Class Tailwind |
|---|---|
| Nền trang | `bg-neutral-950` |
| Card / panel | `bg-neutral-900` |
| Accent (CTA, badge) | `bg-rose-600`, `hover:bg-rose-700` |
| Text accent | `text-rose-500` |
| Chữ chính | `text-neutral-100` |
| Chữ phụ | `text-neutral-400` |

## 2. Badge phim

- `HD` / `4K` / `FullHD` — nhãn nhỏ góc trên poster (từ `quality`)
- `Vietsub` / `Lồng tiếng` / `Thuyết minh` — badge cạnh nhãn chất lượng (từ `lang`)
- `Tập {episode_current}/{episode_total}` — phim bộ
- Badge "Đã lưu" — icon tim/đồng hồ tô màu khi User đã Yêu thích/Xem sau

## 3. Component dùng lại (tạo trong `components/`)

`Button`, `Input`, `Select`, `Badge`, `Modal`, `Toast`, `Spinner`, `EmptyState`, `Pagination`, `StarRating`, `MoviePosterCard`, `VideoPlayer` (wrapper HLS/embed), `CommentItem`.

Component riêng Watch Party (`components/watch-party/`): `RoomCodeBadge` (mã phòng 6 ký tự + nút Copy/Web Share API), `ReactionOverlay` (emoji bay), `ChatPanel` (tự cuộn xuống tin mới), `MemberAvatarStack`, `FollowButton`, `ActivityFeedItem`.

## 4. Layout & Responsive

- Header cố định: logo, menu Thể loại/Quốc gia/Năm, ô tìm kiếm, nút Đăng nhập/Avatar
- Grid poster: Desktop 6-8 cột, Tablet 4, Mobile 2-3 (header thu gọn hamburger)
- Trang công khai = Server Component; nút tương tác = Client Component con nhúng vào
- Watch Party page = Client Component toàn phần

## 5. Hành vi UI bắt buộc

- **Optimistic UI**: Yêu thích/Xem sau/Đánh giá/Follow — cập nhật icon ngay khi bấm, rollback + Toast nếu API lỗi
- **Toast**: hạn chế ở Player (SCR-G-05) và Watch Party (SCR-U-05) — dùng badge nhỏ góc trên, không che Player
- **stale data**: khi API trả `stale: true`, hiện dải text nhỏ "Dữ liệu có thể chưa được cập nhật mới nhất", không chặn
- **Skeleton loading**: khung poster xám cho từng carousel khi chờ API; carousel lỗi → ẩn carousel đó, không chặn trang
- **Đăng nhập/Đăng ký**: Modal nổi trên mọi trang (không chuyển route), Guest bấm nút tương tác → disable + mở Modal đăng nhập
- **Trạng thái rỗng**: luôn có EmptyState + CTA (VD "Bạn chưa yêu thích phim nào 🎬" + nút "Khám phá phim ngay")
- **WebSocket status** (Watch Party): hiển thị rõ đã kết nối / đang kết nối lại / mất kết nối
- **XSS**: mọi nội dung User nhập (Comment, Chat) phải escape/lọc trước render

## 6. Form validation

Frontend validate bằng `zod` trước khi gọi API. Message lỗi tiếng Việt theo mẫu trong `ba_docs/05_CineSync_API_Specification.md` mục 14.
