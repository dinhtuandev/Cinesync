# Technical Spec – CineSync (Đồ án Sinh viên CNTT)

> **Phiên bản:** Chi tiết hóa cho việc implement (đủ để giao cho AI coding agent hoặc tự code theo)
> **Mục tiêu:** Backend (NestJS) + Frontend (Next.js) cho website xem phim cùng bạn bè
> **Nguyên tắc:** Layered Architecture (Controller → Service → Repository/Drizzle), 1 monolith Backend, không over-engineering (KISS/YAGNI)
> **Tài liệu nguồn:** `01_CineSync_Business_Analysis.md` → `07_CineSync_Architecture.md` — tài liệu này **chi tiết hóa để code**, không lặp lại toàn văn, chỉ trích các phần cần thiết + bổ sung phần còn để mở (VD: RefreshToken).
> **Lưu ý bảo mật thông tin**: tên/endpoint thật của nhà cung cấp dữ liệu phim bên thứ ba không được ghi trong tài liệu này — chỉ gọi tắt là **MDP**, cấu hình qua biến môi trường `MOVIE_PROVIDER_BASE_URL` (xem mục 10).

---

## 1. Tổng quan

### 1.1. Kiến trúc tổng thể

```
┌──────────────────────┐
│  Next.js App (Vercel) │
│  Server + Client Comp │
└──────────┬────────────┘
           │ REST (fetch)          │ WebSocket (Socket.IO, thẳng tới Railway)
           ▼                        ▼
┌─────────────────────────────────────────┐
│         Backend (Railway) — NestJS        │
│  REST Controllers   +   WatchPartyGateway  │
└──────────┬─────────────────┬──────────────┘
           ▼                 ▼
┌─────────────────┐  ┌──────────────────┐
│ PostgreSQL       │  │ MDP API           │
│ (Railway)        │  │ (bên thứ ba)       │
└─────────────────┘  └──────────────────┘
```

### 1.2. Tech Stack

| Thành phần | Library | Ghi chú |
|---|---|---|
| Runtime | Node.js 22 LTS | Dùng chung Backend + tooling Frontend |
| Backend Framework | **NestJS 11.x** | Module/Controller/Service/DI + Guard — map tư duy Spring Boot |
| ORM | **Drizzle ORM** + `pg` (node-postgres) | Schema khai báo gần SQL thuần, migration bằng `drizzle-kit` |
| Auth | `@nestjs/jwt`, `@nestjs/passport`, `passport-jwt`, `bcrypt` | JWT + RefreshToken (mục 4) |
| Validation | `class-validator` + `class-transformer` | DTO decorator-based, chuẩn NestJS |
| Realtime | `@nestjs/websockets`, `@nestjs/platform-socket.io`, `socket.io` 4.x | `WatchPartyGateway`, namespace `/watch-party` |
| Scheduler | `@nestjs/schedule` (cron) | Đóng phòng hết hạn (BR-13), batch gợi ý đêm (mục 4.7 BA) |
| HTTP Client (integration) | `@nestjs/axios` (axios) | Gọi MDP API |
| Cache MDP | `@nestjs/cache-manager` (in-memory) hoặc bảng cache đơn giản | Không bắt buộc Redis ở giai đoạn 1, ưu tiên đơn giản |
| Env config | `@nestjs/config` (dotenv) | Đọc biến môi trường, validate bằng `class-validator` |
| Frontend Framework | **Next.js 15.x (App Router)** | SSR/ISR cho trang công khai |
| Frontend Data | TanStack Query 5.x, Socket.IO client 4.x | Cache fetch + kết nối realtime |
| UI | TailwindCSS 4.x | Áp dụng design system tối màu đã thống nhất (mục 1, `06_CineSync_Wireframe_Specification.md`) |
| Frontend Validation | `zod` | Validate form phía Client trước khi gọi API |

---

## 2. Cấu trúc thư mục

### 2.1. Backend (`backend/`)

