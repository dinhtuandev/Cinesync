# CineSync — Frontend

Giao diện web xem phim + Watch Party của dự án **CineSync**. Xây trên **Next.js 15** (App Router) + **React 19** + **Tailwind CSS 4** + **TanStack Query 5**. Deploy trên **Vercel**.

UI tiếng Việt. Dữ liệu phim lấy qua **server-side provider chain** (VSMOV → KKPhim → TMDB + vidsrc embed) — KHÔNG gọi provider trực tiếp từ client, KHÔNG lộ tên miền/endpoint provider trong bundle.

---

## 1. Tech stack

| Layer | Lib / Tool | Ghi chú |
|---|---|---|
| Framework | `next@15.5` (App Router, Turbopack) | `dev`/`build` chạy qua `--turbopack` |
| Runtime | Node.js 22 LTS | `engines.node` enforce |
| UI | `react@19` + `tailwindcss@4` | Theme dark mặc định (`<html className="dark">`) |
| Components | `radix-ui` + `class-variance-authority` + `lucide-react` | Bám shadcn-style (`components.json`) |
| Data fetching | `@tanstack/react-query@5` | Client cache; SSR fetch qua `lib/server-api.ts` |
| Validation | `zod@4` | Form / parse payload |
| Realtime | `socket.io-client@4` | Namespace `/watch-party` (UI shell, BE pending) |
| PWA | `next.config` + `public/manifest.webmanifest` | `PWARegister` component |
| Package mgr | `pnpm@11` | `pnpm-workspace.yaml` + `pnpm-lock.yaml` committed |

---

## 2. Cấu trúc thư mục

```
frontend/
├─ app/                          # Next.js App Router
│  ├─ layout.tsx                 # Root layout (Header/Footer/PWA/Skip-link)
│  ├─ page.tsx                   # Home — ISR 900s, server-rendered carousels
│  ├─ movies/
│  │  ├─ page.tsx                # Browse — filter theo type/genre/year/country
│  │  ├─ [slug]/
│  │  │  ├─ page.tsx             # Movie detail — ISR 600s
│  │  │  └─ watch/page.tsx       # Watch — dynamic (maxAge cache 5 phút)
│  ├─ search/page.tsx
│  ├─ genres/[slug]/page.tsx
│  ├─ countries/[slug]/page.tsx
│  ├─ years/[year]/page.tsx
│  ├─ random/page.tsx            # Random wheel
│  ├─ watch-party/[roomCode]/page.tsx
│  └─ api/search/route.ts        # Route handler — debounced search proxy
│
├─ components/
│  ├─ layout/                    # Header, Footer, nav-items
│  ├─ common/                    # MoviePosterCard, MovieCarousel, BrowseIndex,
│  │                             # Browse, ShareButton, PWARegister, States
│  ├─ watch/                     # VideoPlayerFrame, WatchPartyRoom,
│  │                             # NextEpisodeBanner, AmbientModeToggle
│  ├─ random/RandomMovieWheel.tsx
│  └─ ui/                        # button, input, sheet, badge, separator, skeleton
│
├─ lib/
│  ├─ server-api.ts              # Multi-provider facade (xem mục 4)
│  ├─ providers/
│  │  ├─ base.ts                 # Fetcher + TTL cache + normalize helpers
│  │  ├─ vsmov.ts                # Nguồn 1 — primary
│  │  ├─ kkphim.ts               # Nguồn 2 — fallback (geo-sensitive)
│  │  ├─ vidsrc.ts               # Nguồn 3 — TMDB catalog + embed player
│  │  └─ types.ts                # ProviderKey, ListType, PROVIDER_LABELS
│  ├─ api-client.ts              # Client-side fetch wrapper (NestJS BE)
│  ├─ socket-client.ts           # Socket.IO client (lib/namespaces/watch-party)
│  └─ types.ts                   # MovieListItem / MovieDetail / Episode
│
├─ context/AuthContext.tsx       # Auth state client-side
├─ public/                       # icons/, manifest.webmanifest, og image
├─ next.config.ts                # Cấu hình Next
├─ vercel.json                   # installCommand/buildCommand cho Vercel
└─ .env.example                  # Mẫu biến môi trường
```

