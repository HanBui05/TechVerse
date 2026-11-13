# Course free — Wireframe cổng trước Task 2a

Trạng thái: **người dùng đã duyệt 2026-11-09** (kết luận cuối file). Nguồn chuẩn: `course-free.md` (spec) + contract thật ở `course-free.log.md` và DTO Task 1a–1c; nền phong cách `article-flow.wireframe.md` (mục “Phong cách”), `docs/design/UI_GUIDE.md`, mẫu JavaBuilder `.playwright-mcp/jb-course.png`, `jb-lesson.png`. File chỉ chốt bố cục, luồng và trạng thái; mọi nút/số liệu có endpoint ở Task 1b/1c, không thêm chức năng.

Ký hiệu như `article-flow.wireframe.md`: `[Nút]` · `(Badge)` · `▾` select/menu · `⋯` menu phụ · `▓` Skeleton · `⟳` thử lại · `🔒` bài chưa mở · `✓` đã hoàn thành · `▶` bài có video · `≡` bài chỉ nội dung. Icon thật là `lucide-react`, không emoji. Desktop 1440, mobile 390.

**Ngoài màn (không vẽ, không làm):** giá/VND, “Lưu/Yêu thích khóa”, “Hỏi AI”, “Ghi chú”, đánh giá, thời lượng/phút đọc của khóa hay bài (API không trả), popup quảng cáo như ảnh mẫu.

## 0. Phong cách và theme

- **Reader (`/courses`, `/courses/:id`, trang học, `/me/courses`):** bám JB như ảnh mẫu (chip info màu, accordion chương, cột curriculum trái có “Đã học x/y bài”, TOC phải “Mục lục bài học”), dùng chung card/chip/tone của Reader article. Màu nhấn = `primary`/`accent-text` của TechVerse (không lấy cam JB). Mục đang mở: nền `tone-blue-bg` + chữ `accent-text`.
- **Author/Moderator:** cùng ngôn ngữ đã duyệt ở article-flow (ô số liệu `statusTone`, hàng có viền trái theo trạng thái cần chú ý, banner tone, nhãn trường 11 px in hoa, timeline lịch sử chấm màu).
- **Dark mặc định, light chọn được:** chỉ token/Badge tone, không literal màu, không gradient; khung video nền `muted` khi chưa tải; ảnh bìa thiếu → ô fallback tone `toneFor(topic)` + icon topic (như card bài viết). Kiểm mắt cả hai theme cho mọi màn dưới.
- Chuyển động (accordion, sheet, nhấc card) tắt khi `prefers-reduced-motion`. Vùng bấm ≥ 44 px trên cảm ứng, focus ring `ring`, contrast ≥ 4.5:1.

## 1. Route, menu và quyền

| Route | Ai vào | Ghi chú |
|---|---|---|
| `/courses`, `/courses/:id`, `/courses/:courseId/lessons/:lessonId` | Guest + tài khoản không có `ADMIN`/`MODERATOR` | **Không bọc `AuthRoute`** (khác `/blogs`). Manager bị chuyển về `/admin` hoặc `/moderator` như Reader article, không gọi API học. |
| `/me/courses` | Đăng nhập, không phải manager | Guest → login kèm return URL. |
| `/author/courses`, `/author/courses/new`, `/author/courses/:id/edit` | `AUTHOR` | Như `/author/blogs`. |
| `/moderator/courses`, `/moderator/courses/:id` | `MODERATOR` (ADMIN chỉ khi có thêm MODERATOR) | |

```
Sidebar User (đăng nhập)          Sidebar Guest (như hiện có)   Sidebar Moderator
CHÍNH                             CHÍNH                         ...
  Trang chủ                         Trang chủ                     Bài viết
  Bài viết                          Bài viết                      Khóa học        ← mới
  Khóa học            ← mới         Khóa học        ← mới
GÓC CỦA TÔI
  Bài đã lưu
  Khóa học của tôi    ← mới
TÁC GIẢ ▾             ← nhóm thu gọn (chỉ AUTHOR)
  Bài viết của tôi    (/author/blogs, giữ nguyên)
  Khóa học            (/author/courses)
```

- Learner chưa là Author: mục “Tác giả” vẫn là link đơn tới `/author/apply` như hiện tại. Nhóm “Tác giả” mở sẵn khi route hiện tại thuộc `/author/*`. Không thêm “Doanh thu”.
- Guest: `/` đã mở công khai và Sidebar hiện render với `authenticated=false`; chỉ thêm “Khóa học” vào `navItems`. Guest mở route khác ngoài `/`, `/courses*` vẫn bị chuyển `/login` như hiện tại.

---

## 2. Reader

### 2c-1 Danh mục `/courses` — desktop