```
backend/
├── src/
│   ├── main.ts                       # Bootstrap: NestFactory, ValidationPipe, CORS, Socket.IO adapter
│   ├── app.module.ts                 # Import toàn bộ feature module
│   │
│   ├── config/
│   │   └── configuration.ts          # Đọc + validate env vars
│   │
│   ├── common/
│   │   ├── guards/
│   │   │   ├── jwt-auth.guard.ts     # Guard cho REST (kiểm tra Bearer JWT)
│   │   │   ├── roles.guard.ts        # Guard kiểm tra role USER/ADMIN
│   │   │   └── ws-jwt.guard.ts       # Guard cho Socket.IO handshake
│   │   ├── decorators/
│   │   │   ├── current-user.decorator.ts
│   │   │   └── roles.decorator.ts
│   │   ├── filters/
│   │   │   └── http-exception.filter.ts   # Chuẩn hóa response lỗi { success:false, message, errors }
│   │   ├── interceptors/
│   │   │   └── response.interceptor.ts    # Bọc response thành { success:true, message, data }
│   │   └── dto/
│   │       └── pagination.dto.ts
│   │
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── strategies/jwt.strategy.ts
│   │   │   └── dto/ (login.dto.ts, register.dto.ts, refresh-token.dto.ts...)
│   │   │
│   │   ├── users/                    # Hồ sơ, đổi mật khẩu, settings (showActivity)
│   │   ├── movies/                   # Proxy MDP: home/list/search/genres/countries/years/detail
│   │   │   ├── movies.controller.ts
│   │   │   ├── movies.service.ts
│   │   │   └── mdp-client.service.ts      # Cache + retry + fallback + ghi api_call_logs
│   │   │
│   │   ├── favorites/ watchlists/ watch-history/ ratings/ comments/
│   │   │                             # nghiệp vụ tương tác phim — xây trên NestJS/Drizzle (đặc tả đầy đủ ở `05_CineSync_API_Specification.md` mục 5-8)
│   │   │
│   │   ├── watch-party/              # (MỚI)
│   │   │   ├── watch-party.controller.ts  # REST: create/get/join/leave/close
│   │   │   ├── watch-party.service.ts     # Business logic + Drizzle
│   │   │   ├── watch-party.gateway.ts     # Socket.IO Gateway (mục 3.1)
│   │   │   ├── watch-party-room.store.ts  # In-memory Map<roomCode, RoomState>
│   │   │   └── watch-party.scheduler.ts   # @Cron: đóng phòng hết hạn 30 phút (BR-13)
│   │   │
│   │   ├── social/                   # (MỚI) Follow + Feed
│   │   │   ├── follow.controller.ts
│   │   │   ├── follow.service.ts
│   │   │   └── feed.service.ts
│   │   │
│   │   ├── recommendations/          # (MỚI)
│   │   │   ├── recommendations.controller.ts
│   │   │   ├── recommendations.service.ts
│   │   │   └── recommendations.scheduler.ts  # @Cron chạy đêm (mục 4.7 BA)
│   │   │
│   │   └── admin/                    # Dashboard, Users, Comments, ApiLogs, WatchPartyMonitor
│   │
│   └── db/
│       ├── schema.ts                 # Drizzle schema — map 1-1 cinesync_postgresql_schema.sql
│       ├── drizzle.module.ts         # Provider kết nối pool `pg`
│       └── migrations/               # Sinh bởi `drizzle-kit generate`
│
├── drizzle.config.ts
├── .env.example
├── package.json
└── nest-cli.json
```

### 2.2. Frontend (`web/`) — tóm tắt

```
web/
├── app/
│   ├── (public)/ page.tsx, movies/[slug]/page.tsx, search/page.tsx
│   ├── (public)/watch-party/[roomCode]/page.tsx   # (MỚI) Client Component toàn phần
│   ├── (user)/ profile/, feed/, settings/
│   ├── (admin)/ admin/...
│   └── api/auth/ route.ts            # Route Handler: set/clear cookie JWT httpOnly
├── components/ (movie/, comment/, watch-party/, common/)
├── lib/ (api-client.ts, socket-client.ts, auth.ts)
└── context/AuthContext.tsx
```
*(Chi tiết đầy đủ xem `07_CineSync_Architecture.md` mục 4 — tài liệu này tập trung sâu vào Backend vì đó là phần nhiều logic nghiệp vụ nhất.)*