---

## 3. Bắt đầu nhanh

Yêu cầu: **Node.js 22 LTS**, **pnpm 11+**.

```bash
cd frontend
pnpm install
cp .env.example .env.local      # điền giá trị (xem mục 6)
pnpm dev                        # http://localhost:3000  — Turbopack
```

Build & chạy production local:

```bash
pnpm build
pnpm start
```

Lint:

```bash
pnpm lint
```

> Node 22 là bắt buộc — `engines.node` sẽ từ chối cài nếu sai version.

---

## 4. Multi-provider & caching

Mọi fetch phim đi qua `lib/server-api.ts`. Đăng ký provider theo thứ tự:

1. **Nguồn 1 — VSMOV** (primary, bắt buộc) — `MOVIE_PROVIDER_BASE_URL`
2. **Nguồn 2 — KKPhim** (fallback) — `MOVIE_PROVIDER_FALLBACK_URL`; có thể geo-block từ Vercel US/EU region, khuyến nghị đặt Function Region gần VN (`sin1`)
3. **Nguồn 3 — TMDB + vidsrc embed** — bật khi có `TMDB_API_KEY` (lấy miễn phí tại themoviedb.org). Catalog từ TMDB, playback qua iframe `vidsrc.sbs`

Cơ chế:

- `getMovieList`, `getGenres`, `getCountries`, `getYears`, `searchMovies` — **fallback chain**: provider trước lỗi (`MdpError`: timeout/network/HTTP error) → thử provider kế tiếp. Lỗi programming/runtime rethrow ngay.
- `getMovieDetail` — duyệt tuần tự provider; `null` từ một provider (phim không tồn tại trên nguồn đó) → provider kế tiếp.
- `getAggregatedMovieDetail` (dùng ở trang chi tiết) — lấy **song song** từ mọi nguồn đăng ký; nguồn phụ được dò bằng tìm kiếm tiêu đề + năm. Trang chi tiết hợp nhất server của tất cả nguồn.
- URL chuyển nguồn: `?src=1|2|3` + `&eslug=<slug-riêng-của-nguồn>`. Trang watch khi nguồn hiện tại lỗi sẽ đề xuất chuyển nguồn còn lại (fallback chéo).

### TTL cache (BR-08)

`lib/providers/base.ts` giữ in-memory cache **trong một runtime Node duy nhất** — KHÔNG chia sẻ giữa các instance serverless Vercel. Mỗi cold start = cache mới.

| Kind | TTL |
|---|---|
| List / search | 15 phút |
| Detail | 60 phút |
| Watch page (force) | 5 phút (`maxAgeMs`) để tránh render link phát hết hạn |

Upstream lỗi → trả stale entry (nếu có), không kích hoạt fallback chain ở tầng này.

### Bảo mật provider

- Tất cả provider được `import "server-only"` — KHÔNG lọt vào client bundle.
- Provider trả URL ảnh tương đối → `absoluteImageUrl()` ghép với CDN base.
- Embed iframe dùng `referrerPolicy="no-referrer"` để provider không thấy domain CineSync trong log referer.

---

## 5. Trang & route chính

| Path | Render | Cache | Ghi chú |
|---|---|---|---|
| `/` | Server Component | ISR 900s | Hero + 5 carousel (Mới cập nhật, Phim lẻ, Phim bộ, Đang chiếu, 4K) |
| `/movies` | Server | ISR 600s | Browse theo `?type=`, kèm filter genre/year/country |
| `/movies/[slug]` | Server | ISR 600s | Chi tiết + server list (aggregate đa nguồn) |
| `/movies/[slug]/watch` | Server | Dynamic, cache 5 phút | Player iframe, switch nguồn `?src=`, episode `?episode=` |
| `/search` | Server | dynamic | Qua `app/api/search/route.ts` |
| `/genres`, `/countries`, `/years` | Server | ISR 3600s | Index list |
| `/random` | Server + Client | dynamic | Random wheel — chọn phim ngẫu nhiên |
| `/watch-party/[roomCode]` | Client Component | dynamic | UI shell, chờ Backend WS thật |
| `/api/search` | Route Handler | dynamic | Debounced proxy sang provider search |