```
┌ Sidebar ┬──────────────────────────────────────────────────────────────────────┐
│         │ (🎓 Học miễn phí)                                                     │
│         │ Khóa học                                     [▶ Khóa học của tôi]     │
│         │ Lộ trình có chương và bài học, học thử trước khi bắt đầu.             │
│         │ ┌ ⚲ Bộ lọc ─────────────────────────────────────────── (12 khóa) ┐   │
│         │ │ [⚲ Tìm khóa học… ⏎      ✕] [Thẻ ▾] [Trình độ ▾] [Mới nhất ▾]  │   │
│         │ │ (Tất cả)(Java)(Spring)(React)(…)   ← chip topic nhanh           │   │
│         │ └─────────────────────────────────────────────────────────────────┘   │
│         │ ┌ card ───────────┐ ┌ card ───────────┐ ┌ card ───────────┐         │
│         │ │ ▢ cover 16:10   │ │ ▢ fallback tone │ │                 │         │
│         │ │   (Cơ bản)      │ │   + icon topic  │ │                 │         │
│         │ │ (Java)(t1)(t2)+2│ │                 │ │                 │         │
│         │ │ Tiêu đề 2 dòng… │ │                 │ │                 │         │
│         │ │ Mô tả ngắn 2 dòng│ │                │ │                 │         │
│         │ │ Cập nhật 26/06  [Xem khóa học ›]   │ │                 │         │
│         │ │ (av) Trần B  Tác giả               │ │                 │         │
│         │ └─────────────────┘ └─────────────────┘ └─────────────────┘         │
│         │                       ‹ 1 2 3 ›                                      │
└─────────┴──────────────────────────────────────────────────────────────────────┘
```

- Filter = `keyword`, `topicId` (chip), `tagId`, `level`, `sort=NEWEST|OLDEST`; đồng bộ URL như `/blogs`, `size=9` (grid 3/2/1). Card dùng khung `ArticleCard` (cover/fallback, chip trình độ nổi trên ảnh tone theo cấp: Cơ bản green, Trung cấp amber, Nâng cao rose); **không** số chương/bài (list không trả). “Cập nhật” = `updatedAt`.
- [Khóa học của tôi] chỉ khi đăng nhập; Guest không thấy. Cả card là link tới `/courses/:id`.
- **Mobile:** 1 cột; chip topic cuộn ngang trong card lọc; select xếp dọc; [Khóa học của tôi] thành nút icon cạnh H1.
- Loading 9 card `▓`. Empty “Chưa có khóa học nào” / có filter: “Không tìm thấy khóa học phù hợp” + [Xóa bộ lọc]. Error + [⟳ Thử lại].
- Focus: H1 → ô tìm → Thẻ → Trình độ → Sắp xếp → chip topic → card lần lượt → phân trang.

### 2c-2 Khung học (dùng chung overview và trang bài) — desktop