---

## 3. Database Schema (Drizzle) — tóm tắt

> Nguồn sự thật là `cinesync_postgresql_schema.sql` — Drizzle schema chỉ là lớp ánh xạ TypeScript, không định nghĩa lại ràng buộc.

### 3.1. Models (14 bảng)

| Nhóm | Bảng | Ghi chú |
|---|---|---|
| Nền tảng | `roles`, `app_users`, `password_reset_requests` | `app_users` có thêm `show_activity` |
| Tương tác phim | `favorites`, `watchlists`, `watch_history`, `ratings` | Kế thừa nguyên |
| Bình luận | `comments`, `comment_reports` | Kế thừa nguyên + trigger |
| Vận hành | `api_call_logs` | Log lời gọi tới MDP (endpoint nội bộ, thời gian phản hồi, mã lỗi — không log domain/endpoint thật, đúng NFR-08) |
| **Watch Party (MỚI)** | `watch_party_rooms`, `watch_party_members` | Trạng thái real-time không nằm ở đây (mục 5) |
| **Xã hội (MỚI)** | `user_follows`, `recommendations` | |
| **MỚI (Technical Spec)** | `refresh_tokens` | Bổ sung ở bước này cho cơ chế Auth (mục 4) — chưa có trong ERD gốc |

### 3.2. Bảng `refresh_tokens` (bổ sung mới ở Technical Spec)

```ts
// db/schema.ts
export const refreshTokens = pgTable('refresh_tokens', {
  tokenId: bigint('token_id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  userId: bigint('user_id', { mode: 'number' }).notNull().references(() => appUsers.userId),
  token: varchar('token', { length: 255 }).notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userIdx: index('ix_refresh_tokens_user_id').on(table.userId),
}));
```

### 3.3. Ví dụ Drizzle schema cho bảng `watch_party_rooms`

```ts
export const watchPartyRooms = pgTable('watch_party_rooms', {
  roomId: bigint('room_id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  roomCode: varchar('room_code', { length: 10 }).notNull(),
  hostUserId: bigint('host_user_id', { mode: 'number' }).notNull().references(() => appUsers.userId),
  movieSlug: varchar('movie_slug', { length: 255 }).notNull(),
  episodeSlug: varchar('episode_slug', { length: 255 }).notNull().default(''),
  syncMode: varchar('sync_mode', { length: 10 }).notNull(),
  status: varchar('status', { length: 10 }).notNull().default('ACTIVE'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  closedAt: timestamp('closed_at', { withTimezone: true }),
});
```

---

## 4. Authentication – AccessToken + RefreshToken (bổ sung so với 05_CineSync_API_Specification.md)

> `05_CineSync_API_Specification.md` mục 3 chỉ mô tả `login` trả về 1 JWT đơn — Technical Spec này **chi tiết hóa thêm** cơ chế RefreshToken, đồng bộ với quyết định "JWT lưu cookie `httpOnly`" đã chốt ở `07_CineSync_Architecture.md` mục 5. Bổ sung endpoint `POST /api/v1/auth/refresh-token` vào API thực tế khi code.

### 4.1. Flow

```
Đăng nhập → AccessToken (JWT, 1 giờ, set qua cookie httpOnly)
          → RefreshToken (chuỗi random, lưu DB, 30 ngày, cookie httpOnly riêng)

AccessToken hết hạn → Next.js Route Handler tự gọi /auth/refresh-token bằng RefreshToken
                     → Backend kiểm tra DB → cấp AccessToken mới → set lại cookie

Đổi mật khẩu / Logout → Xóa RefreshToken trong DB → phiên bị hủy ngay
```

### 4.2. Pseudocode – `AuthService`

