# Business Analysis – CineSync (Xem phim cùng bạn bè)

> CineSync kết hợp 2 lớp nghiệp vụ: **nền tảng xem phim** (tài khoản, Yêu thích, Xem sau, Lịch sử xem, Đánh giá, Bình luận, Kiểm duyệt) và 2 tính năng nổi bật tạo sự khác biệt: **Xem chung real-time (Watch Party)**, và **Lớp xã hội + gợi ý cá nhân hóa**. Các mục được đánh dấu **(MỚI)** trong tài liệu này là các tính năng nổi bật đó.

> **Lưu ý bảo mật thông tin**: Repo này dự kiến public/forkable. Tên và endpoint cụ thể của nhà cung cấp dữ liệu phim bên thứ ba **không** được ghi trong tài liệu này (hay bất kỳ tài liệu nào khác của dự án) — chỉ gọi tắt là **MDP** (Movie Data Provider). Base URL/endpoint thật được cấu hình qua biến môi trường, lưu trong `.env` cục bộ (không commit) và tài liệu vận hành riêng không public.

## 1. Giới thiệu

### 1.1. Bối cảnh

CineSync là website xem phim trực tuyến, dữ liệu phim (danh sách, chi tiết, tập/server phát) lấy từ **MDP** — một dịch vụ bên thứ ba công khai, không tự xây kho dữ liệu phim — giữ triết lý thiết kế đơn giản, tránh làm phức tạp hóa không cần thiết (KISS/YAGNI). Phần nghiệp vụ CineSync tự xây dựng gồm: tài khoản/tương tác/quản trị, phòng xem chung thời gian thực, và mạng lưới theo dõi giữa các User kèm gợi ý cá nhân hóa.

### 1.2. Mục tiêu sản phẩm

- Guest xem phim miễn phí không cần đăng nhập; User lưu Yêu thích/Xem sau/Lịch sử, đánh giá, bình luận; Admin quản lý User và kiểm duyệt bình luận.
- **(MỚI)** Cho phép nhiều User cùng xem đồng bộ một phim trong "phòng" chung, tương tác qua chat và reaction thời gian thực.
- **(MỚI)** Xây dựng lớp xã hội nhẹ (follow, feed hoạt động) và gợi ý phim cá nhân hóa dựa trên hành vi xem/đánh giá thực tế.

### 1.3. Phạm vi (Scope)

**Trong phạm vi:**
- Trang chủ, danh sách/tìm kiếm/lọc phim, chi tiết phim, Player, tài khoản, Yêu thích, Xem sau, Lịch sử xem, Đánh giá, Bình luận, trang quản trị Admin.
- **(MỚI)** Tạo/tham gia phòng xem chung (Watch Party) gắn với 1 phim/tập cụ thể.
- **(MỚI)** Follow/Unfollow User khác, Feed hoạt động, danh sách gợi ý "Dành cho bạn".
- **(MỚI)** Admin giám sát phòng xem chung.

**Ngoài phạm vi (Non-goals):**
- Không tự lưu trữ file video/nguồn phát phim.
- Không quản lý bản quyền, không chỉnh sửa dữ liệu phim thủ công.
- Không có thanh toán/VIP ở giai đoạn 1.
- Không có App Mobile riêng ở giai đoạn 1.
- Không có tính năng tìm kiếm bằng AI/semantic search ở giai đoạn 1 — chỉ tìm kiếm theo từ khóa và bộ lọc (thể loại/quốc gia/năm).
- **(MỚI)** Không hỗ trợ voice/video call trong Watch Party giai đoạn 1 — chỉ text chat + reaction.
- **(MỚI)** Không tự huấn luyện mô hình gợi ý riêng — dùng thuật toán collaborative filtering đơn giản (item-based), không phải deep learning phức tạp.
- **(MỚI)** Không đảm bảo đồng bộ phát tuyệt đối cho mọi nguồn phim — phụ thuộc việc tập phim có `linkM3u8` hay chỉ có `linkEmbed` (xem giả định 1.10).
- **(MỚI)** Không thiết kế cho quy mô hàng nghìn phòng đồng thời ở giai đoạn 1 — target vài chục phòng đồng thời là đủ để chứng minh tính năng.

