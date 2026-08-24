# Tích hợp PhimAPI (KKPhim) vào CineSync

> Trạng thái xác minh: **hoạt động** — verified live 23/08/2026 (HTTP 200, dữ liệu cập nhật realtime, không cần API key).
> Base URL: `https://phimapi.com`
> Nguồn: KKPhim.vip — publish công khai "API dành cho nhà phát triển website phim". Không có SLA chính thức, không rate-limit doc rõ ràng → **luôn cache ở backend, không gọi thẳng từ Next.js client trên mỗi request.**

---

## 0. Kiến trúc đề xuất

```
[Next.js Frontend]
      │  chỉ gọi API của chính bạn, KHÔNG BAO GIỜ gọi phimapi.com trực tiếp
      ▼
[NestJS Backend] ── PhimApiService (wrapper + retry + cache)
      │
      ├──► Redis (cache list 10-15p, detail 6h, categories 24h)
      ├──► PostgreSQL + pgvector (bảng movies — nguồn sự thật cho search/recommend)
      └──► phimapi.com (chỉ gọi khi cache miss / cron sync)

[Cron job] → gọi phim-moi-cap-nhat mỗi 15-30p → upsert vào Postgres → embed mô tả phim → pgvector
```

**Lý do không gọi thẳng từ client:**
1. phimapi.com không có SLA — nếu sập, CineSync sập theo nếu phụ thuộc trực tiếp.
2. Bạn cần dữ liệu nằm trong Postgres để chạy semantic search (pgvector) và recommendation — API bên ngoài không hỗ trợ vector search.
3. Ẩn được nguồn dữ liệu backend thật, tránh scraper khác nhắm vào chính CineSync.

---

## 1. Danh sách endpoint

### 1.1. Danh sách phim mới cập nhật
```
GET https://phimapi.com/danh-sach/phim-moi-cap-nhat?page={page}
GET https://phimapi.com/danh-sach/phim-moi-cap-nhat-v2?page={page}   // thêm field mở rộng
GET https://phimapi.com/danh-sach/phim-moi-cap-nhat-v3?page={page}
```
Dùng cho: cron job đồng bộ, trang "Mới cập nhật".

### 1.2. Danh sách theo loại + filter (endpoint mạnh nhất cho catalog)
```
GET https://phimapi.com/v1/api/danh-sach/{type_list}
    ?page={page}
    &sort_field={modified.time|_id|year}
    &sort_type={asc|desc}
    &sort_lang={vietsub|thuyet-minh|long-tieng}
    &category={slug}      // lấy slug từ /the-loai
    &country={slug}       // lấy slug từ /quoc-gia
    &year={year}
    &limit={n}            // tối đa 64
```
`type_list` ∈ `phim-bo | phim-le | tv-shows | hoat-hinh | phim-vietsub | phim-thuyet-minh | phim-long-tieng`

### 1.3. Tìm kiếm
```
GET https://phimapi.com/v1/api/tim-kiem
    ?keyword={keyword}
    &page={page}&sort_field=&sort_type=&sort_lang=&category=&country=&year=&limit=
```

### 1.4. Chi tiết phim + danh sách tập
```
GET https://phimapi.com/phim/{slug}
```
Trả về full metadata + toàn bộ `episodes[].server_data[]` (chứa `link_m3u8`, `link_embed`).

### 1.5. Tra cứu theo TMDB ID
```
GET https://phimapi.com/tmdb/{type}/{id}      // type = tv | movie
```
Chỉ hoạt động với phim KKPhim đã gắn TMDB ID sẵn.

### 1.6. Danh mục tham chiếu (dùng để build filter UI)
```
GET https://phimapi.com/the-loai              // list thể loại + slug
GET https://phimapi.com/quoc-gia              // list quốc gia + slug
GET https://phimapi.com/v1/api/quoc-gia/{slug}?page=...   // phim theo quốc gia
GET https://phimapi.com/v1/api/nam/{year}?page=...        // phim theo năm
```

Tất cả endpoint: **GET, không header đặc biệt, không auth, CORS mở.**

---

## 2. Response schema