Overview và trang bài **không dùng Sidebar app**; dùng khung học toàn màn như ảnh mẫu, có thanh trên riêng:

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ [‹ Khóa học]  │ ▢ Tên khóa học (1 dòng, cắt …)          (✓ 22/46 · 48%)  [◐ theme]│
├─ cột curriculum 320 ─────┬─ nội dung ───────────────────────────┬─ TOC 280 (chỉ trang bài)
│ [⚲ Tìm bài học…      ✕] │                                      │
│ ▣ Tổng quan khóa học     │                                      │
│ ── ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │                                      │
│ 1. Tên chương        ▴   │                                      │
│    Đã học 0/3 bài        │                                      │
│    ○ 1. Bài một   (Học thử)                                     │
│    ✓ 2. Bài hai      ▶   │                                      │
│    🔒 3. Bài ba          │                                      │
│ 2. Tên chương        ▾   │                                      │
│    Đã học 2/7 bài        │                                      │
│ [« Thu gọn]              │                                      │
└──────────────────────────┴──────────────────────────────────────┴──────────────
```

- Thanh trên dính đầu trang: nút về `/courses`, tên khóa, chip tiến độ `x/y (p%)` tone green **chỉ khi đã enroll**, nút đổi theme (hiện có). Không có nút Yêu thích.
- Cột curriculum cuộn riêng; chương là accordion (mặc định mở chương chứa bài đang xem, overview: mở chương 1). Dòng phụ “Đã học x/y bài” chỉ khi enroll (`learning.chapters`).
- Icon trạng thái mỗi bài: `✓` đã xong (`completedLessonIds`) · `○` mở được · `🔒` chưa mở được (chưa enroll + không preview). Icon loại bài `▶` khi `hasVideo`. Badge “Học thử” khi `preview` và người xem chưa enroll.
- Tìm bài học: lọc client theo tiêu đề trên cây đã tải, mở mọi chương có kết quả, rỗng → “Không có bài khớp”. Không gọi API.
- [« Thu gọn] ẩn cột curriculum (nội dung rộng ra), còn nút `☰` ở thanh trên để mở lại; trạng thái nhớ trong `localStorage`.
- `xl` (≥1280) mới có cột TOC; `lg–xl` TOC thành khối “Mục lục ▾” dưới tiêu đề bài.

**Bấm một bài trong cây (`viewer` + `preview`):**

| Người xem | Bài preview | Bài thường |
|---|---|---|
| Guest | mở bài | Dialog “Đăng nhập để bắt đầu khóa học.” [Hủy] [Đăng nhập] → login, return URL = bài đó |
| Đăng nhập, `canStart`, chưa enroll | mở bài (không tạo enrollment) | gọi `POST /start` một lần → mở bài (lỗi: giữ nguyên trang, Alert copy theo mã) |
| Đã enroll | mở bài | mở bài |
| Chủ khóa (`canStart=false`) | mở bài | khóa `🔒`, tooltip + dòng phụ cố định “Bạn là tác giả khóa này — chỉ xem bài học thử.” |

### 2c-3 Overview `/courses/:id` — desktop

```
│ curriculum (như 2c-2) │ Khóa học › Tên khóa                                        │
│ ▣ Tổng quan khóa học ◀│ ┌ info card bo 18 ───────────────────────────────────────┐ │
│                       │ │ (Nâng cao)(▤ 8 chương)(▣ 46 bài học)(📅 Cập nhật 26/06)│ │
│                       │ │ (Java)(Spring AI)(+2)                                  │ │
│                       │ │ Tên khóa học (H1 30)                                   │ │
│                       │ │ Mô tả ngắn (summary) 16 muted, tối đa ~3 dòng          │ │
│                       │ │ (av) Trần B · Tác giả              [Bắt đầu học]       │ │
│                       │ │                       hoặc [Tiếp tục học: Bài 5 ›]     │ │
│                       │ │                    + thanh tiến độ 48% (khi enroll)    │ │
│                       │ └────────────────────────────────────────────────────────┘ │
│                       │ ▢ ảnh bìa 16:9 bo 18 (ẩn nếu không có)                     │
│                       │ Giới thiệu khóa học (H2) — MarkdownContent(description)    │
│                       │ Nội dung khóa học (8 chương · 46 bài)      [Mở rộng tất cả]│
│                       │ ┌ CHƯƠNG 1 · Tên chương ───── Đã học 1/3 ── ▴ ┐            │
│                       │ │ ≡ 1. Bài một          (Học thử) [Học thử ›] │            │
│                       │ │ ▶ 2. Bài hai              ✓                 │            │
│                       │ │ 🔒 3. Bài ba                                │            │
│                       │ ├ CHƯƠNG 2 · … ─────────────────────────── ▾ ┤            │
│                       │ └─────────────────────────────────────────────┘            │
```

- CTA theo `viewer`: chưa enroll → [Bắt đầu học] (Guest → login + return URL `/courses/:id`; đăng nhập → `POST /start` rồi mở `continueLesson` trả về); đã enroll → [Tiếp tục học] mở `learning.continueLesson`; chủ khóa → không CTA, dòng “Bạn là tác giả khóa này — chỉ xem bài học thử.” Có bài preview → thêm nút phụ [Học thử] mở bài preview đầu tiên (Guest cũng thấy).
- Info card dùng `level`, `chapterCount`, `lessonCount`, `updatedAt`, topic/tag, `author`. Không hiện ngày xuất bản riêng. Summary lesson (nếu có) hiện một dòng muted dưới tên bài trong accordion; trống thì ẩn.
- [Mở rộng tất cả] ⇄ [Thu gọn tất cả]. Accordion `aria-expanded`, Enter/Space.
- Focus: [‹ Khóa học] → ô tìm → cây → CTA chính → [Học thử] → [Mở rộng tất cả] → accordion.

### 2c-4 Trang bài `/courses/:courseId/lessons/:lessonId` — desktop

```
│ curriculum (bài đang xem ◀ nền tone-blue) │ Khóa học › Tên khóa › Chương 1 › Bài 1 │ ┌ MỤC LỤC BÀI HỌC ┐
│                                           │ Tên bài học (H1 30)       (Học thử)    │ │ 1. Mở đầu  ◀    │
│                                           │ Tóm tắt bài (summary, muted, nếu có)   │ │ 2. Cài đặt      │
│                                           │ ┌ video 16:9 bo 18 ──────────────────┐ │ │   2.1 Bước 1    │
│                                           │ │ iframe youtube-nocookie.com/embed/id│ │ │ 3. Tóm tắt      │
│                                           │ └─────────────────────────────────────┘ │ └ sticky, cuộn riêng ┘
│                                           │ MarkdownContent(content) 16 px          │
│                                           │ ─────────────────────────────────────── │
│                                           │ [✓ Hoàn thành bài học]  (khi enroll)    │
│                                           │ [‹ Bài trước: tên]   [Bài tiếp theo: tên ›] │
```

- Thứ tự khối: video (nếu `video`) trước, Markdown sau; bài chỉ video thì không có TOC (ẩn cột, nội dung rộng ra). Iframe: `src` ghép từ `provider=YOUTUBE` + `videoId`, có `title="Video: <tên bài>"`, `referrerpolicy`, `allow` tối thiểu, `allowfullscreen`; không link mở YouTube.
- [Hoàn thành bài học] ⇄ [✓ Đã hoàn thành · Đánh dấu chưa hoàn thành] (PUT/DELETE); đang gửi thì khóa nút; lỗi → giữ trạng thái server gần nhất + dòng lỗi dưới nút; thành công cập nhật chip tiến độ, `✓` trong cây, “Đã học x/y” (live region đọc “Đã hoàn thành, 23/46 bài”). Không tự chuyển bài.
- Bài trước/tiếp theo tính từ cây (qua ranh giới chương); bài kế tiếp bị khóa với người xem thì nút áp dụng đúng bảng ở 2c-2. Không có trước/tiếp thì ẩn nút đó.
- Preview chưa enroll: badge “Học thử” + khối gợi ý cuối bài “Bắt đầu khóa học để học tiếp và lưu tiến độ.” [Bắt đầu học] (Guest: [Đăng nhập]); không nút hoàn thành.
- Mở URL bài thường khi chưa được phép (`403 LESSON_PREVIEW_ONLY`): vùng nội dung thay bằng card khóa `🔒` “Hãy đăng nhập và bắt đầu khóa học để xem bài này.” + CTA như trên; cây vẫn hiện (lấy từ overview).
- Không có hàng meta phút đọc/ngày cập nhật cho bài (API không trả).
- Focus: [‹ Khóa học] → cây → H1 → video → nội dung → [Hoàn thành] → [Bài trước] → [Bài tiếp theo] → TOC. Có link “Bỏ qua tới nội dung bài” đầu trang.

### 2c-5 Khung học — mobile 390

```
┌──────────────────────────────┐   Sheet trái “Nội dung khóa học” (85% rộng)
│ [‹] Tên khóa…  (48%) [☰]     │   ┌───────────────────────┐
├──────────────────────────────┤   │ ✕  22/46 bài · 48%    │
│ Chương 1 › Bài 1             │   │ [⚲ Tìm bài học…]      │
│ Tên bài học (H1 24)          │   │ ▣ Tổng quan khóa học  │
│ (Học thử)                    │   │ 1. Chương ▴ 0/3       │
│ ┌ video 16:9 full width ┐    │   │   ○ Bài một (Học thử) │
│ └───────────────────────┘    │   │   🔒 Bài ba           │
│ [Mục lục ▾]                  │   └───────────────────────┘
│ nội dung Markdown…           │
├──────────────────────────────┤
│ [‹]   [✓ Hoàn thành]   [›]   │  ← thanh dính đáy, cao 44 (chỉ trang bài)
└──────────────────────────────┘
```

- [☰] mở Sheet curriculum (focus vào ô tìm, Esc/✕ đóng và trả focus về [☰]; chọn bài thì đóng Sheet). Không có scroll lồng ngoài Sheet.
- Thanh đáy: [‹]/[›] có `aria-label` “Bài trước/Bài tiếp theo: <tên>”; nút giữa là hoàn thành khi enroll, [Bắt đầu học] khi chưa. Nội dung có `padding-bottom` bằng chiều cao thanh để không bị che.
- Overview mobile: info card → CTA full width → mô tả → accordion; không có thanh đáy.
- Code/bảng trong Markdown cuộn trong khung, trang không cuộn ngang.

### 2c-6 Trạng thái khung học

- Loading: thanh trên `▓`, cây 6 dòng `▓`, H1 + video 16:9 + 8 dòng `▓`.
- 404 khóa/bài (`COURSE_NOT_FOUND`, `LESSON_NOT_FOUND`): `EmptyState` “Không tìm thấy khóa học hoặc bài học.” + [Về danh sách khóa học] (không phân biệt ẩn/gỡ).
- Lỗi mạng/5xx: card lỗi + [⟳ Thử lại]. `POST /start` lỗi: Alert trên CTA, copy theo mã (`ACCESS_DENIED` “Không thể bắt đầu khóa học này.”), không retry tự động.
- Completion `409 COURSE_ENROLLMENT_REQUIRED` (khóa bị đổi giữa chừng): “Hãy bắt đầu khóa học trước.” + tải lại overview.

### 2c-7 Khóa học của tôi `/me/courses`

```
┌ Sidebar ┬──────────────────────────────────────────────────────────────────────┐
│         │ (▶ Góc của tôi)                                                       │
│         │ Khóa học của tôi  (3 khóa)                       [‹ Tất cả khóa học]  │
│         │ ┌ hàng/card ─────────────────────────────────────────────────────┐   │
│         │ │ ▢cover 120×75  Tên khóa (2 dòng)              (Cơ bản)(Java)   │   │
│         │ │                ━━━━━━━━━━━━━━━━━━━━━━░░░░  22/46 bài · 48%      │   │
│         │ │                Tiếp theo: Bài 5 · Hoạt động 2 giờ trước         │   │
│         │ │                                         [Tiếp tục học ›]        │   │
│         │ ├────────────────────────────────────────────────────────────────┤   │
│         │ │ ▢  Khóa xong 100%  (✓ Hoàn thành) ━━━━━━━━━━  10/10 · 100%      │   │
│         │ │                                         [Xem lại khóa học ›]    │   │
│         │ └────────────────────────────────────────────────────────────────┘   │
│         │                         ‹ 1 2 ›                                      │
└─────────┴──────────────────────────────────────────────────────────────────────┘
```

- Thứ tự do backend (`lastAccessedAt` rồi `grantedAt`), không có sort/lọc. “Hoạt động <tương đối>” = `lastAccessedAt`, chưa mở bài nào thì “Bắt đầu <grantedAt>”.
- [Tiếp tục học] mở `continueLesson`; 100% → nhãn (✓ Hoàn thành) và nút [Xem lại khóa học] mở overview. Progress bar `role=progressbar` có `aria-valuenow`.
- **Mobile:** ảnh ẩn, hàng xếp dọc, nút full width cao 44.
- Loading 3 hàng `▓`. Empty: icon, “Bạn chưa bắt đầu khóa học nào” + [Khám phá khóa học] → `/courses`. Error + [⟳].

---

## 3. Author (Task 2a)

### Ma trận hành động Author

Giống ma trận article-flow (cùng `workflowStatus` × `publicationStatus`, `AlertDialog` cho hành động nguy hiểm), đổi chữ “bài” → “khóa học”: Sửa/Xem · Rút lại · Hủy bản sửa (“Nội dung quay về bản công khai vN”) · Ẩn/Hiện lại · Xóa (hard khi chưa từng duyệt / soft khi đã công khai) · Lịch sử · Xem bản công khai (mở `/courses/:id` tab mới).

### 3a-1 Workspace `/author/courses` — desktop

Giữ y bố cục 2a-1 của article (header kicker “Không gian tác giả”, 5 ô số liệu bấm được = filter, card lọc search/Chủ đề/Thẻ/Sắp xếp + 2 hàng chip workflow/publication, danh sách hàng). Khác biệt:

```
│ Khóa học của tôi                                    [+ Tạo khóa học]       │
│ ┌ hàng ──────────────────────────────────────────────────────────────┐   │
│ │ ▢cover  Tên khóa học 2 dòng…                                         │   │
│ │ 64×40   (Java)(Trung cấp) · Sửa 2 giờ trước · Công khai 03/11        │   │
│ │         (Đang công khai)(Bản nháp)(● Có thay đổi chưa xuất bản)      │   │
│ │                                               [Sửa]  [⋯]             │   │
│ └──────────────────────────────────────────────────────────────────────┘   │
```

- Hàng không hiện số chương/bài (list không trả). Empty: icon `GraduationCap` + dải chip “Soạn khóa → Thêm chương/bài → Gửi duyệt” + [Tạo khóa học đầu tiên]. Loading/empty filter/error/mobile như article 2a-1.

### 3a-2 Tạo khóa `/author/courses/new`

```
│ ‹ Khóa học của tôi                                                         │
│ Tạo khóa học                                                               │
│ ┌ Thông tin khóa học ──────────────────────────────────────────────────┐   │
│ │ TIÊU ĐỀ*  [_______________________________________________]          │   │
│ │ CHỦ ĐỀ* [Java ▾]   TRÌNH ĐỘ [Cơ bản ▾]   THẺ (0/10) [TagPicker……]    │   │
│ │ MÔ TẢ NGẮN [textarea 2 dòng………………………………] 0/500                     │   │
│ │ ⓘ Ảnh bìa, mô tả chi tiết và chương/bài thêm sau khi tạo.            │   │
│ │                                                    [Tạo khóa học]    │   │
│ └──────────────────────────────────────────────────────────────────────┘   │
```

- `POST` với `action=SAVE` + `Idempotency-Key` sinh một lần cho lần nhấn (retry cùng key); xong chuyển sang `/author/courses/:id/edit`. Bắt buộc tiêu đề + chủ đề; lỗi trường dưới ô.

### 3a-3 Editor `/author/courses/:id/edit` — desktop

```
┌ Sidebar ┬──────────────────────────────────────────────────────────────────────┐
│         │ ‹ Khóa học của tôi                                                   │
│         │ Tên khóa học  (Đang công khai v2)(Bản nháp)  Đã lưu 10:42 [Học thử][Gửi duyệt][⋯]│
│         │ ┌ banner trạng thái (tối đa 1, như article) ──────────────────────┐  │
│         │ └─────────────────────────────────────────────────────────────────┘  │
│         │ ┌ Cấu trúc 320 ─────────────┐ ┌ vùng soạn (theo mục đang chọn) ────┐│
│         │ │ ▣ Thông tin khóa học   ◀  │ │                                     ││
│         │ │ ─────────────────────────│ │  (3a-4 / 3a-5 / 3a-6)               ││
│         │ │ CHƯƠNG 1  Tên chương [⋯] │ │                                     ││
│         │ │   ≡ Bài một (Học thử)    │ │                                     ││
│         │ │   ▶ Bài hai (✦AI) (Mới)  │ │                                     ││
│         │ │   [+ Thêm bài]           │ │                                     ││
│         │ │ CHƯƠNG 2  …          [⋯] │ │                                     ││
│         │ │ [+ Thêm chương]          │ │                                     ││
│         │ │ 2 chương · 5 bài         │ │                                     ││
│         │ └──────────────────────────┘ └─────────────────────────────────────┘│
└─────────┴──────────────────────────────────────────────────────────────────────┘
```

- Mục đang chọn ghi vào query `?lesson=<id>` / `?chapter=<id>` (không có = Thông tin khóa học) để F5/link giữ chỗ; không thêm route.
- Cây: mỗi bài có icon loại (`▶`/`≡`), badge “Học thử”, “✦ AI” (`aiAssisted`); khóa đã từng công khai thì bài/chương chưa có trong `publishedVersion` gắn (Mới). `⋯` của chương: Đổi tên · Lên · Xuống · Xóa; `⋯` của bài: Lên · Xuống · Xóa. **Đổi thứ tự bằng nút Lên/Xuống (bàn phím được), không kéo-thả**; mỗi lần gọi `PUT …:reorder` với đủ ID, khóa cây khi đang gửi, lỗi `COURSE_ORDER_INVALID` → tải lại cây + Alert.
- Xóa chương/bài: `AlertDialog` — khóa chưa công khai “Xóa vĩnh viễn”; đã công khai “Gỡ khỏi bản sửa; độc giả vẫn thấy tới khi bản mới được duyệt, tiến độ học viên được giữ”.
- [Học thử] mở `/courses/:id` tab mới, chỉ khi đã có bản công khai (owner chỉ xem bài preview — theo quyền backend). [Gửi duyệt] gửi `PATCH action=SUBMIT`; lỗi `COURSE_NOT_READY` → Alert “Khóa học chưa đủ điều kiện gửi duyệt.” + danh sách việc thiếu tính được ở client (chưa có chương, chương rỗng, thiếu mô tả ngắn/mô tả, còn N ảnh cần tải lên) mỗi dòng là link chọn mục trong cây.
- `PENDING`: toàn editor chỉ đọc, banner amber “Đang chờ duyệt — rút lại để tiếp tục sửa” + [Rút lại]. `REMOVED`: chỉ đọc. Banner yêu cầu sửa hiện `moderationNote`.
- Rời trang/chọn mục khác khi còn thay đổi chưa lưu: lưu tự động trước (autosave), lỗi lưu thì `AlertDialog` “Thay đổi chưa lưu sẽ mất” [Ở lại][Rời đi].

### 3a-4 Vùng soạn: Thông tin khóa học

Như card “Thông tin bài” + editor 2 cột của article: TIÊU ĐỀ · CHỦ ĐỀ · TRÌNH ĐỘ · THẺ · MÔ TẢ NGẮN (0/500) · ẢNH BÌA [Tải ảnh bìa][Bỏ] · “Mô tả chi tiết” = Markdown trái [Nhập .md/.txt][Chèn ảnh] + [Xem trước | Bản công khai vN] phải (preview theo composition overview 2c-3). Khối “⚠ N ảnh cần tải lên” y article (`imageIssues`). Autosave `PATCH action=SAVE` như editor bài viết.

### 3a-5 Vùng soạn: Chương

Chỉ ô TÊN CHƯƠNG + [Lưu] (Enter để lưu) và danh sách bài của chương (link chọn) + [+ Thêm bài]. Không có mô tả chương (API không có).

### 3a-6 Vùng soạn: Bài học

```
│ ┌ Bài học · Chương 1 ───────────────────────── (Đã sửa so với v2) ─┐ │
│ │ TIÊU ĐỀ* [__________________________________]                     │ │
│ │ TÓM TẮT  [textarea 2 dòng…] 0/500 (tùy chọn)                      │ │
│ │ [☐ Cho học thử] ⓘ Ai cũng xem được bài này, kể cả khách.          │ │
│ │ VIDEO YOUTUBE [https://youtu.be/…_____________] [Bỏ video]        │ │
│ │   ⓘ Tải video lên kênh của bạn ở chế độ Không công khai rồi dán link.│
│ │   ┌ khung xem trước 16:9 (nocookie) khi link hợp lệ ┐              │ │
│ │ NỘI DUNG  [Nhập .md/.txt][Chèn ảnh][✦ Soạn bằng AI]               │ │
│ │ ┌ Markdown ───────────────┐┌ [Xem trước | Bản công khai v2] ┐    │ │
│ │ └─────────────────────────┘└───────────────────────────────┘    │ │
│ │ ⚠ Bài học phải có video hoặc nội dung.   (khi cả hai trống)        │ │
│ └───────────────────────────────────────────────────────────────────┘ │
```

- Bài mới (chưa có ID): lần lưu đầu `POST` + `Idempotency-Key`; cần tiêu đề + (video hoặc nội dung). [Chèn ảnh] khóa với dòng “Lưu bài trước khi chèn ảnh” tới khi có ID (như article). Bài đã có: autosave `PATCH`.
- Video: client chỉ kiểm sơ bộ để hiện khung xem trước (ID 11 ký tự từ các dạng link spec cho phép); server là nguồn cuối, lỗi `LESSON_VIDEO_INVALID` “Liên kết YouTube không hợp lệ.” dưới ô. Response chỉ có `video{provider,videoId}` → ô hiện lại dạng `https://youtu.be/<id>`.
- Tab “Bản công khai vN” chỉ khi bài có trong `publishedVersion` (đọc `GET lesson?versionId=`).

### 3a-7 AI soạn bài học (Sheet)

[✦ Soạn bằng AI] mở **Sheet phải rộng ~720 px** (mobile: toàn màn hình) dùng lại nguyên luồng/trạng thái của `ai-assist.wireframe.md` mục 2–3 (form → dàn ý chỉnh/sắp xếp → stream + [Dừng] → completed/error/retry, quota còn lại), khác:

- Form chỉ có Tiêu đề + Tóm tắt (điền sẵn từ bài đang soạn) + ghi chú “Dùng chủ đề và thẻ của khóa học”; không chọn topic/tag; `targetType=LESSON`, `courseId`.
- Nút cuối: [Dùng bản nháp này cho bài học] → điền tiêu đề/tóm tắt/nội dung vào form bài, đóng Sheet, lần lưu kế tiếp gửi `aiGenerationId`. Nội dung đang có bị thay → `AlertDialog` xác nhận trước. Hash lệch / `AI_GENERATION_INVALID` → “Bản nháp AI không còn hợp lệ. Hãy tạo lại.”
- Phiên AI khôi phục sau F5 theo khóa `courseId + lessonId|new` giống AI article; đóng Sheet giữa stream = Dừng.

### 3a-8 Editor — mobile 390

```
┌──────────────────────────────┐
│ ‹ Khóa học               [⋯] │
│ Tên khóa (Đang CK)(Nháp)     │
│ ⓘ banner trạng thái          │
│ [☰ Cấu trúc: Bài hai ▾]      │  ← mở Sheet đáy chứa cây (Lên/Xuống/Thêm/Xóa)
│ [ Soạn thảo | Xem trước ]    │
│ form mục đang chọn (1 cột)   │
├──────────────────────────────┤
│ Đã lưu 10:42     [Gửi duyệt] │  ← thanh dính đáy, cao 44
└──────────────────────────────┘
```

Loading/404/lỗi/import lỗi/lịch sử (Sheet) như article 2a-4, 2a-5 với chữ “khóa học”.

---

## 4. Moderator (Task 2b)

### 4b-1 List `/moderator/courses`

Như list article 2b-1: 5 ô số liệu (Chờ duyệt · Cần sửa · Đang công khai · Bị ẩn · Đã gỡ), card lọc (tiêu đề, chủ đề, thẻ, sắp xếp, chip 2 trục), mặc định “Chờ duyệt”. Hàng: (av) tác giả · tên khóa · (topic)(trình độ) · thời gian · badge 2 trục · (Bản cập nhật) khi đã có bản công khai · “⚠ Tác giả không còn đủ điều kiện” khi `!authorEligible`. Không có giá/doanh thu. Loading/empty/error/mobile như 2b-1.

### 4b-2 Detail `/moderator/courses/:id` — desktop

```
┌ Sidebar ┬──────────────────────────────────────────────────────────────────────┐
│         │ Moderator › Khóa học › Tên khóa…                                     │
│         │ Tên khóa (H1 24)  (Đang công khai v2)(Chờ duyệt) · (av) Trần B ✓     │
│         │                       [Yêu cầu sửa] [Duyệt khóa]  [Ẩn] [Gỡ]  (theo trạng thái)│
│         │ ┌ Thay đổi ── [Chỉ phần thay đổi | Xem tất cả] ┐ ┌ so sánh mục đang chọn ──────┐│
│         │ │ ▣ Thông tin khóa học (Đã sửa)                 │ │ Bản công khai v2 │ Bản đề xuất ││
│         │ │ CHƯƠNG 1 Tên (Đã sửa)                         │ │ (như 2b-2 article: từng      ││
│         │ │   ▶ Bài hai (Mới)                             │ │  trường, “Đã đổi” amber;     ││
│         │ │   ≡ Bài ba (Đã sửa)                           │ │  bài: tiêu đề/tóm tắt/học    ││
│         │ │   ≡ Bài cũ (Đã gỡ)  gạch ngang                │ │  thử/video/Markdown)         ││
│         │ │ CHƯƠNG 3 Tên (Mới)                            │ │                              ││
│         │ └──────────────────────────────────────────────┘ └──────────────────────────────┘│
│         │ ┌ Tác giả ──────┐ ┌ Lịch sử (5 mới nhất) ───────────── [Xem tất cả] ┐          │
└─────────┴──────────────────────────────────────────────────────────────────────┘
```

- Cây lấy `changes`; mặc định “Chỉ phần thay đổi” (ẩn `UNCHANGED`, chương giữ lại nếu có bài đổi); “Xem tất cả” hiện cả `UNCHANGED` không nhãn. Nhãn: (Mới/New) green, (Đã sửa/Changed) amber, (Đã gỡ/Archived) rose + gạch ngang — có chữ, không chỉ màu. “Thông tin khóa học (Đã sửa)” khi metadata khác version (so ở client như article).
- Chọn bài: `NEW` → chỉ cột “Bản đề xuất”; `ARCHIVED` → chỉ cột “Bản công khai vN” (`versionId`); `CHANGED/UNCHANGED` → hai cột. Video so bằng `videoId` (hiện khung nocookie mỗi cột). Khóa chưa từng công khai: mọi mục (Mới), chỉ một cột rộng.
- Action/dialog/stale y article 2b-2, 2b-3; copy: “Duyệt khóa” · “Yêu cầu sửa” · stale “Khóa học đã thay đổi. Hãy tải lại trước khi duyệt.” + [Tải lại]. Không retry mutation tự động; nút khóa khi đang gửi. Tác giả không đủ điều kiện → [Duyệt khóa] khóa + lý do.
- **Mobile:** cây ở trên (accordion), chọn mục → so sánh một cột theo segmented [Đề xuất | Công khai]; action dính đáy (tối đa 2 nút + `⋯`).
- Loading/404/error như 2b-2.

---

## 5. Copy chính vi/en (bổ sung bảng trong spec)

| vi | en |
|---|---|
| Học miễn phí | Free learning |
| Khóa học / Khóa học của tôi | Courses / My courses |
| Tổng quan khóa học / Nội dung khóa học | Course overview / Course content |
| Bắt đầu học / Tiếp tục học / Học thử | Start learning / Continue learning / Preview |
| Mở rộng tất cả / Thu gọn tất cả | Expand all / Collapse all |
| Đã học x/y bài | x/y lessons completed |
| Hoàn thành bài học / Đánh dấu chưa hoàn thành | Complete lesson / Mark as incomplete |
| Bài trước / Bài tiếp theo | Previous lesson / Next lesson |
| Tìm bài học… / Không có bài khớp | Search lessons… / No matching lessons |
| Đăng nhập để bắt đầu khóa học. | Sign in to start this course. |
| Bạn là tác giả khóa này — chỉ xem bài học thử. | You are the author of this course — preview lessons only. |
| Bạn chưa bắt đầu khóa học nào / Khám phá khóa học | You have not started any course / Explore courses |
| Cơ bản / Trung cấp / Nâng cao | Beginner / Intermediate / Advanced |
| Tạo khóa học / Thêm chương / Thêm bài / Cho học thử | Create course / Add chapter / Add lesson / Allow preview |
| Soạn bằng AI / Dùng bản nháp này cho bài học | Write with AI / Use this draft for the lesson |
| Mới / Đã sửa / Đã gỡ · Chỉ phần thay đổi / Xem tất cả | New / Changed / Archived · Changes only / View all |

Copy lỗi theo mã: bảng Task 1a–1c trong spec; mã lạ dùng fallback chung.

## 6. Câu hỏi chốt cho người dùng

1. **Khung học không có Sidebar app** (overview + trang bài dùng thanh trên riêng như ảnh JB, 2c-2). Khác: giữ Sidebar app và đặt curriculum bên trong vùng nội dung (chật hơn ở 1440).
2. **Overview dùng chung khung học** có cột curriculum trái (như `jb-course.png`), thay vì trang overview một cột riêng.
3. **Đổi thứ tự chương/bài bằng Lên/Xuống trong menu `⋯`**, không kéo-thả (spec chỉ đòi bàn phím; kéo-thả cần thêm thư viện).
4. **AI soạn bài trong Sheet** ngay trong editor (3a-7), không thêm route `/author/courses/:id/ai`.
5. **Guest vào được `/courses*` không cần đăng nhập** với sidebar Guest tối thiểu (mục 1) — khác `/blogs` hiện bắt đăng nhập.

## Kết luận người dùng đã duyệt

- **2026-11-09:** người dùng duyệt toàn bộ wireframe và đồng ý cả 5 câu ở mục 6 (khung học không Sidebar app; overview dùng chung khung học; reorder bằng Lên/Xuống; AI soạn bài trong Sheet; Guest xem `/courses*` không cần đăng nhập). Task 2a–2c code theo file này + spec.