### 1.4. Giả định (Assumptions)

| # | Giả định |
|---|---|
| 1.1 | MDP là dịch vụ public, không cần token, trả JSON UTF-8, phương thức GET; CineSync gọi qua lớp proxy/cache ở Backend (không gọi trực tiếp từ trình duyệt). Base URL/endpoint cụ thể không public trong repo (xem lưu ý đầu tài liệu). |
| 1.2 | Định danh phim dùng thống nhất là `slug` (chuỗi định danh URL-friendly do MDP cung cấp, ví dụ `ten-phim-vi-du`) làm khóa tham chiếu khi User lưu Yêu thích/Xem sau/Đánh giá/Watch Party — không đồng bộ toàn bộ dữ liệu phim vào DB riêng, chỉ lưu tham chiếu (`movie_slug`, `movie_name`, `poster_url`, snapshot tối thiểu để hiển thị nhanh danh sách mà không cần gọi lại API mỗi lần). |
| 1.3 | Dữ liệu phim từ MDP có thể thay đổi/gỡ theo thời gian; CineSync không đảm bảo tính toàn vẹn vĩnh viễn của các mục Yêu thích/Xem sau/phòng Watch Party nếu phim gốc bị gỡ khỏi MDP — hiển thị trạng thái "Phim không còn khả dụng" khi gọi lại API không thành công. |
| 1.4 | Không triển khai gói trả phí ở giai đoạn 1. |
| 1.5 | Ngôn ngữ hiển thị: Tiếng Việt. |
| 1.6 | Không xây dựng App Mobile ở giai đoạn 1, chỉ Website responsive (Desktop/Tablet/Mobile Web). |
| 1.7 | Mọi thời gian lưu theo UTC ở tầng lưu trữ, quy đổi theo múi giờ trình duyệt khi hiển thị. |
| 1.8 | Tần suất gọi API MDP được giới hạn qua tầng cache Backend (mục 8.1) để tránh vượt rate-limit không công bố của bên thứ ba và tăng tốc độ phản hồi. |
| 1.9 | CineSync triển khai trên **PostgreSQL** theo đúng định hướng công nghệ đã chọn (Next.js/Node.js/PostgreSQL, deploy Vercel + Railway). |
| 1.10 | Đồng bộ phát trong Watch Party chỉ khả dụng ở mức **best-effort** cho các tập phim có `linkM3u8` (phát qua `<video>`/`hls.js` do CineSync tự kiểm soát play/pause/seek). Các tập chỉ có `linkEmbed` (iframe bên thứ ba) **không thể** đồng bộ tự động do giới hạn cross-origin của iframe — hệ thống tự nhận diện và chuyển sang chế độ đồng bộ thủ công. |
| 1.11 | Watch Party không lưu chat vĩnh viễn vào DB; phòng và chat là dữ liệu "sống" theo phiên (session-based), không phục vụ mục đích tra cứu lâu dài (YAGNI). |

## 2. Actor

| Actor | Mô tả |
|---|---|
| Guest | Người dùng chưa đăng nhập; xem phim công khai, tìm kiếm theo từ khóa/bộ lọc. |
| User | Tài khoản đã đăng ký; có thêm Yêu thích, Xem sau, Lịch sử, Đánh giá, Bình luận, Watch Party, Follow, Gợi ý cá nhân hóa. Trong một phòng Watch Party, một User giữ vai trò tạm thời **Host** (người tạo phòng) hoặc **Member** (người tham gia) — không phải actor riêng. |
| Admin | Quản trị viên; quản lý User, kiểm duyệt bình luận, giám sát Watch Party. |

## 3. Danh sách chức năng (Use Case tóm tắt)

### 3.1. Chức năng công khai (Guest)