```ts
async login(email: string, password: string) {
  const user = await this.usersRepo.findByEmail(email);
  if (!user || !(await bcrypt.compare(password, user.passwordHash)))
    throw new BadRequestException('Email hoặc mật khẩu không đúng');
  if (!user.isActive) throw new ForbiddenException('Tài khoản đã bị khóa');

  const accessToken = this.jwtService.sign(
    { sub: user.userId, role: user.roleName },
    { expiresIn: '1h' },
  );
  const refreshToken = randomBytes(40).toString('hex');
  await this.authRepo.saveRefreshToken(user.userId, refreshToken, 30); // 30 ngày

  return { accessToken, refreshToken, user: toUserDto(user) };
}

async refreshAccessToken(refreshToken: string) {
  const record = await this.authRepo.findRefreshToken(refreshToken);
  if (!record || record.expiresAt < new Date())
    throw new UnauthorizedException('RefreshToken không hợp lệ hoặc đã hết hạn');

  const user = await this.usersRepo.findById(record.userId);
  const accessToken = this.jwtService.sign({ sub: user.userId, role: user.roleName }, { expiresIn: '1h' });
  return { accessToken };
}

async logout(userId: number) {
  await this.authRepo.deleteRefreshTokens(userId);
}
```

### 4.3. `WsJwtGuard` cho Socket.IO

```ts
@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const client: Socket = context.switchToWs().getClient();
    const token = client.handshake.auth?.token;
    try {
      const payload = this.jwtService.verify(token);
      client.data.user = payload; // { sub, role }
      return true;
    } catch {
      throw new WsException('Token không hợp lệ');
    }
  }
}
```

---

## 5. Pseudocode – Service Layer (các module trọng tâm)

### 5.1. `WatchPartyService` + `WatchPartyGateway`

```ts
// watch-party.service.ts
async createRoom(hostUserId: number, movieSlug: string, episodeSlug = '') {
  const episode = await this.moviesService.getEpisode(movieSlug, episodeSlug);
  const syncMode = episode.linkM3u8 ? 'AUTO' : 'MANUAL';   // BR-11
  const roomCode = generateRoomCode(6);

  const [room] = await this.db.insert(watchPartyRooms).values({
    roomCode, hostUserId, movieSlug, episodeSlug, syncMode, status: 'ACTIVE',
  }).returning();

  this.roomStore.init(room.roomCode, { hostUserId, syncMode, members: new Set() });
  return room;
}

async joinRoom(roomCode: string, userId: number) {
  const state = this.roomStore.get(roomCode);
  if (!state || state.status === 'CLOSED') throw new NotFoundException('Phòng không tồn tại hoặc đã đóng');
  if (state.members.size >= 20) throw new ConflictException('Phòng đã đầy');   // BR-12

  state.members.add(userId);
  state.lastActivityAt = new Date();
  await this.db.insert(watchPartyMembers).values({ roomId: state.roomId, userId }); // audit
  return state;
}
```

```ts
// watch-party.gateway.ts
@WebSocketGateway({ namespace: '/watch-party', cors: { origin: process.env.CORS_ORIGIN } })
export class WatchPartyGateway {
  @WebSocketServer() server: Server;

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('join_room')
  async handleJoinRoom(client: Socket, payload: { roomCode: string }) {
    const userId = client.data.user.sub;
    const state = await this.watchPartyService.joinRoom(payload.roomCode, userId);
    client.join(payload.roomCode);
    client.emit('room_state', toRoomStateDto(state));
    client.to(payload.roomCode).emit('member_joined', { userId });
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('playback_event')
  handlePlayback(client: Socket, payload: PlaybackEventDto) {
    const { roomCode } = client.data;
    const state = this.roomStore.get(roomCode);
    if (client.data.user.sub !== state.hostUserId) return;     // chỉ Host điều khiển
    if (state.syncMode !== 'AUTO') return;                     // BR-11
    state.lastActivityAt = new Date();
    client.to(roomCode).emit('playback_event', payload);        // broadcast (UC37)
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('chat_message')
  handleChat(client: Socket, payload: { text: string }) {
    const { roomCode } = client.data;
    // Không lưu DB (giả định 1.12) — chỉ broadcast
    this.server.to(roomCode).emit('chat_message', { userId: client.data.user.sub, text: sanitize(payload.text) });
  }
}
```

