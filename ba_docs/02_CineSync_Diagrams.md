# Use Case Diagram và Activity Diagram – CineSync

## 1. Quy ước

- Actor gồm: `Guest`, `User`, `Admin`.
- Dữ liệu phim lấy qua **MDP** (Movie Data Provider — nhà cung cấp dữ liệu phim bên thứ ba, tên/endpoint thật không public, xem `01_CineSync_Business_Analysis.md` mục 8.1); khóa tham chiếu phim là `movie_slug`.
- Trong một phòng Watch Party, một `User` giữ vai trò tạm thời Host hoặc Member — không phải actor riêng, không thể hiện trên Use Case Diagram.
- Mã Use Case trong sơ đồ (`UC01`, `UC02`...) là mã **nội bộ của tài liệu diagram này**, khác với mã `UC-G/U/A-xx` trong BA — có bảng đối chiếu ở mục 8.

## 2. Use Case Diagram

```mermaid
flowchart LR
    G[Guest]
    U[User]
    A[Admin]

    subgraph MS[Hệ thống CineSync]
        direction TB

        subgraph Public[Chức năng công khai]
            UC01([Xem trang chủ])
            UC02([Xem danh sách phim theo bộ lọc])
            UC03([Tìm kiếm phim - từ khóa])
            UC04([Xem theo thể loại/quốc gia/năm])
            UC05([Xem chi tiết phim])
            UC06([Xem phim - Player])
            UC07([Đăng ký])
            UC08([Đăng nhập])
            UC09([Quên mật khẩu])
        end

        subgraph UserFeature[Chức năng User]
            UC10([Quản lý hồ sơ cá nhân])
            UC11([Đổi mật khẩu])
            UC12([Thêm/Bỏ Yêu thích])
            UC13([Thêm/Bỏ Xem sau])
            UC14([Xem tiếp - Continue watching])
            UC15([Đánh giá phim])
            UC16([Bình luận phim])
            UC17([Sửa/Xóa bình luận của mình])
            UC18([Báo cáo bình luận vi phạm])
            UC19([Quản lý danh sách Yêu thích/Xem sau/Lịch sử])
            UC20([Tạo phòng xem chung])
            UC21([Tham gia phòng xem chung])
            UC22([Theo dõi - Follow người dùng khác])
            UC23([Xem Feed hoạt động bạn bè])
            UC24([Xem gợi ý Dành cho bạn])
        end

        subgraph AdminFeature[Chức năng Admin]
            UC25([Xem dashboard hệ thống])
            UC26([Quản lý người dùng])
            UC27([Kiểm duyệt bình luận])
            UC28([Xem log tích hợp MDP])
            UC29([Giám sát phòng xem chung])
        end

        subgraph Included[Use Case được bao gồm]
            UC30([Gọi API MDP lấy dữ liệu phim])
            UC31([Ghi/Cập nhật tiến độ xem])
            UC32([Ghi log lời gọi API MDP])
            UC33([Tự động chuyển bình luận sang chờ duyệt])
            UC34([Phát sự kiện đồng bộ qua WebSocket])
        end
    end

    G --- UC01
    G --- UC02
    G --- UC03
    G --- UC04
    G --- UC05
    G --- UC06
    G --- UC07
    G --- UC08
    G --- UC09

    U --- UC01
    U --- UC10
    U --- UC11
    U --- UC12
    U --- UC13
    U --- UC14
    U --- UC15
    U --- UC16
    U --- UC17
    U --- UC18
    U --- UC19
    U --- UC20
    U --- UC21
    U --- UC22
    U --- UC23
    U --- UC24

    A --- UC08
    A --- UC25
    A --- UC26
    A --- UC27
    A --- UC28
    A --- UC29

    UC01 -. "<<include>>" .-> UC30
    UC02 -. "<<include>>" .-> UC30
    UC04 -. "<<include>>" .-> UC30
    UC05 -. "<<include>>" .-> UC30
    UC06 -. "<<include>>" .-> UC31
    UC18 -. "<<include>>" .-> UC33
    UC30 -. "<<include>>" .-> UC32
    UC21 -. "<<include>>" .-> UC34
```

### 2.1. Ghi chú Use Case

- `UC20`/`UC21` (Tạo/Tham gia phòng xem chung) chỉ dành cho User; `UC21` bao gồm việc phát/nhận sự kiện đồng bộ qua WebSocket (`UC34`) khi phòng ở chế độ `AUTO`.
- `UC22`/`UC23`/`UC24` (Follow, Feed, Gợi ý) là nhóm tính năng xã hội — không có Use Case tương ứng bên Guest.
- `UC28`/`UC29` là 2 màn hình giám sát của Admin: log tích hợp MDP (kế thừa từ nhu cầu theo dõi tình trạng bên thứ ba) và giám sát Watch Party.
- Mọi lời gọi tới `UC30` (API MDP) đều được ghi log qua `UC32`, phục vụ `UC28`.