| Mã | Use Case | Mô tả |
|---|---|---|
| UC-G-01 | Xem trang chủ | Hiển thị phim mới cập nhật, các khối "Phim lẻ", "Phim bộ", "Phim 4K"... lấy từ API danh sách theo bộ lọc tương ứng. |
| UC-G-02 | Xem danh sách phim theo bộ lọc | Lọc theo loại (lồng tiếng/thuyết minh/phim lẻ/phim bộ/phim mới/đang chiếu/4K), có phân trang. |
| UC-G-03 | Tìm kiếm phim (từ khóa) | Tìm theo từ khóa tên phim (tiếng Việt/tên gốc), tối thiểu 2 ký tự. |
| UC-G-04 | Xem theo thể loại | Danh sách thể loại + phim theo từng thể loại. |
| UC-G-05 | Xem theo quốc gia | Danh sách quốc gia + phim theo từng quốc gia. |
| UC-G-06 | Xem theo năm phát hành | Danh sách năm + phim theo từng năm. |
| UC-G-07 | Xem chi tiết phim | Tên, mô tả, poster, diễn viên, đạo diễn, thể loại, quốc gia, thời lượng, trạng thái, danh sách tập/server phát. |
| UC-G-08 | Xem phim (Player) | Phát trực tiếp từ server/link tập phim; chọn server khác nếu có nhiều nguồn. |
| UC-G-09 | Đăng ký | Tạo tài khoản User mới. |
| UC-G-10 | Đăng nhập | Đăng nhập bằng Email/Mật khẩu. |
| UC-G-11 | Quên mật khẩu | Gửi email đặt lại mật khẩu. |

### 3.2. Chức năng User (bao gồm toàn bộ chức năng Guest)

| Mã | Use Case | Mô tả |
|---|---|---|
| UC-U-01 | Quản lý hồ sơ cá nhân | Sửa họ tên, ảnh đại diện, đổi mật khẩu. |
| UC-U-02 | Thêm/Bỏ Yêu thích | Đánh dấu một phim (theo `movie_slug`) vào danh sách Yêu thích. |
| UC-U-03 | Thêm/Bỏ Xem sau (Watchlist) | Lưu phim để xem sau, tách riêng khỏi Yêu thích. |
| UC-U-04 | Ghi nhận lịch sử xem | Tự động lưu phim/tập đang xem kèm tiến độ mỗi khi User phát video, phục vụ "Xem tiếp". |
| UC-U-05 | Xem tiếp (Continue watching) | Danh sách rút gọn ở trang chủ/hồ sơ để tiếp tục xem từ vị trí dở. |
| UC-U-06 | Đánh giá phim | Cho điểm 1–5 sao; mỗi User chỉ 1 đánh giá/phim, có thể sửa lại. |
| UC-U-07 | Bình luận phim | Bình luận theo phim (tùy chọn theo tập); sửa/xóa bình luận của chính mình; báo cáo bình luận vi phạm. |
| UC-U-08 | Quản lý danh sách Yêu thích/Xem sau/Lịch sử | Xem, xóa từng mục hoặc xóa toàn bộ. |
| UC-U-09 | Nhận thông báo phim mới theo thể loại đã theo dõi | *(tùy chọn mở rộng, xem mục 9)* |
| UC-U-10 **(MỚI)** | Tạo phòng xem chung (Watch Party) | Chọn 1 phim/tập, tạo phòng, hệ thống sinh mã phòng 6 ký tự để mời bạn bè. |
| UC-U-11 **(MỚI)** | Tham gia phòng xem chung | Nhập mã phòng để vào; xem đồng bộ (nếu nguồn hỗ trợ — giả định 1.10) kèm chat và reaction thời gian thực. |
| UC-U-12 **(MỚI)** | Theo dõi (Follow) người dùng khác | Follow/Unfollow 1 chiều một User khác để thấy hoạt động của họ trên Feed. |
| UC-U-13 **(MỚI)** | Xem Feed hoạt động bạn bè | Thấy hoạt động công khai của người mình follow (VD: "A vừa đánh giá 5⭐ phim X"), tùy theo cấu hình quyền riêng tư của A. |
| UC-U-14 **(MỚI)** | Xem gợi ý "Dành cho bạn" | Danh sách phim gợi ý cá nhân hóa dựa trên lịch sử xem/đánh giá; fallback "Phim thịnh hành" nếu chưa đủ dữ liệu. |