```ts
// watch-party.scheduler.ts
@Cron('*/5 * * * *')  // mỗi 5 phút
async closeStaleRooms() {
  const staleRoomCodes = this.roomStore.findStale(30 * 60 * 1000); // BR-13
  for (const code of staleRoomCodes) {
    this.server.to(code).emit('room_closed', { reason: 'INACTIVITY_TIMEOUT' });
    await this.watchPartyService.closeRoom(code);
    this.roomStore.remove(code);
  }
}
```

### 5.2. `RecommendationsService` (batch job đêm)

```ts
@Cron('0 2 * * *')  // 2h sáng mỗi ngày
async generateNightly() {
  const eligibleUsers = await this.usersRepo.findWithMinInteractions(5);  // BR-15 (BA)
  for (const user of eligibleUsers) {
    const scored = await this.computeItemBasedSimilarity(user.userId);   // collaborative filtering đơn giản
    await this.db.transaction(async (tx) => {
      await tx.delete(recommendations).where(eq(recommendations.userId, user.userId));
      if (scored.length) await tx.insert(recommendations).values(scored);
    });
  }
}
```

---

## 6. Pseudocode – Controller Layer

```ts
// watch-party.controller.ts
@Controller('watch-parties')
@UseGuards(JwtAuthGuard)
export class WatchPartyController {
  @Post()
  create(@CurrentUser() user, @Body() dto: CreateWatchPartyDto) {
    return this.service.createRoom(user.sub, dto.movieSlug, dto.episodeSlug);
  }

  @Get(':roomCode')
  getInfo(@Param('roomCode') roomCode: string) {
    return this.service.getRoomInfo(roomCode);
  }

  @Post(':roomCode/join')
  join(@CurrentUser() user, @Param('roomCode') roomCode: string) {
    return this.service.joinRoom(roomCode, user.sub);
  }
}
```

---

## 7. Guards / Middleware quan trọng

```ts
// jwt-auth.guard.ts — dùng sẵn passport-jwt strategy, chỉ cần extends AuthGuard('jwt')
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}

// roles.guard.ts
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
  canActivate(ctx: ExecutionContext): boolean {
    const roles = this.reflector.get<string[]>('roles', ctx.getHandler());
    if (!roles) return true;
    const { user } = ctx.switchToHttp().getRequest();
    return roles.includes(user.role);
  }
}

// response.interceptor.ts — bọc mọi response thành { success, message, data }
@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler) {
    return next.handle().pipe(map((data) => ({ success: true, message: 'Thao tác thành công', data })));
  }
}
```

---

## 8. Business Rules quan trọng — Implement ở đâu

| ID | Rule | Implement ở đâu |
|---|---|---|
| BR-11 | Watch Party chỉ `AUTO` khi có `linkM3u8` | `WatchPartyService.createRoom()` — check `episode.linkM3u8` |
| BR-12 | Tối đa 20 thành viên/phòng | `WatchPartyService.joinRoom()` — check `state.members.size` |
| BR-13 | Phòng tự đóng sau 30 phút không hoạt động | `WatchPartyScheduler.closeStaleRooms()` (`@Cron`) |
| BR-14 | Chat không lưu DB | `WatchPartyGateway.handleChat()` — chỉ `emit`, không `insert` |
| BR-15 | Gợi ý cần tối thiểu 5 lượt đánh giá/xem | `RecommendationsService.generateNightly()` — `findWithMinInteractions(5)` |
| BR-16 | Follow 1 chiều, không tự follow | `FollowService.follow()` — check `followerId !== followeeId` + unique constraint DB bắt lỗi trùng |
| ERD-R-14 | `room_code` duy nhất trong số `ACTIVE` | Partial unique index DB (`ux_watch_party_rooms_active_code`) — Service chỉ cần bắt lỗi constraint violation |
| ERD-R-19 | `recommendations` ghi đè theo lô | `RecommendationsService.generateNightly()` — `delete` rồi `insert` trong `tx` |

---

## 9. Ước tính thời gian thực hiện