## 3. Activity Diagram – Quy trình xem phim và ghi lịch sử

```mermaid
flowchart TD
    Start([Bắt đầu]) --> Browse[Duyệt trang chủ/danh sách/tìm kiếm]
    Browse --> CallApi[Gọi API MDP lấy dữ liệu]
    CallApi --> ApiOk{API phản hồi thành công?}
    ApiOk -- Không --> Cache{Có dữ liệu cache còn hạn?}
    Cache -- Có --> ShowStale[Hiển thị dữ liệu cache, cờ stale]
    Cache -- Không --> ShowError[Hiển thị thông báo lỗi tải dữ liệu]
    ShowError --> End([Kết thúc])
    ShowStale --> SelectMovie
    ApiOk -- Có --> SelectMovie[Chọn một phim]

    SelectMovie --> DetailApi[Gọi API chi tiết phim theo slug]
    DetailApi --> ShowDetail[Hiển thị chi tiết, danh sách tập/server]
    ShowDetail --> PlayEp[Chọn tập/server và phát, hoặc bấm 'Tạo phòng xem chung' - mục 5]

    PlayEp --> LoggedIn{Đã đăng nhập?}
    LoggedIn -- Không --> WatchOnly[Chỉ phát phim, không lưu tiến độ]
    WatchOnly --> End

    LoggedIn -- Có --> WatchLoop[Phát video]
    WatchLoop --> Tick{Mỗi 15 giây}
    Tick --> SaveProgress[Gửi tiến độ xem hiện tại]
    SaveProgress --> Upsert[UPSERT watch_history theo user + movie_slug]
    Upsert --> Continue{Còn đang xem?}
    Continue -- Có --> Tick
    Continue -- Không --> End
```

### 3.1. Kết quả của quy trình xem phim

- Nếu API MDP lỗi nhưng có dữ liệu cache hợp lệ, User vẫn xem được danh sách (BR-08), kèm cảnh báo dữ liệu có thể chưa mới nhất.
- Tiến độ xem chỉ được lưu khi User đã đăng nhập; Guest xem phim bình thường nhưng không có "Xem tiếp".
- Mỗi phim/tập chỉ giữ **một** bản ghi tiến độ mới nhất cho mỗi User (không lưu lịch sử từng lần xem).

## 4. Activity Diagram – Quy trình bình luận và kiểm duyệt

```mermaid
flowchart TD
    Start([Bắt đầu]) --> Login{Đã đăng nhập?}
    Login -- Không --> Auth[Đăng nhập hoặc đăng ký]
    Auth --> AuthOK{Xác thực thành công?}
    AuthOK -- Không --> Auth
    AuthOK -- Có --> WriteComment
    Login -- Có --> WriteComment[Nhập nội dung bình luận]

    WriteComment --> Valid{Nội dung hợp lệ?<br/>Không rỗng, tối đa 2000 ký tự}
    Valid -- Không --> WriteComment
    Valid -- Có --> SaveComment[Lưu bình luận, trạng thái VISIBLE]
    SaveComment --> Publish[Hiển thị công khai dưới phim]
    Publish --> Report{Có User báo cáo vi phạm?}

    Report -- Không --> End([Kết thúc])
    Report -- Có --> IncReport[Tăng report_count]
    IncReport --> Threshold{report_count >= 5?}
    Threshold -- Không --> End
    Threshold -- Có --> Pending[Chuyển trạng thái: PENDING_REVIEW]
    Pending --> AdminReview[Admin xem xét bình luận]
    AdminReview --> Decision{Quyết định của Admin?}
    Decision -- Hợp lệ --> Restore[Chuyển lại VISIBLE]
    Decision -- Vi phạm --> Hide[Chuyển trạng thái: HIDDEN]
    Restore --> End
    Hide --> End
```

### 4.1. Quy tắc chuyển trạng thái bình luận

| Trạng thái hiện tại | Sự kiện | Trạng thái sau xử lý | Ghi chú |
|---|---|---|---|
| VISIBLE | User gửi bình luận hợp lệ | VISIBLE | Hiển thị công khai ngay. |
| VISIBLE | Bị báo cáo, `report_count` < 5 | VISIBLE | Chưa đủ ngưỡng, chưa can thiệp. |
| VISIBLE | Bị báo cáo, `report_count` >= 5 | PENDING_REVIEW | Ưu tiên vào hàng chờ duyệt của Admin. |
| PENDING_REVIEW | Admin xác nhận hợp lệ | VISIBLE | Bình luận hiển thị lại bình thường. |
| PENDING_REVIEW | Admin xác nhận vi phạm | HIDDEN | Ẩn khỏi công khai, giữ lại để tra cứu. |
| Bất kỳ | Chủ bình luận tự xóa | (xóa cứng) | User chỉ xóa được bình luận của chính mình. |

## 5. Activity Diagram – Watch Party (Tạo & tham gia phòng xem chung) **(MỚI)**