### 3.3. Chức năng Admin

| Mã | Use Case | Mô tả |
|---|---|---|
| UC-A-01 | Đăng nhập quản trị | Dùng chung UC-G-10, chỉ chấp nhận vai trò `ADMIN`. |
| UC-A-02 | Dashboard hệ thống | Tổng số User, số User hoạt động hôm nay, tổng lượt Yêu thích/Đánh giá/Bình luận, top phim được xem/yêu thích nhiều nhất (dữ liệu nội bộ CineSync, không phải số liệu từ MDP). |
| UC-A-03 | Quản lý người dùng | Danh sách, tìm kiếm, khóa/mở khóa tài khoản. |
| UC-A-04 | Kiểm duyệt bình luận | Xem, ẩn/xóa bình luận vi phạm; xem theo bộ lọc "bị báo cáo". |
| UC-A-05 | Xem log tình trạng tích hợp MDP | Theo dõi tỷ lệ lỗi/thời gian phản hồi khi gọi API bên ngoài để phát hiện sự cố sớm. |
| UC-A-06 **(MỚI)** | Giám sát phòng xem chung | Xem số phòng đang hoạt động, số người tham gia trung bình; xử lý báo cáo phòng/chat vi phạm nếu có. |

## 4. Đặc tả nghiệp vụ chi tiết theo tính năng

### 4.1. Duyệt & tìm kiếm phim (UC-G-01 → UC-G-06)

- Trang chủ gọi endpoint nội bộ tương ứng "danh sách phim mới cập nhật" làm khối chính; các khối chuyên đề khác (Phim lẻ, Phim bộ, Phim 4K...) gọi endpoint danh sách theo bộ lọc tương ứng theo từng danh mục. Việc ánh xạ sang endpoint thật của MDP nằm hoàn toàn trong tầng `integration` ở Backend, không public (mục 8.1).
- Tìm kiếm: input tối thiểu 2 ký tự (theo giới hạn của MDP), debounce 400ms trước khi gọi API để tránh gọi quá nhiều.
- Trang thể loại/quốc gia/năm: gọi API danh sách thể loại/quốc gia/năm để build menu điều hướng, sau đó gọi API phim theo từng mục cụ thể khi User chọn.
- Tất cả danh sách đều hỗ trợ phân trang `page` theo cấu trúc `pagination` chuẩn hóa của CineSync (không phụ thuộc trực tiếp cấu trúc phân trang gốc của MDP).

### 4.2. Chi tiết phim & Player (UC-G-07, UC-G-08)

- Trang chi tiết gọi endpoint chi tiết phim theo `slug`, hiển thị: `name`, `originName`, `content` (mô tả), `posterUrl`, `thumbUrl`, thời lượng, chất lượng, ngôn ngữ, năm, `actor[]`, `director[]`, `category[]`, `country[]`, và mảng `episodes` (danh sách server/tập phát).
- Nếu phim có nhiều server phát (`episodes` gồm nhiều nhóm server), Player cho phép User chuyển đổi server khi server hiện tại lỗi/không phát được.
- Nếu MDP trả lỗi/không tìm thấy hoặc lỗi mạng, hiển thị màn hình lỗi thân thiện, không chặn toàn bộ trang.
- **(MỚI)** Trang chi tiết bổ sung nút "Xem cùng bạn bè" cạnh nút "Xem phim" — dẫn sang luồng Watch Party (mục 4.5).

### 4.3. Yêu thích / Xem sau / Lịch sử xem (UC-U-02 → UC-U-05)