### 2.1. List endpoints (`danh-sach`, `v1/api/danh-sach`, `tim-kiem`)
```json
{
  "status": true,
  "msg": "done",
  "items": [
    {
      "_id": "87ab3132cd2f2d71f335b84f2503e6ae",
      "name": "Tài phiệt và Cảnh sát (Phần 2)",
      "slug": "tai-phiet-va-canh-sat-phan-2",
      "origin_name": "Flex X Cop (Season 2)",
      "poster_url": "https://phimimg.com/uploads/movies/20260810/....poster.webp",
      "thumb_url": "https://phimimg.com/uploads/movies/20260810/....thumb.webp",
      "year": 2026,
      "tmdb": { "id": "220074", "type": "tv", "season": 2, "vote_average": 7.8, "vote_count": 43 },
      "imdb": { "id": "tt30413181", "vote_average": 7.9, "vote_count": 2651 },
      "modified": { "time": "2026-08-23T20:59:19.000Z" }
    }
  ],
  "pagination": {
    "totalItems": 29802,
    "totalItemsPerPage": 24,
    "currentPage": 1,
    "totalPages": 1242
  }
}
```
*(mẫu trên lấy trực tiếp từ response thật của `phim-moi-cap-nhat?page=1` lúc audit)*

### 2.2. Chi tiết phim (`/phim/{slug}`)
```json
{
  "status": true,
  "msg": "done",
  "movie": {
    "name": "...", "origin_name": "...", "slug": "...",
    "content": "Mô tả phim...",
    "type": "single | series",
    "status": "completed | ongoing",
    "poster_url": "...", "thumb_url": "...",
    "year": 2026, "time": "95 phút",
    "episode_current": "Full",
    "episode_total": "1",
    "quality": "FHD", "lang": "Vietsub",
    "category": [{ "name": "Hành Động", "slug": "hanh-dong" }],
    "country": [{ "name": "Anh", "slug": "anh" }],
    "actor": ["Jason Statham", "..."],
    "director": ["Jean-François Richet"],
    "tmdb": { "vote_average": 7.3 }
  },
  "episodes": [
    {
      "server_name": "Vietsub #1",
      "server_data": [
        {
          "name": "Tập 1", "slug": "tap-1", "filename": "...",
          "link_embed": "https://...",
          "link_m3u8": "https://.../index.m3u8"
        }
      ]
    }
  ]
}
```

### 2.3. `/the-loai` và `/quoc-gia`
```json
[
  { "_id": "...", "name": "Hành Động", "slug": "hanh-dong" }
]
```

---

## 3. Ví dụ request thật (đã test)

```bash
# Danh sách mới nhất — đã verify live, trả JSON thật
curl "https://phimapi.com/danh-sach/phim-moi-cap-nhat?page=1"

# Lọc phim bộ, thể loại hành động, TQ, 2024, mới nhất trước
curl "https://phimapi.com/v1/api/danh-sach/phim-bo?page=1&sort_field=modified.time&sort_type=desc&category=hanh-dong&country=trung-quoc&year=2024&limit=24"

# Search
curl "https://phimapi.com/v1/api/tim-kiem?keyword=tau%20buon%20nguoi&limit=10"

# Chi tiết phim
curl "https://phimapi.com/phim/tau-buon-nguoi"
```

---

## 4. NestJS integration

### 4.1. `phim-api.service.ts`
```typescript
import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { Cache } from 'cache-manager';
import { Inject, CACHE_MANAGER } from '@nestjs/common';

const BASE_URL = 'https://phimapi.com';

@Injectable()
export class PhimApiService {
  private readonly logger = new Logger(PhimApiService.name);

  constructor(
    private readonly http: HttpService,
    @Inject(CACHE_MANAGER) private cache: Cache,
  ) {}

  private async getWithCache<T>(url: string, ttlSeconds: number): Promise<T> {
    const cached = await this.cache.get<T>(url);
    if (cached) return cached;

    try {
      const res = await firstValueFrom(
        this.http.get<T>(url, { timeout: 8000 }),
      );
      await this.cache.set(url, res.data, ttlSeconds * 1000);
      return res.data;
    } catch (err) {
      this.logger.error(`PhimAPI call failed: ${url}`, err);
      // fallback: trả cache cũ nếu có, dù đã hết TTL, thà có dữ liệu cũ còn hơn lỗi trắng trang
      const stale = await this.cache.get<T>(`stale:${url}`);
      if (stale) return stale;
      throw err;
    }
  }

  getLatest(page = 1) {
    return this.getWithCache(
      `${BASE_URL}/danh-sach/phim-moi-cap-nhat?page=${page}`,
      15 * 60, // 15 phút
    );
  }

  getByType(
    type: 'phim-bo' | 'phim-le' | 'hoat-hinh' | 'tv-shows',
    params: Record<string, string | number> = {},
  ) {
    const qs = new URLSearchParams(params as any).toString();
    return this.getWithCache(
      `${BASE_URL}/v1/api/danh-sach/${type}?${qs}`,
      15 * 60,
    );
  }

  search(keyword: string, page = 1) {
    return this.getWithCache(
      `${BASE_URL}/v1/api/tim-kiem?keyword=${encodeURIComponent(keyword)}&page=${page}`,
      5 * 60, // search nên fresh hơn
    );
  }

  getDetail(slug: string) {
    return this.getWithCache(`${BASE_URL}/phim/${slug}`, 6 * 60 * 60); // 6h — ít đổi
  }

  getCategories() {
    return this.getWithCache(`${BASE_URL}/the-loai`, 24 * 60 * 60);
  }

  getCountries() {
    return this.getWithCache(`${BASE_URL}/quoc-gia`, 24 * 60 * 60);
  }
}
```