| # | Module | Nội dung | Thời gian |
|---|---|---|---|
| 1 | **Bootstrap Backend** | Init NestJS, Drizzle, config, guards, interceptors, filters | 2 giờ |
| 2 | **Bootstrap Frontend** | Init Next.js, Tailwind, layout, AuthContext, api-client | 1.5 giờ |
| 3 | **DB Schema + Migration** | Chạy `cinesync_postgresql_schema.sql`, viết Drizzle schema, seed roles | 1.5 giờ |
| 4 | **Auth** | Register, Login, RefreshToken, ForgotPassword, ResetPassword + FE login/register Modal | 3 giờ |
| 5 | **Movies Proxy** | `MdpClient` (cache/retry/fallback) + toàn bộ endpoint danh sách/chi tiết + FE trang chủ/danh sách/chi tiết | 4 giờ |
| 6 | **Favorites/Watchlist/History/Ratings/Comments** | Xây dựng theo đặc tả `05_CineSync_API_Specification.md` mục 5-8 + FE tương ứng | 4 giờ |
| 7 | **Watch Party** | `WatchPartyGateway` + REST + FE Player/Chat/Reaction + Scheduler | 6 giờ |
| 8 | **Xã hội (Follow/Feed)** | Follow API + Feed query + FE Follow button/Feed panel | 2.5 giờ |
| 9 | **Gợi ý cá nhân hóa** | Batch job + endpoint + FE carousel "Dành cho bạn" | 2 giờ |
| 10 | **Admin** | Dashboard, Users, Comment moderation, API logs, Watch Party monitor + FE | 3 giờ |
| 11 | **Deploy** | Setup Railway (Backend + Postgres) + Vercel + env vars | 1.5 giờ |
| 12 | **Test & Fix** | Test thủ công các luồng chính (đặc biệt Watch Party đa tab) + fix bug | 3 giờ |
| | **Tổng cộng** | | **~34.5 giờ** |

### Phân bổ theo tuần (nếu làm ~4 tiếng/ngày, 3 buổi/tuần)

| Tuần | Nhiệm vụ | Giờ |
|---|---|---|
| Tuần 1 | Bootstrap BE+FE, DB Schema, Auth | 8 giờ |
| Tuần 2 | Movies Proxy, Favorites/Watchlist/History/Ratings/Comments | 8 giờ |
| Tuần 3 | Watch Party (phần khó nhất — nên dành trọn tuần) | 6 giờ |
| Tuần 4 | Xã hội, Gợi ý cá nhân hóa | 4.5 giờ |
| Tuần 5 | Admin, Deploy, Test & Fix | 7.5 giờ |

---

## 10. Environment Variables

```env
# ─── Backend (Railway) ───
PORT=8080
NODE_ENV=production
DATABASE_URL="postgresql://user:pass@host:5432/cinesync"     # Railway inject qua private network
JWT_SECRET=your-super-secret-key
JWT_ACCESS_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_DAYS=30
MOVIE_PROVIDER_BASE_URL=                                      # KHÔNG commit giá trị thật — set trên dashboard Railway/.env cục bộ (xem lưu ý đầu tài liệu)
CORS_ORIGIN=https://cinesync.vercel.app

# ─── Frontend (Vercel) ───
NEXT_PUBLIC_API_URL=https://cinesync-backend.up.railway.app/api/v1
NEXT_PUBLIC_WS_URL=wss://cinesync-backend.up.railway.app
```

---

## 11. Response Format chuẩn *(đồng bộ với `05_CineSync_API_Specification.md`)*

```json
// Thành công
{ "success": true, "message": "Đã tạo phòng xem chung", "data": { ... } }

// Lỗi
{ "success": false, "message": "Phòng đã đầy", "errors": { "roomCode": "Đã đạt tối đa 20 thành viên" } }

// Phân trang
{ "success": true, "message": "Thao tác thành công",
  "data": { "items": [...], "pagination": { "page": 1, "pageSize": 20, "total": 45, "totalPages": 3 } } }
```

---

## 12. Lưu ý khi bảo vệ đồ án

### Câu hỏi thường gặp từ hội đồng

1. **"Tại sao Watch Party không lưu trạng thái phòng vào DB theo real-time?"**
   → Trạng thái phòng (ai đang online, đang phát giây nào) thay đổi liên tục theo từng sự kiện WebSocket; ghi DB mỗi sự kiện sẽ tạo tải không cần thiết. DB chỉ lưu khi tạo/đóng phòng và audit tham gia (`watch_party_members`) — nguồn sự thật cho trạng thái đang chạy là bộ nhớ của tiến trình Node.