- Vì CineSync không lưu bản sao đầy đủ dữ liệu phim, mỗi bản ghi Yêu thích/Xem sau/Lịch sử lưu **snapshot tối thiểu**: `movie_slug` (khóa tham chiếu), `movie_name`, `poster_url`, `year` — đủ để hiển thị danh sách nhanh mà không cần gọi lại API MDP; khi User click vào một mục, hệ thống mới gọi API chi tiết theo `slug` để lấy dữ liệu mới nhất.
- Một phim chỉ được Yêu thích **một lần** bởi một User (ràng buộc duy nhất `user_id + movie_slug`); bấm lại nút Yêu thích khi đã có sẽ bỏ yêu thích (toggle).
- Lịch sử xem: mỗi lần Player phát, Client gửi định kỳ (mỗi 15 giây) tiến độ xem hiện tại; Backend `UPSERT` theo `user_id + movie_slug (+ episode_slug nếu là phim bộ)`, chỉ giữ **bản ghi tiến độ mới nhất** cho mỗi phim/tập (không lưu lịch sử từng lần xem — YAGNI).
- "Xem tiếp" hiển thị tối đa 10 phim gần nhất, sắp theo `last_watched_at` giảm dần.

### 4.4. Đánh giá & Bình luận (UC-U-06, UC-U-07)

- Đánh giá: thang điểm 1–5 sao nguyên; mỗi User tối đa 1 đánh giá/phim (`user_id + movie_slug` duy nhất); điểm trung bình hiển thị ở trang chi tiết là số liệu **nội bộ CineSync**, tách biệt hoàn toàn khỏi bất kỳ điểm đánh giá nào MDP có thể trả kèm theo (nếu có, hiển thị riêng kèm ghi chú nguồn).
- Bình luận: gắn với `movie_slug`, tùy chọn gắn thêm `episode_slug` nếu là phim bộ; hỗ trợ trả lời bình luận (1 cấp, không đa cấp — YAGNI); User chỉ sửa/xóa được bình luận của chính mình; Admin có thể ẩn bất kỳ bình luận nào.
- Bình luận có cờ `report_count`; khi một bình luận bị báo cáo ≥ 5 lần, tự động chuyển trạng thái `PENDING_REVIEW` để Admin ưu tiên duyệt (không tự động ẩn).

### 4.5. Watch Party – Xem chung thời gian thực (UC-U-10, UC-U-11) **(MỚI)**

- Host tạo phòng gắn với `movie_slug` (+ `episode_slug` nếu là phim bộ), hệ thống sinh `room_code` 6 ký tự (chữ+số, dễ đọc/gõ lại cho bạn bè).
- **Phân loại chế độ đồng bộ** dựa trên nguồn phát của tập phim (giả định 1.10):
  - Có `linkM3u8` → **Đồng bộ tự động**: Host điều khiển play/pause/seek, sự kiện phát qua WebSocket tới toàn bộ Member; Client tự căn chỉnh dựa trên chênh lệch clock nếu lệch quá ngưỡng (NFR-09).
  - Chỉ có `linkEmbed` (iframe) → **Đồng bộ thủ công**: hệ thống hiển thị cảnh báo "Server này không hỗ trợ đồng bộ tự động", chỉ giữ chat + reaction, Host tự nhắc "3-2-1 play" qua chat.
- Giới hạn tối đa 20 thành viên/phòng ở giai đoạn 1 (BR-12); phòng tự đóng sau 30 phút không hoạt động phát hoặc khi tất cả thành viên rời (BR-13).
- Chat trong phòng **không lưu vĩnh viễn** (BR-14, giả định 1.11) — chỉ tồn tại theo vòng đời phòng.
- Nếu Host rời phòng giữa chừng, quyền Host chuyển cho Member tham gia sớm nhất tiếp theo; nếu phòng không còn ai, phòng tự đóng.

### 4.6. Xã hội & Gợi ý cá nhân hóa (UC-U-12 → UC-U-14) **(MỚI)**

