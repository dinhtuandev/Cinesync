# Cơ sở dữ liệu CineSync

Thư mục này chứa bản thiết kế DDL cho CineSync, xây dựng từ [ERD CineSync](03_CineSync_ERD.md).

| Hệ quản trị | Tệp schema | Phiên bản mục tiêu |
|---|---|---|
| PostgreSQL | [cinesync_postgresql_schema.sql](cinesync_postgresql_schema.sql) | PostgreSQL 16 trở lên |

Gồm 10 bảng nghiệp vụ nền tảng (`roles`, `app_users`, `password_reset_requests`, `favorites`, `watchlists`, `watch_history`, `ratings`, `comments`, `comment_reports`, `api_call_logs` — `app_users` có thêm cột `show_activity`), cộng 4 bảng mới (`watch_party_rooms`, `watch_party_members`, `user_follows`, `recommendations`) — tổng 14 bảng.

## Cách sử dụng

1. Tạo một cơ sở dữ liệu PostgreSQL 16+ trống.
2. Chạy tệp `cinesync_postgresql_schema.sql`.

## Lưu ý khi triển khai ở tầng ứng dụng

- **Không có bảng `movies`**: toàn bộ dữ liệu phim (tên, poster, thể loại, tập/server phát...) lấy trực tiếp/qua cache ngắn hạn từ MDP (nhà cung cấp dữ liệu phim bên thứ ba — tên/endpoint thật không public, xem `01_CineSync_Business_Analysis.md` mục 8.1). Các bảng `favorites`, `watchlists`, `watch_history`, `ratings`, `comments` chỉ lưu `movie_slug` làm khóa tham chiếu logic, không có `FOREIGN KEY` tới một bảng phim nội bộ.
- **Snapshot hiển thị**: `favorites`, `watchlists`, `watch_history` lưu kèm `movie_name`, `poster_url`, `movie_year` tại thời điểm thêm/cập nhật để hiển thị danh sách nhanh mà không cần gọi lại API MDP mỗi lần render. Khi User click vào một mục cụ thể, Frontend gọi lại API chi tiết phim theo `movie_slug` để lấy dữ liệu mới nhất.
- **Tiến độ xem**: mỗi lần Player gửi tiến độ, tầng Service thực hiện `UPSERT` vào `watch_history` theo bộ khóa duy nhất `(user_id, movie_slug, episode_slug)` — cập nhật `progress_seconds` và `last_watched_at`, không chèn thêm dòng mới. `episode_slug` dùng `''` (chuỗi rỗng) làm giá trị sentinel cho phim lẻ thay vì `NULL`, để ràng buộc `UNIQUE` hoạt động bình thường.
- **Đếm và ngưỡng báo cáo bình luận**: khi ứng dụng ghi một dòng vào `comment_reports`, trigger tự động tăng `comments.report_count`; khi `report_count` đạt 5, trigger tự chuyển `comments.status` sang `PENDING_REVIEW`. Việc Admin duyệt (chuyển `VISIBLE`/`HIDDEN`) vẫn do tầng Service thực hiện qua API, không có trigger tự động khôi phục trạng thái.
- **Ràng buộc trả lời 1 cấp**: `comments.parent_comment_id` chỉ được trỏ tới một bình luận gốc (bình luận có `parent_comment_id IS NULL`); ràng buộc này kiểm tra bằng trigger vì CHECK constraint thông thường không tự tham chiếu được dữ liệu bảng khác.
- **Dọn dẹp `api_call_logs`**: bảng vận hành, nên có job định kỳ (ví dụ chạy hằng ngày) xóa các dòng cũ hơn 30 ngày để tránh phình dữ liệu; không bắt buộc ở giai đoạn 1 theo YAGNI. Cột `endpoint` chỉ nên lưu tên endpoint **nội bộ** (VD `movies.home`), không lưu domain/đường dẫn thật của MDP.
- **Watch Party**: bảng `watch_party_rooms`/`watch_party_members` chỉ phục vụ audit/thống kê (UC-A-06) và làm nguồn khởi tạo khi Socket.IO server khởi động lại; **trạng thái real-time đang chạy** (ai online, đang phát tới giây nào) nằm hoàn toàn trong bộ nhớ tiến trình Node — không đọc/ghi DB liên tục theo từng sự kiện play/pause/seek (tránh tải DB không cần thiết, đúng NFR-09/NFR-10). Việc tự đóng phòng sau 30 phút không hoạt động (BR-13) thực hiện bằng job định kỳ ở tầng ứng dụng, không phải trigger DB.
- **Follow**: không có bảng riêng cho "block" ở giai đoạn 1 (thuộc backlog, mục 9 BA) — `user_follows` chỉ mô hình hóa quan hệ theo dõi 1 chiều.
- **Gợi ý cá nhân hóa**: `recommendations` được ghi đè theo lô mỗi lần batch job chạy (xóa toàn bộ dòng cũ của 1 User rồi chèn lại) — không dùng `UPSERT` từng dòng để giữ job đơn giản (YAGNI, đúng thiết kế ERD-R-18).
- **Múi giờ**: mọi cột thời gian dùng `TIMESTAMPTZ` (UTC ở tầng lưu trữ, quy đổi theo múi giờ trình duyệt khi hiển thị).