---

## 6. Biến môi trường

Tất cả biến **server-only** (không prefix `NEXT_PUBLIC_`) phải đặt trong Vercel Project Settings. Xem `.env.example` để biết thứ tự.

| Biến | Bắt buộc | Mô tả |
|---|---|---|
| `MOVIE_PROVIDER_BASE_URL` | ✅ | Nguồn 1 (VSMOV). Server-side only. KHÔNG commit giá trị thật. |
| `MOVIE_PROVIDER_FALLBACK_URL` | ❌ | Nguồn 2 (KKPhim/phimapi). Bỏ trống nếu không dùng fallback. |
| `TMDB_API_KEY` | ❌ | Bật Nguồn 3 khi có key. Bỏ trống = tắt. |
| `TMDB_BASE_URL` | ❌ | Mặc định `https://api.themoviedb.org/3` |
| `VIDSRC_BASE_URL` | ❌ | Mặc định `https://vidsrc.sbs` |
| `NEXT_PUBLIC_API_URL` | ❌ | NestJS BE REST base (`/api/v1`). Để trống khi chưa có BE. |
| `NEXT_PUBLIC_WS_URL` | ❌ | Backend WebSocket origin cho `/watch-party`. |

> **Repo public** — chỉ commit `.env.example` (giá trị rỗng), KHÔNG commit `.env.local`. Provider base URL chỉ tồn tại trong Vercel env.

---

## 7. Deploy lên Vercel

1. Import repo vào Vercel.
2. **Root Directory** = `frontend`.
3. Cấu hình env vars theo mục 6 (Project → Settings → Environment Variables).
4. (Khuyến nghị) Function Region gần VN: `sin1` — giảm geo-block cho KKPhim ở Nguồn 2.
5. Deploy. `vercel.json` đã chốt `installCommand` (`pnpm install --frozen-lockfile`) và `buildCommand` (`pnpm build`).
6. ISR routes tự động phục vụ qua Vercel Edge CDN.

---

## 8. Player & Watch Party

### Player (`components/watch/VideoPlayerFrame.tsx`)

- Iframe third-party cho embed URL từ provider. KHÔNG kiểm soát buffering / bitrate / watermark / internals của player nguồn. Chỉ kiểm soát vòng đời container.
- Timeout load 15s → overlay lỗi + nút chuyển nguồn dự phòng.
- Picture-in-Picture dùng **Document PiP API** (Chromium desktop). Mobile ẩn nút.
- Khi BE cung cấp `linkM3u8` thật → nhánh `isHls` là chỗ cắm HLS.js (CHƯA cắm — chờ nguồn HLS thực).

### Watch Party (`/watch-party/[roomCode]`)

- Toàn trang là **Client Component** (bắt buộc cho socket realtime).
- Kết nối namespace `/watch-party` qua `lib/socket-client.ts`.
- Hiện tại (BE chưa sẵn sàng): UI shell hiển thị trạng thái `offline` trung thực + nút "Thử lại". Comment `TODO(backend)` ở `WatchPartyRoom.tsx` đánh dấu điểm cắm.
- Spec đầy đủ xem `ba_docs/06_CineSync_Wireframe_Specification.md` (SCR-WP-xx) + `ba_docs/05_CineSync_API_Specification.md` (WebSocket events).

### NextEpisodeBanner

Gợi ý tập kế khi tập hiện tại gần kết thúc. Logic dự đoán "episode likely ends" ở `app/movies/[slug]/watch/page.tsx`.