- Follow là quan hệ **1 chiều**, không cần được chấp nhận (đơn giản hơn, đúng YAGNI so với mô hình kết bạn 2 chiều).
- Feed hoạt động chỉ hiển thị hành động công khai theo cấu hình quyền riêng tư của từng User (User có thể tắt "Hiển thị hoạt động xem" trong Cài đặt).
- Gợi ý cá nhân hóa: job chạy định kỳ (VD mỗi đêm), tính collaborative filtering đơn giản kiểu item-based (phim tương tự dựa trên tập User đã đánh giá cao trùng nhau), lưu kết quả vào bảng `recommendations` để đọc nhanh — không tính real-time mỗi lần tải trang.
- User cần tối thiểu 5 lượt đánh giá/xem để có đủ dữ liệu tính gợi ý (BR-15); nếu chưa đủ, hiển thị fallback "Phim thịnh hành" (trending theo lượt Yêu thích nội bộ).

## 5. Quy tắc nghiệp vụ (Business Rules)

| ID | Quy tắc |
|---|---|
| BR-01 | `movie_slug` là khóa tham chiếu duy nhất tới một phim trên MDP; mọi bảng nội bộ liên quan (Yêu thích, Xem sau, Lịch sử, Đánh giá, Bình luận, Watch Party) đều dùng `movie_slug` làm khóa ngoại logic, không có ràng buộc khóa ngoại vật lý tới một bảng "phim" nội bộ. |
| BR-02 | Một User chỉ được Yêu thích một phim đúng 1 lần; toggle để bật/tắt. |
| BR-03 | Một User chỉ được Xem sau một phim đúng 1 lần. |
| BR-04 | Một User chỉ có đúng 1 đánh giá sao cho mỗi phim; gửi lại ghi đè đánh giá cũ. |
| BR-05 | Nội dung bình luận không được để trống, tối đa 2000 ký tự. |
| BR-06 | Tài khoản bị khóa (`is_active = false`) không đăng nhập được nhưng vẫn xem được nội dung công khai với vai trò Guest. |
| BR-07 | Tìm kiếm yêu cầu tối thiểu 2 ký tự (theo đúng ràng buộc của MDP), input ngắn hơn không gọi API. |
| BR-08 | Khi gọi API MDP thất bại (timeout/5xx), Backend trả dữ liệu cache gần nhất nếu có (tối đa 15 phút với danh sách, 60 phút với chi tiết phim), kèm cờ `stale: true`. |
| BR-09 | Admin không có quyền chỉnh sửa nội dung phim (tên, poster, tập phim...) vì đây là dữ liệu do MDP quản lý; Admin chỉ quản lý User và Bình luận. |
| BR-10 | Xóa tài khoản User sẽ ẩn danh hóa bình luận (`user = "Người dùng đã xóa"`) thay vì xóa cứng, để giữ mạch bình luận. |
| BR-11 | Watch Party chỉ hỗ trợ Đồng bộ tự động khi tập phim có `linkM3u8`; nếu chỉ có `linkEmbed`, hệ thống tự chuyển chế độ Đồng bộ thủ công, không can thiệp vào iframe của bên thứ ba. |
| BR-12 | Một phòng Watch Party tối đa 20 thành viên đồng thời (giai đoạn 1); vượt ngưỡng báo "Phòng đã đầy". |
| BR-13 | Phòng tự đóng sau 30 phút không có sự kiện phát (play/pause/seek) hoặc khi tất cả thành viên đã rời. |
| BR-14 | Nội dung chat trong Watch Party không lưu vĩnh viễn vào DB, chỉ tồn tại theo vòng đời phòng. |
| BR-15 | Gợi ý cá nhân hóa yêu cầu User có tối thiểu 5 lượt đánh giá/xem; nếu chưa đủ, hiển thị fallback "Phim thịnh hành". |
| BR-16 | Follow là quan hệ 1 chiều, không cần chấp nhận; một User chỉ follow một User khác tối đa 1 lần (ràng buộc duy nhất theo cặp). |

## 6. Yêu cầu phi chức năng (Non-functional Requirements)