### 4.2. Cron job đồng bộ vào Postgres + pgvector
```typescript
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class MovieSyncService {
  constructor(
    private phimApi: PhimApiService,
    private moviesRepo: MoviesRepository, // TypeORM/Prisma repo của bạn
    private embeddingService: EmbeddingService, // gọi model embedding để tạo vector cho pgvector
  ) {}

  @Cron(CronExpression.EVERY_30_MINUTES)
  async syncLatestMovies() {
    let page = 1;
    let hasMore = true;

    while (hasMore && page <= 5) { // giới hạn 5 trang/lần để tránh quá tải
      const data = await this.phimApi.getLatest(page);

      for (const item of data.items) {
        const exists = await this.moviesRepo.findBySlug(item.slug);
        if (exists && exists.modifiedTime === item.modified.time) continue; // không đổi, skip

        const detail = await this.phimApi.getDetail(item.slug);
        const embedding = await this.embeddingService.embed(
          `${detail.movie.name} ${detail.movie.origin_name} ${detail.movie.content}`,
        );

        await this.moviesRepo.upsert({
          slug: item.slug,
          name: detail.movie.name,
          originName: detail.movie.origin_name,
          content: detail.movie.content,
          posterUrl: detail.movie.poster_url,
          year: detail.movie.year,
          category: detail.movie.category,
          country: detail.movie.country,
          episodes: detail.episodes, // JSONB column
          modifiedTime: item.modified.time,
          embedding, // vector column, pgvector
        });
      }

      hasMore = page < data.pagination.totalPages;
      page++;
    }
  }
}
```

### 4.3. Ghi chú vận hành
- **Timeout + retry**: set timeout 8-10s, retry tối đa 2 lần với backoff — API cộng đồng có lúc chậm.
- **Ảnh**: `poster_url`/`thumb_url` trỏ về `phimimg.com` — dùng thẳng qua Next.js `<Image>` với `remotePatterns` cho phép domain này, hoặc proxy qua CDN riêng của bạn để tránh phụ thuộc.
- **`link_m3u8`**: đây là link stream thật của bên thứ ba (không phải server bạn host) — nếu phát trực tiếp trong CineSync, nhớ xử lý CORS/referer trên player (hls.js), và cân nhắc rủi ro pháp lý bên dưới.

---

## 5. Lưu ý pháp lý (đọc trước khi merge vào portfolio)

`phimapi.com` tổng hợp phim không có giấy phép bản quyền phát hành tại VN — đây là hình thức tương tự các site đã từng bị chặn (phimmoi.net, 2020). Với CineSync là dự án portfolio:

- **An toàn**: dùng metadata (tên, poster, thể loại, mô tả) để build tính năng search/recommendation/UI — đây là phần thể hiện kỹ năng kỹ thuật của bạn, không phải nội dung vi phạm.
- **Rủi ro**: nhúng thẳng `link_m3u8` để phát video thật công khai. Nếu demo cho nhà tuyển dụng, nên: (a) để repo private/demo có kiểm soát, hoặc (b) ghi rõ trong README "chỉ dùng dữ liệu mẫu/demo, không phục vụ mục đích thương mại", hoặc (c) thay phần phát video thật bằng metadata-only + placeholder player cho bản public.

Nguồn 2
📋 Báo cáo Audit API — vidsrc.sbs
Kiến trúc phát hiện được
vidsrc.sbs là một site WordPress (theme vidzee-stream + LiteSpeed Cache, PHP 8.3). Phát hiện quan trọng nhất:

Site KHÔNG có backend catalog API riêng. Toàn bộ dữ liệu phim (danh sách, chi tiết, episode, search, genre) được frontend gọi trực tiếp từ TMDB public API (
https://api.themoviedb.org/3
) bằng fetch từ trình duyệt, với api_key nhúng trong page source. "API" của vidsrc.sbs thực chất chỉ là embed player routes dạng HTML (iframe wrapper cho các bên cung cấp nguồn phát thứ ba).