### AmbientModeToggle

Đổi background của trang watch sang tone màu từ poster phim (CSS `mix-blend` + color extraction phía client).

---

## 9. PWA

- `public/manifest.webmanifest` + `public/icons/icon-{192,512}.png`
- `PWARegister` component mount service worker khi vào `/` (client-only).
- `viewport.themeColor = "#e11d48"` (rose), `appleWebApp.capable = true`.
- Skip-link đầu trang (`Bỏ qua tới nội dung chính`) cho a11y.

---

## 10. Patterns & quy ước

- **Public pages** = Server Component (SSR/ISR). Tương tác nhỏ → Client Component nhúng vào.
- **Watch Party page** = Client Component toàn phần.
- **Optimistic UI** cho Favorites / Watchlist / Follow — rollback + Toast khi lỗi.
- **Toast hạn chế** ở trang Player / Watch Party (không che Player). Dùng badge nhỏ góc trên-trái.
- **Auth state** = React Context (`context/AuthContext.tsx`), KHÔNG Redux. Fetch data thường = TanStack Query.
- **API error envelope** đồng bộ với BE: `{ success, message, data }` hoặc `{ success:false, message, errors }`. Class `ApiError` parse sẵn ở `lib/api-client.ts`.
- **CSS**: utility-first Tailwind 4; component variants dùng `class-variance-authority`; ghép class qua `cn()` ở `lib/utils.ts` (twMerge + clsx).
- **shadcn CLI** có sẵn (`shadcn@4`) nếu cần thêm primitive.

---

## 11. Bảo mật & quy tắc bắt buộc

- **KHÔNG commit** tên miền / endpoint / API key provider thật. Chỉ `.env.example` (giá trị rỗng).
- Tất cả call provider qua `import "server-only"` modules — không lọt vào client bundle.
- Iframe embed luôn `referrerPolicy="no-referrer"`.
- Khi render nội dung người dùng (comment/chat — sẽ có khi BE ready), escape HTML trước hiển thị.
- Ảnh từ provider dùng `<img>` + `fetchPriority="high"` cho hero; còn lại Next/Image. Tất cả ảnh có `alt` (rỗng cho ảnh trang trí).

---

## 12. Troubleshooting

| Triệu chứng | Nguyên nhân / Fix |
|---|---|
| Trang home trống, console có cảnh báo | Chưa cấu hình `MOVIE_PROVIDER_BASE_URL` — xem mục 6. |
| KKPhim trả 404 trên production | Geo-block. Đổi Function Region sang `sin1` hoặc bỏ `MOVIE_PROVIDER_FALLBACK_URL`. |
| Watch Party báo "offline" | BE WS chưa sẵn sàng — đúng spec. Shell hiển thị trung thực, không fake connect. |
| Nguồn 3 không xuất hiện | Thiếu `TMDB_API_KEY`. Bỏ trống = tắt nguồn 3 hoàn toàn. |
| `pnpm install` từ chối | Sai Node. Yêu cầu 22 LTS (xem `engines`). |
| Build fail vì peer dep | Đã chốt lockfile trong `vercel.json` — KHÔNG xoá `pnpm-lock.yaml`. |

---

## 13. Tài liệu liên quan (repo)

| File | Nội dung |
|---|---|
| `ba_docs/01_CineSync_Business_Analysis.md` | Use case + BR-01→16 + NFR |
| `ba_docs/05_CineSync_API_Specification.md` | REST + WebSocket spec |
| `ba_docs/06_CineSync_Wireframe_Specification.md` | Design system + wireframe SCR-* |
| `ba_docs/07_CineSync_Architecture.md` | Kiến trúc tổng thể |
| `ba_docs/08_CineSync_Technical_Spec.md` | Chi tiết kỹ thuật (env, cấu trúc) |
| `CLAUDE.md` (root) | Quy ước dự án + business rules |