| ID | Yêu cầu |
|---|---|
| NFR-01 | Trang danh sách/tìm kiếm phản hồi dưới 1.5s trong điều kiện mạng bình thường nhờ tầng cache. |
| NFR-02 | Toàn bộ lời gọi tới API MDP đi qua Backend (không gọi trực tiếp từ trình duyệt) để che giấu chi tiết tích hợp, áp dụng cache tập trung, xử lý lỗi/timeout thống nhất — đồng thời tránh lộ endpoint MDP ra Client (mục 8.1). |
| NFR-03 | Có cơ chế retry (tối đa 2 lần, backoff) khi gọi API MDP gặp lỗi mạng tạm thời trước khi trả lỗi cho Client. |
| NFR-04 | Ảnh poster/thumbnail dùng trực tiếp URL tuyệt đối do MDP trả về, không tải về lưu trữ lại (YAGNI). |
| NFR-05 | Hệ thống chịu tải tối thiểu 200 người dùng đồng thời ở giai đoạn 1. |
| NFR-06 | Toàn bộ mật khẩu băm bằng BCrypt; giao tiếp Client–Backend qua HTTPS. |
| NFR-07 | Responsive tối thiểu 3 breakpoint: Mobile / Tablet / Desktop. |
| NFR-08 | Log riêng cho các lời gọi API MDP (endpoint nội bộ, thời gian phản hồi, mã lỗi — không log domain/endpoint thật của MDP) phục vụ UC-A-05. |
| NFR-09 | Độ trễ đồng bộ Watch Party (chênh lệch play/pause/seek giữa Host và Member) tối đa chấp nhận được ~1–2 giây trong điều kiện mạng bình thường. |
| NFR-10 | Kết nối WebSocket của Watch Party phải tự động reconnect khi rớt mạng tạm thời, không làm mất trạng thái phòng. |

## 7. Thực thể nghiệp vụ nội bộ (làm nền cho ERD)

CineSync **không có** entity `MOVIE` đầy đủ trong DB nội bộ — dữ liệu phim luôn lấy trực tiếp/qua cache từ MDP. Các entity nội bộ:

- `USER` — tài khoản, vai trò (`USER`/`ADMIN`), trạng thái hoạt động, **(MỚI)** cờ `show_activity` (quyền riêng tư Feed).
- `FAVORITE` — Yêu thích: `user_id`, `movie_slug`, snapshot hiển thị (`movie_name`, `poster_url`, `year`).
- `WATCHLIST` — Xem sau: cấu trúc tương tự `FAVORITE`.
- `WATCH_HISTORY` — Lịch sử/tiến độ xem: `user_id`, `movie_slug`, `episode_slug` (rỗng với phim lẻ), `progress_seconds`, `last_watched_at`.
- `RATING` — Đánh giá: `user_id`, `movie_slug`, `stars` (1–5).
- `COMMENT` — Bình luận: `user_id`, `movie_slug`, `episode_slug` (tùy chọn), `parent_comment_id` (trả lời 1 cấp), `content`, `status` (`VISIBLE`/`HIDDEN`/`PENDING_REVIEW`), `report_count`.
- `COMMENT_REPORT` — Báo cáo bình luận vi phạm: `comment_id`, `reporter_user_id`, `reason`.
- `API_CALL_LOG` — phục vụ NFR-08/UC-A-05: `endpoint`, `status_code`, `response_time_ms`, `created_at`.

Entity mới cho CineSync:

- **`WATCH_PARTY_ROOM`** *(MỚI)* — `room_id`, `room_code` (unique), `movie_slug`, `episode_slug`, `host_user_id`, `sync_mode` (`AUTO`/`MANUAL`), `status` (`ACTIVE`/`CLOSED`), `created_at`, `closed_at`.
- **`WATCH_PARTY_MEMBER`** *(MỚI)* — `room_id`, `user_id`, `joined_at`, `left_at` — bảng nhẹ ghi lịch sử tham gia, phục vụ thống kê UC-A-06 (trạng thái real-time trong phòng vẫn quản lý qua Socket.IO in-memory, bảng này chỉ để thống kê/audit).
- **`USER_FOLLOW`** *(MỚI)* — `follower_user_id`, `followee_user_id`, `created_at` (ràng buộc duy nhất theo cặp).
- **`RECOMMENDATION`** *(MỚI)* — `user_id`, `movie_slug`, `score`, `reason` (VD `similar_to:<movie_slug>` hoặc `trending`), `generated_at`.