Cơ chế đã xác minh qua: HTML tĩnh + 3 JS bundle (main.js chứa toàn bộ logic tmdbFetch, bundle2.js = plugin ContentShield anti-devtools — lý do DOM bị xóa trắng khi mở DevTools, bundle3.js = bản copy logic trang chủ) + kiểm thử GET trực tiếp.

Bảng tổng hợp API
API	Method	Purpose	Parameters	Auth required	Publicly accessible
api.themoviedb.org/3/trending/movie/week	GET	Trending movies (hero slider + rail)	api_key*, language=en-US, page=1	TMDB api_key (query param)	✅ PUBLIC
api.themoviedb.org/3/trending/tv/week	GET	Trending TV rail	như trên	TMDB api_key	✅ PUBLIC
…/movie/top_rated · /movie/now_playing · /movie/upcoming	GET	Rails: Top rated / Now playing / Coming soon	api_key, language, page	TMDB api_key	✅ PUBLIC
api.themoviedb.org/3/movie/{tmdb_id}	GET	Chi tiết phim + credits + trailer + gợi ý	path: tmdb_id; query: append_to_response=credits,videos,recommendations, language, api_key	TMDB api_key	✅ PUBLIC
api.themoviedb.org/3/tv/{tmdb_id}	GET	Chi tiết series	như trên	TMDB api_key	✅ PUBLIC
api.themoviedb.org/3/tv/{tmdb_id}/season/{n}	GET	Danh sách episode của 1 season	path: tmdb_id, n; query: language, api_key	TMDB api_key	✅ PUBLIC
api.themoviedb.org/3/search/multi (hoặc /search/movie, /search/tv)	GET	Search đa loại	query, page (site cap ở total_pages≤500), language, api_key	TMDB api_key	✅ PUBLIC
api.themoviedb.org/3/discover/movie	GET	Listing + filter + pagination trang /movies/	sort_by (mặc định popularity.desc), with_genres, primary_release_year, vote_average.gte, page, api_key	TMDB api_key	✅ PUBLIC
api.themoviedb.org/3/discover/tv	GET	Listing trang /tvshows/	như trên nhưng năm dùng first_air_date_year	TMDB api_key	✅ PUBLIC
api.themoviedb.org/3/genre/movie/list · /genre/tv/list	GET	Danh mục genre (id + name)	language, api_key	TMDB api_key	✅ PUBLIC
vidsrc.sbs/embed/movie/{tmdb_id}/	GET	Player route của site (HTML + CFG inline)	path: tmdb_id	❌ Không	✅ PUBLIC (đã test → HTTP 200, X-Frame-Options: ALLOWALL)
vidsrc.sbs/embed/tv/{tmdb_id}/{season}/{episode}/	GET	Player route TV (đã test 1399/1/1 → 200)	path: tmdb_id, season, episode	❌ Không	✅ PUBLIC
POST vidsrc.sbs/wp-admin/admin-ajax.php	POST	View-counter analytics (action=vza_log_view, body: tmdb_id, media_type, season, episode, view_type)	form-urlencoded; frontend gửi không nonce, không cookie → endpoint ghi ẩn danh	❌ Không (write-only, không dùng cho catalog)	✅ PUBLIC
vidsrc.sbs/wp-json/	GET	WP REST root	—	—	⚠️ PUBLIC nhưng chỉ namespace chuẩn WP (không có data API phim)
* ⚠️ SECRET/CREDENTIAL finding: site nhúng TMDB v3 api_key dưới dạng plaintext trong page source (object VidZeeData.tmdbKey, xem view-source trang chủ). Theo quy tắc audit của bạn tôi không trích xuất giá trị — chỉ báo rằng nó tồn tại và lộ công khai. Để kiểm thử, hãy đăng ký key miễn phí tại themoviedb.org hoặc tự xem giá trị tại vị trí nêu trên. Không có credential nào khác bị lộ (GA IDs G-8HTJ4J30G6/GT-5MGPNWNX là tracking ID công khai, không phải secret).