```mermaid
flowchart TD
    Start([Bắt đầu]) --> AtDetail[User ở trang chi tiết phim]
    AtDetail --> CreateBtn[Bấm 'Tạo phòng xem chung']
    CreateBtn --> CheckSrc{Tập phim có linkM3u8?}
    CheckSrc -- Có --> ModeAuto[sync_mode = AUTO]
    CheckSrc -- Không, chỉ linkEmbed --> ModeManual[sync_mode = MANUAL]
    ModeAuto --> CreateRoom[Sinh room_code, tạo WATCH_PARTY_ROOM status=ACTIVE]
    ModeManual --> CreateRoom
    CreateRoom --> Share[Host chia sẻ room_code cho bạn bè]

    Share --> Join[Member nhập room_code để tham gia]
    Join --> CheckFull{Số thành viên < 20?}
    CheckFull -- Không --> Full[Hiển thị 'Phòng đã đầy']
    Full --> End1([Kết thúc])
    CheckFull -- Có --> Connect[Kết nối WebSocket, thêm WATCH_PARTY_MEMBER]

    Connect --> ModeCheck{sync_mode?}
    ModeCheck -- AUTO --> HostControl[Host play/pause/seek]
    HostControl --> Broadcast[Broadcast sự kiện qua WebSocket - UC34]
    Broadcast --> ClientAdjust[Client Member tự chỉnh nếu lệch > ngưỡng NFR-09]
    ClientAdjust --> Loop1{Còn thành viên hoạt động?}

    ModeCheck -- MANUAL --> ChatOnly[Chỉ chat + reaction, không auto-control]
    ChatOnly --> Loop1

    Loop1 -- Có --> ModeCheck
    Loop1 -- Không, hoặc 30 phút không hoạt động --> CloseRoom[Đóng phòng: status = CLOSED]
    CloseRoom --> End2([Kết thúc])
```

### 5.1. Kết quả của quy trình Watch Party

- Nếu Host rời phòng giữa chừng, quyền Host chuyển cho Member tham gia sớm nhất tiếp theo (không thể hiện trên sơ đồ để giữ gọn, xem BR-13/mục 4.5 BA).
- Chat trong phòng không lưu DB vĩnh viễn (BR-14) — luồng gửi/nhận chat không ghi vào Activity Diagram vì đây là I/O tức thời qua WebSocket, không có bước xử lý nghiệp vụ phức tạp.

## 6. Activity Diagram – Gợi ý cá nhân hóa (batch job hàng đêm) **(MỚI)**

```mermaid
flowchart TD
    Start([Cron job chạy hàng đêm]) --> GetUsers[Lấy danh sách User có >= 5 lượt đánh giá/xem - BR-15]
    GetUsers --> Loop{Còn User chưa xử lý?}
    Loop -- Có --> Compute[Tính similarity item-based theo phim đã đánh giá cao]
    Compute --> SaveRec[Ghi đè bảng recommendations cho User đó]
    SaveRec --> Loop
    Loop -- Không --> End([Kết thúc job])
```

> User chưa đủ 5 lượt đánh giá/xem không được job này xử lý; khi họ mở màn hình "Dành cho bạn", Backend tính fallback "Phim thịnh hành" trực tiếp theo lượt Yêu thích nội bộ (không cần batch job riêng vì tính đơn giản, thực hiện real-time).

## 7. Kiểm tra nhất quán với tài liệu BA

| Nội dung | Thể hiện trong sơ đồ |
|---|---|
| Watch Party chỉ đồng bộ tự động khi có `linkM3u8` (giả định 1.10, BR-11) | Nhánh `CheckSrc` trong Activity Diagram mục 5 |
| Giới hạn 20 thành viên/phòng (BR-12) | Nhánh `CheckFull` trong Activity Diagram mục 5 |
| Phòng tự đóng sau 30 phút không hoạt động (BR-13) | Nhánh `Loop1` → `CloseRoom` |
| Gợi ý yêu cầu tối thiểu 5 lượt đánh giá/xem (BR-15) | Bước `GetUsers` trong Activity Diagram mục 6 |
| Đồng bộ MDP graceful degradation (BR-08) | Nhánh `Cache` trong Activity Diagram mục 3 |

## 8. Đối chiếu mã sơ đồ với Business Analysis

| Mã sơ đồ | Mã Use Case trong BA |
|---|---|
| `UC01`–`UC09` | `UC-G-01` đến `UC-G-11` (kế thừa, gộp một số hành động liên quan) |
| `UC10`–`UC19` | `UC-U-01` đến `UC-U-09` |
| `UC20`–`UC24` | `UC-U-10` đến `UC-U-14` |
| `UC25`–`UC29` | `UC-A-01` đến `UC-A-06` (`UC-A-01` Đăng nhập quản trị dùng chung `UC08`) |
| `UC30`–`UC34` | Hành động con, không có mã Use Case độc lập trong BA (tương ứng mục 8 – Tích hợp bên thứ ba). |