## 8. Tích hợp bên thứ ba (tham chiếu nhanh)

### 8.1. Nhà cung cấp dữ liệu phim (Movie Data Provider – MDP)

> **Không public**: domain, base URL, và đường dẫn endpoint thật của MDP không được ghi trong tài liệu này hay bất kỳ tài liệu nào khác của dự án, vì repo dự kiến public/forkable. Cấu hình qua biến môi trường (`MOVIE_PROVIDER_BASE_URL` — xem `08_CineSync_Technical_Spec.md` mục 10) trong `.env` cục bộ, không commit vào Git; chi tiết endpoint đầy đủ lưu ở tài liệu vận hành riêng, không public.

CineSync lấy toàn bộ dữ liệu phim (danh sách, chi tiết, tập/server phát, thể loại, quốc gia, năm phát hành) từ MDP — dịch vụ public, không cần token, JSON/UTF-8, phương thức GET.

**Nhóm chức năng cần có ở MDP** (ánh xạ nội bộ sang endpoint thật nằm trong tầng `integration`, không mô tả chi tiết ở đây):

| Nhóm chức năng | Dùng cho Use Case |
|---|---|
| Danh sách phim mới cập nhật (trang chủ) | UC-G-01 |
| Danh sách phim theo bộ lọc (loại/trạng thái) | UC-G-02 |
| Tìm kiếm theo từ khóa | UC-G-03 |
| Danh sách + phim theo thể loại | UC-G-04 |
| Danh sách + phim theo quốc gia | UC-G-05 |
| Danh sách + phim theo năm phát hành | UC-G-06 |
| Chi tiết phim (kèm tập/server phát) | UC-G-07, UC-G-08 |

**Hình dạng dữ liệu (data shape) cần thiết để lập trình** (rút gọn, không phải cấu trúc gốc của MDP):
- Danh sách phim: `items[]` gồm `name`, `originName`, `slug`, `posterUrl`, `thumbUrl`, `year`; kèm thông tin phân trang.
- Chi tiết phim: `name`, `originName`, `content`, `posterUrl`, `thumbUrl`, thời lượng, chất lượng, ngôn ngữ, năm, `actor[]`, `director[]`, `category[]`, `country[]`, `episodeCurrent`, `episodeTotal`, và `episodes[]` (danh sách server + tập phát, mỗi tập có `linkEmbed` và/hoặc `linkM3u8` — quyết định `sync_mode` của Watch Party, giả định 1.10).

**Lưu ý triển khai:** dịch vụ bên thứ ba miễn phí, không có SLA công bố — thiết kế graceful degradation (BR-08, NFR-03); không crawl/lưu lại toàn bộ catalog vào DB riêng (YAGNI) — chỉ cache ngắn hạn theo NFR-02/BR-08.

### 8.2. Lớp WebSocket / Socket.IO **(MỚI)**

- Không phải API bên thứ ba, nhưng là tầng hạ tầng bắt buộc cho Watch Party: cần 1 Node service chạy dài hạn (Railway) để giữ kết nối bền — không thể triển khai trên nền tảng serverless (Vercel Functions không hỗ trợ kết nối WebSocket bền).

## 9. Hướng mở rộng (Out of scope giai đoạn 1, ghi nhận cho backlog)

Backlog chung: thông báo phim mới theo thể loại theo dõi (UC-U-09), gói VIP, App Mobile. Backlog riêng của các tính năng mới:

- Voice/video chat trong Watch Party.
- Block User trong tính năng Follow.
- Chuyển quyền Host chủ động (không chỉ khi Host rời phòng), hỗ trợ multi-host.
- Tìm kiếm bằng AI (semantic search theo mô tả tự nhiên) — có thể cân nhắc lại ở giai đoạn sau nếu cần, đánh đổi thêm độ phức tạp hạ tầng.
- Gợi ý phim bằng mô hình học sâu tự huấn luyện (thay vì chỉ dùng collaborative filtering đơn giản) — có thể tận dụng kinh nghiệm XGBoost/SHAP đã làm ở dự án định giá bất động sản.