Phân loại
PUBLIC API: toàn bộ endpoint TMDB ở trên + embed routes + admin-ajax analytics.
CLIENT-SIDE CONFIG: object VidZeeData (ajaxUrl, nonce WP, tmdbKey, mảng servers[] chứa template URL player); object CFG inline trong trang embed; object VidZeePage trên các trang detail/browse/search (chứa tmdbId, mediaType, query, prefetchedData). Server embed phát hiện: web.nxsha.app, cinesrc.st, player.videasy.net.
AUTHENTICATED API: /wp-admin/admin.php?page=vidzee-settings (admin panel theme, JS tham chiếu khi thiếu key) — không audit sâu theo quy tắc.
SECRET/CREDENTIAL: VidZeeData.tmdbKey (TMDB v3 key) — tồn tại, lộ plaintext, không trích xuất. Nonce WP eb2e52aeac cũng nằm trong config (public-by-design của WordPress, không phải secret).
Response JSON structure (chuẩn TMDB, đã đối chiếu với code render của frontend)
jsonc
Copy
// trending/*, discover/*, search/*
{ "page": 1, "results": [{ "id": 533535, "title": "...",        // hoặc "name" với TV
    "overview": "...", "poster_path": "/x.jpg", "backdrop_path": "/y.jpg",
    "release_date": "2022-06-01",                                 // hoặc "first_air_date"
    "vote_average": 7.0, "media_type": "movie" }],                // có ở trending/search-multi
  "total_pages": 500, "total_results": 9999 }

// movie/{id}?append_to_response=...
{ "id": 533535, "title": "...", "runtime": 160, "genres": [{"id":28,"name":"Action"}],
  "credits": { "cast": [{ "name": "...", "character": "...", "profile_path": "..." }] },
  "videos": { "results": [{ "key": "YouTube-key", "site": "YouTube", "type": "Trailer" }] },   // → youtube.com/embed/{key}
  "recommendations": { "results": [ /* giống results[] */ ] } }

// tv/{id}/season/{n}
{ "episodes": [{ "episode_number": 1, "name": "...", "overview": "...",
    "air_date": "...", "still_path": "...", "runtime": 62 }] }
Thiếu/không đúng api_key → HTTP 401: { "status_code": 7, "status_message": "Invalid API key: You must be granted a valid key.", "success": false } (đã test).

Ví dụ request để kiểm thử
bash
Copy
# Thay <TMDB_V3_KEY> bằng key của bạn (miễn phí) — KHÔNG dùng key leaked của site
# 1) Trending movies (rail trang chủ)
curl "https://api.themoviedb.org/3/trending/movie/week?api_key=<TMDB_V3_KEY>&language=en-US"

# 2) Chi tiết phim + credits + trailer + recommendations (1 call duy nhất)
curl "https://api.themoviedb.org/3/movie/533535?api_key=<TMDB_V3_KEY>&language=en-US&append_to_response=credits,videos,recommendations"

# 3) Listing có filter — tương đương vidsrc.sbs/movies/?genre=28&sort=popularity.desc&year=2024&p=1
curl "https://api.themoviedb.org/3/discover/movie?api_key=<TMDB_V3_KEY>&language=en-US&sort_by=popularity.desc&with_genres=28&page=1"

# 4) Episode list — tương đương nút chọn season trên trang chi tiết
curl "https://api.themoviedb.org/3/tv/1399/season/1?api_key=<TMDB_V3_KEY>&language=en-US"

# 5) Search multi (lọc bỏ media_type === 'person' như frontend đang làm)
curl "https://api.themoviedb.org/3/search/multi?api_key=<TMDB_V3_KEY>&language=en-US&query=dune&page=1"

# 6) Player route của chính site (HTML, không cần key) — parse object CFG trong source
curl -A "Mozilla/5.0" "https://vidsrc.sbs/embed/movie/533535/"
Headers cần thiết: chỉ User-Agent thông thường — không header auth nào, api_key đặt trong query string, TMDB cho phép CORS từ mọi origin.

🎯 3 Endpoint khuyến nghị cho movie catalog
GET /discover/movie (+ /discover/tv) — xương sống catalog: sort/genre/year/rating + phân trang chuẩn TMDB (20 item/trang). Lưu ý frontend của site gộp 2 trang TMDB mỗi trang hiển thị (p → pages 2p-1, 2p = 40 item/trang); bạn có thể làm y hệt để tăng density.
GET /movie/{id}?append_to_response=credits,videos,recommendations — 1 request thay vì 4: metadata đầy đủ + cast + YouTube trailer key + gợi ý liên quan (nguồn cho hàng "Similar" trong UI).
GET /search/multi + GET /tv/{id}/season/{n} — search đa loại cho thanh tìm kiếm live (debounce ~300ms như frontend), và episodes grid cho trang chi tiết TV.
Cách nối vào playback: tmdb_id là khóa nối duy nhất — lấy metadata từ TMDB, rồi đưa ID vào iframe player: 
https://player.videasy.net/movie/{tmdb_id}
 hoặc route của chính site 
https://vidsrc.sbs/embed/movie/{tmdb_id}/{season}/{episode}
 (các URL template này nằm trong VidZeeData.servers[], đọc trực tiếp từ page source — đây chính xác là cách frontend dựng player, không qua API trung gian nào).