2. **"Tại sao chọn cookie httpOnly thay vì localStorage để lưu JWT?"**
   → Next.js Server Component chạy phía server, không đọc được `localStorage` của trình duyệt — cần cookie để trang chủ SSR biết User đã đăng nhập (hiển thị "Xem tiếp"/"Dành cho bạn" ngay từ lần render đầu). Cookie `httpOnly` cũng giảm rủi ro XSS đánh cắp token so với lưu ở `localStorage`.

3. **"Đồng bộ Watch Party xử lý độ trễ mạng thế nào?"**
   → Server broadcast sự kiện kèm `positionSeconds` tuyệt đối (không phải delta); Client tự so sánh với vị trí hiện tại của Player, chỉ điều chỉnh (`sync_correction`) nếu lệch vượt ngưỡng ~1-2 giây — tránh giật hình liên tục vì chênh lệch nhỏ.

4. **"Tại sao gợi ý cá nhân hóa tính bằng batch job thay vì real-time?"**
   → Collaborative filtering cần quét toàn bộ tập đánh giá của nhiều User — tính lại mỗi lần tải trang sẽ chậm và tốn tài nguyên. Tính 1 lần/đêm, đọc từ bảng `recommendations` lúc runtime là đủ mới cho nhu cầu xem gợi ý phim (không cần real-time tuyệt đối).

5. **"Vì sao không public tên/endpoint thật của nhà cung cấp dữ liệu phim?"**
   → Repo dự kiến public/forkable; ràng buộc sử dụng của dịch vụ bên thứ ba miễn phí này không rõ ràng cho việc phân phối lại thông tin tích hợp công khai, nên tài liệu chỉ gọi tắt là MDP và giá trị thật chỉ nằm trong biến môi trường cục bộ, không commit.

### Demo flow khi bảo vệ

1. **Tạo phòng xem chung** → mở 2 tab trình duyệt (2 tài khoản khác nhau) → tab 1 tạo phòng, tab 2 nhập mã tham gia → verify: tab 1 play/pause, tab 2 tự đồng bộ theo.
2. **Chat + reaction trong phòng** → verify real-time cả 2 tab.
3. **Follow + Feed** → tài khoản A đánh giá 1 phim → tài khoản B (đang follow A) thấy xuất hiện trên Feed.
4. **Xem "Dành cho bạn"** → verify fallback "Phim thịnh hành" khi tài khoản mới chưa đủ 5 lượt đánh giá/xem.
5. **Admin giám sát** → xem danh sách phòng đang hoạt động, đóng cưỡng chế 1 phòng → verify tab Client nhận `room_closed`.

---

## 13. Tổng kết các quyết định kỹ thuật & lý do

| Quyết định | Lý do |
|---|---|
| NestJS thay vì Express thuần | Cấu trúc Module/DI/Guard sẵn có, đặc biệt lợi thế cho `WatchPartyGateway` (`@WebSocketGateway` built-in) |
| Drizzle thay vì Prisma | Schema gần SQL thuần, hợp phong cách tự viết DDL/trigger tay trực tiếp |
| Trạng thái Watch Party ở bộ nhớ, không phải DB | Tránh tải DB không cần thiết cho dữ liệu thay đổi liên tục theo giây |
| Không dùng Redis/Socket.IO Adapter ở giai đoạn 1 | 1 instance Railway đủ cho quy mô mục tiêu (vài chục phòng đồng thời) — thêm Redis là việc dễ làm sau nếu cần scale ngang |
| RefreshToken (bổ sung ở Technical Spec) | Cặp đôi tự nhiên với cookie `httpOnly`; giảm rủi ro khi AccessToken bị lộ (hết hạn nhanh) mà không bắt User đăng nhập lại liên tục |
| Không public tên/endpoint thật của MDP | Repo public/forkable — chỉ cấu hình qua biến môi trường, tránh phát tán chi tiết tích hợp của bên thứ ba mà dự án phụ thuộc |
