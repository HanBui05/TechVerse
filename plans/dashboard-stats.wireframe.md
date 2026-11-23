# Dashboard stats — Wireframe cổng trước Task 2 (Giao diện Admin & Moderator)

Trạng thái: **Đã duyệt 2026-11-23** (kèm 5 điều chỉnh ở mục 4).
Nguồn chuẩn: [`dashboard-stats.md`](dashboard-stats.md) (Task 2, Ràng buộc chung, Quyết định của người dùng), [`dashboard-stats.log.md`](dashboard-stats.log.md) (Task 1), [`DashboardResponse.java`](../server/src/main/java/com/techverse/server/dto/response/DashboardResponse.java), [`UI_GUIDE.md`](../docs/design/UI_GUIDE.md).

Ký hiệu: `[Nút]` · `[↗ Ô liên kết]` · `●` chấm nhấn (`amber` khi việc cần xử lý > 0) · `▓` `Skeleton` · `⟳` tải lại / thử lại. Icon thật dùng `lucide-react` đơn sắc `text-muted-foreground`.

---

## 0. Nguyên tắc bố cục & phong cách

- **Phong cách:** sạch, trung tính, chuyên nghiệp kiểu bảng điều khiển quản trị. Không gradient, không đổ bóng đậm, không icon màu sặc sỡ, không biểu đồ hay bộ lọc ngày.
- **Ô số liệu (stat tile):** đồng bộ với `ArticleStats` (`rounded-xl border border-border bg-card p-5 text-left text-card-foreground`), nhãn nhỏ in hoa (`text-[11px] font-semibold uppercase tracking-[.05em] text-muted-foreground`), số lớn (`text-2xl font-semibold tracking-tight text-foreground tabular-nums`), icon `lucide-react` nhỏ (`size-4 shrink-0 text-muted-foreground`) ở góc phải trên.
- **Nhấn việc cần xử lý:** chỉ các ô việc cần làm (`Hồ sơ chờ duyệt`, `Đơn chờ xác nhận`, `Đơn cần đối chiếu` ở Admin; các ô chờ duyệt / báo cáo mở ở Moderator) khi **số > 0** mới có viền nhấn nhẹ `border-tone-amber-border` kèm một chấm nhỏ `bg-tone-amber-fg` cạnh nhãn; khi `= 0` hoặc `"—"` thì giữ viền `border-border` trung tính.
- **Ô liên kết (`<Link>`):**
  - Vùng chạm cảm ứng: `pointer-coarse:min-h-11 pointer-coarse:min-w-11`.
  - Trạng thái tương tác: `transition-colors hover:bg-muted/30 focus-visible:ring-[3px] focus-visible:ring-ring outline-none`.
  - Tên truy cập (`aria-label`) đọc cả nhãn lẫn giá trị hiển thị, ví dụ: `aria-label="Hồ sơ chờ duyệt: 4"` (hoặc `"Hồ sơ chờ duyệt: —"` khi lỗi).
- **Định dạng số & tiền:**
  - Số đếm: `(n).toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US')`, thiếu hoặc lỗi hiện `"—"`.
  - Tiền VND: dùng lại `vnd(amount, language)` từ `app/src/services/courseService.ts:204` (`Intl.NumberFormat` `VND`, `maximumFractionDigits: 0`), thiếu hoặc lỗi hiện `"—"`.
- **Tải lại không đua (latest-request-wins):** dùng `useRef(0)` đếm lượt gọi như `useArticleStats`; khi bấm `[⟳ Tải lại]` nhiều lần liên tiếp, chỉ phản hồi của lượt mới nhất được ghi vào state.

---

## 1. Bảng ánh xạ ô số liệu và liên kết

### 1.1. Trang Admin (`/admin` — `GET /api/v1/admin/dashboard`)

| Nhóm (h3) | Trường JSON | Nhãn (vi / en) | Kiểu ô | Đích liên kết (`to`) |
|---|---|---|---|---|
| **1. Người dùng** | `users.total` | Tổng người dùng / Total users | Ô tĩnh (`<div>`) | — |
| | `users.active` | Đang hoạt động / Active | Ô tĩnh (`<div>`) | — |
| | `users.locked` | Đã khóa / Locked | Ô tĩnh (`<div>`) | — |
| | `users.newLast7Days` | Mới trong 7 ngày / New in 7 days | Ô tĩnh (`<div>`) | — |
| **2. Tác giả** | `authors.approved` | Tác giả đã duyệt / Approved authors | Ô tĩnh (`<div>`) | — |
| | `authors.suspended` | Tác giả bị đình chỉ / Suspended authors | Ô tĩnh (`<div>`) | — |
| | `authors.pendingApplications` | Hồ sơ chờ duyệt / Pending applications | **Liên kết (`<Link>`)** | `/admin/author-applications` |
| **3. Nội dung đang công khai** | `content.articles` | Bài viết / Articles | Ô tĩnh (`<div>`) | — |
| | `content.courses` | Khóa học / Courses | Ô tĩnh (`<div>`) | — |
| | `content.exerciseSets` | Bộ bài tập / Exercise sets | Ô tĩnh (`<div>`) | — |
| | `content.interviewQuestions` | Câu hỏi phỏng vấn / Interview questions | Ô tĩnh (`<div>`) | — |
| | `content.forumQuestions` | Câu hỏi diễn đàn / Forum questions | Ô tĩnh (`<div>`) | — |
| **4. Đơn hàng và doanh thu** | `orders.awaitingConfirmation` | Đơn chờ xác nhận / Orders awaiting confirmation | **Liên kết (`<Link>`)** | `/admin/orders?transferReported=true` |
| | `orders.needsReconciliation` | Đơn cần đối chiếu / Orders to reconcile | **Liên kết (`<Link>`)** | `/admin/orders?status=ALL&needsReconciliation=true` |
| | `revenue.allTime` | Doanh thu — Toàn thời gian / All time (`paidOrders`, `grossAmount`, `platformAmount`, `authorAmount`) | Bảng / khối trong Card `Doanh thu` | — |
| | `revenue.last30Days` | Doanh thu — 30 ngày qua / Last 30 days (`paidOrders`, `grossAmount`, `platformAmount`, `authorAmount`) | Bảng / khối trong Card `Doanh thu` | — |

*(Section **Khu vực quản trị** phía dưới giữ nguyên 4 ô lối tắt hiện có: `/admin/author-applications`, `/admin/users`, `/admin/topics`, `/admin/tags`.)*

### 1.2. Trang Moderator (`/moderator` — `GET /api/v1/moderator/dashboard`)

| Trường JSON | Nhãn (vi / en) | Kiểu ô | Đích liên kết (`to`) |
|---|---|---|---|
| `pending.articles` | Bài viết chờ duyệt / Articles pending | **Liên kết (`<Link>`)** | `/moderator/articles` |
| `pending.courses` | Khóa học chờ duyệt / Courses pending | **Liên kết (`<Link>`)** | `/moderator/courses` |
| `pending.exerciseSets` | Bộ bài tập chờ duyệt / Exercise sets pending | **Liên kết (`<Link>`)** | `/moderator/exercises` |
| `pending.interviewQuestions` | Câu hỏi phỏng vấn chờ duyệt / Interview questions pending | **Liên kết (`<Link>`)** | `/moderator/interview-questions` |
| `reports.open` | Báo cáo chờ xử lý / Open reports | **Liên kết (`<Link>`)** | `/moderator/reports` |
| `reports.hiddenPosts` | Nội dung đang ẩn / Hidden content | **Liên kết (`<Link>`)** | `/moderator/reports?tab=hidden` |

*(Thẻ **Hàng đợi kiểm duyệt** phía dưới giữ nguyên, nút `[Mở danh sách bài viết]` trỏ `/moderator/articles`; dòng mô tả lấy `pending.articles` từ cùng response của `GET /api/v1/moderator/dashboard`, không còn gọi 5 request `useArticleStats` trên trang này.)*

---

## 2. Trang Admin (`/admin`)

### 2.1. Desktop (≥ 1280px) — Trạng thái có số đầy đủ

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ TechVerse • Quản trị                                                                     │
│ Chào mừng trở lại!                                          [🌐 Tiếng Việt] [🎨 Giao diện]│
│ Chọn một khu vực để bắt đầu quản trị TechVerse.                                          │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                          │
│ Số liệu (h2)                                                                 [⟳ Tải lại] │
│                                                                                          │
│ NGƯỜI DÙNG (h3)                                                   (grid: 4 cột ở xl)     │
│ ┌────────────────────┐ ┌────────────────────┐ ┌────────────────────┐ ┌──────────────────┐│
│ │ TỔNG NGƯỜI DÙNG  👥│ │ ĐANG HOẠT ĐỘNG   ✓ │ │ ĐÃ KHÓA          🔒│ │ MỚI TRONG 7 NGÀY ││
│ │ 1.248              │ │ 1.210              │ │ 38                 │ │ 64               ││
│ └────────────────────┘ └────────────────────┘ └────────────────────┘ └──────────────────┘│
│                                                                                          │
│ TÁC GIẢ (h3)                                                      (grid: 3 cột ở sm/xl)  │
│ ┌────────────────────────────┐ ┌────────────────────────────┐ ┌─────────────────────────┐│
│ │ TÁC GIẢ ĐÃ DUYỆT        ✓  │ │ TÁC GIẢ BỊ ĐÌNH CHỈ     ⏸ │ │ ● HỒ SƠ CHỜ DUYỆT    ↗ ││
│ │ 86                         │ │ 3                          │ │ 4                       ││
│ └────────────────────────────┘ └────────────────────────────┘ └─────────────────────────┘│
│                                                                 ↳ Link: /admin/author-applications
│                                                                                          │
│ NỘI DUNG ĐANG CÔNG KHAI (h3)                                      (grid: 5 cột ở xl)     │
│ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐ ┌────────────────┐ ┌──────────────┐│
│ │ BÀI VIẾT    📄│ │ KHÓA HỌC    🎓│ │ BỘ BÀI TẬP  🏋│ │ CÂU HỎI PV   💬│ │ CÂU HỎI DĐ ❓││
│ │ 342           │ │ 28            │ │ 45            │ │ 190            │ │ 512          ││
│ └───────────────┘ └───────────────┘ └───────────────┘ └────────────────┘ └──────────────┘│
│                                                                                          │
│ ĐƠN HÀNG VÀ DOANH THU (h3)                                                               │
│ ┌───────────────────────────────────────────┐ ┌─────────────────────────────────────────┐│
│ │ ● ĐƠN CHỜ XÁC NHẬN                     ↗  │ │ ● ĐƠN CẦN ĐỐI CHIẾU                  ↗  ││
│ │ 2                                         │ │ 1                                       ││
│ └───────────────────────────────────────────┘ └─────────────────────────────────────────┘│
│   ↳ Link: /admin/orders?transferReported=true   ↳ Link: /admin/orders?status=ALL&needsReconciliation=true
│                                                                                          │
│ ┌─ Card: Doanh thu ─────────────────────────────────────────────────────────────────────┐│
│ │ Doanh thu                                                                             ││
│ │ ───────────────────────────────────────────────────────────────────────────────────── ││
│ │ Kỳ               Đơn đã thanh toán        Tổng thu      Nền tảng giữ     Tác giả nhận ││
│ │ ───────────────────────────────────────────────────────────────────────────────────── ││
│ │ Toàn thời gian                 128   45.600.000 ₫      9.120.000 ₫     36.480.000 ₫ ││
│ │ 30 ngày qua                     19    6.850.000 ₫      1.370.000 ₫      5.480.000 ₫ ││
│ └───────────────────────────────────────────────────────────────────────────────────────┘│
│                                                                                          │
│ Khu vực quản trị (h2 — giữ nguyên 4 ô lối tắt hiện có)                                   │
│ ┌────────────────────┐ ┌────────────────────┐ ┌────────────────────┐ ┌──────────────────┐│
│ │ [👤] Hồ sơ tác giả │ │ [👥] QL người dùng │ │ [📖] Chủ đề        │ │ [🏷] Thẻ         ││
│ │ Duyệt, từ chối…    │ │ Tìm kiếm, khóa…    │ │ Tạo, sửa chủ đề…   │ │ Tạo, sửa thẻ…    ││
│ │ Mở →               │ │ Mở →               │ │ Mở →               │ │ Mở →             ││
│ └────────────────────┘ └────────────────────┘ └────────────────────┘ └──────────────────┘│
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.2. Mobile (390px) — Trang Admin

- Lưới các ô đếm: `grid-cols-2 gap-3` (2 cột đều nhau, nhãn hoặc số dài không tràn ngang).
- Card **Doanh thu**: trên mobile (`< sm`), chuyển mỗi kỳ (`Toàn thời gian`, `30 ngày qua`) thành một khối xếp dọc gồm 4 dòng cặp `Nhãn — Giá trị` (`tabular-nums`, `break-words`) để số tiền hàng tỷ đồng (`9.120.000.000 ₫`) không bao giờ gây cuộn ngang ở 390px.

```
┌──────────────────────────────────────┐
│ TechVerse • Quản trị                 │
│ Chào mừng trở lại!                   │
│ [🌐 Tiếng Việt] [🎨 Giao diện]       │
├──────────────────────────────────────┤
│ Số liệu                  [⟳ Tải lại] │
│                                      │
│ NGƯỜI DÙNG                           │
│ ┌────────────────┐ ┌───────────────┐ │
│ │ TỔNG NGƯỜI DÙNG│ │ ĐANG HOẠT ĐỘNG│ │
│ │ 1.248          │ │ 1.210         │ │
│ └────────────────┘ └───────────────┘ │
│ ┌────────────────┐ ┌───────────────┐ │
│ │ ĐÃ KHÓA        │ │ MỚI 7 NGÀY    │ │
│ │ 38             │ │ 64            │ │
│ └────────────────┘ └───────────────┘ │
│                                      │
│ TÁC GIẢ                              │
│ ┌────────────────┐ ┌───────────────┐ │
│ │ ĐÃ DUYỆT       │ │ BỊ ĐÌNH CHỈ   │ │
│ │ 86             │ │ 3             │ │
│ └────────────────┘ └───────────────┘ │
│ ┌──────────────────────────────────┐ │
│ │ ● HỒ SƠ CHỜ DUYỆT             ↗  │ │
│ │ 4                                │ │
│ └──────────────────────────────────┘ │
│                                      │
│ NỘI DUNG ĐANG CÔNG KHAI              │
│ ┌────────────────┐ ┌───────────────┐ │
│ │ BÀI VIẾT       │ │ KHÓA HỌC      │ │
│ │ 342            │ │ 28            │ │
│ └────────────────┘ └───────────────┘ │
│ ┌────────────────┐ ┌───────────────┐ │
│ │ BỘ BÀI TẬP     │ │ CÂU HỎI PV    │ │
│ │ 45             │ │ 190           │ │
│ └────────────────┘ └───────────────┘ │
│ ┌────────────────┐                   │
│ │ CÂU HỎI DĐ     │                   │
│ │ 512            │                   │
│ └────────────────┘                   │
│                                      │
│ ĐƠN HÀNG VÀ DOANH THU                │
│ ┌────────────────┐ ┌───────────────┐ │
│ │ ● ĐƠN CHỜ XN ↗ │ │ ● ĐƠN ĐỐI CH.↗│ │
│ │ 2              │ │ 1             │ │
│ └────────────────┘ └───────────────┘ │
│ ┌─ Doanh thu ──────────────────────┐ │
│ │ TOÀN THỜI GIAN                   │ │
│ │ Đơn đã thanh toán            128 │ │
│ │ Tổng thu            45.600.000 ₫ │ │
│ │ Nền tảng giữ         9.120.000 ₫ │ │
│ │ Tác giả nhận        36.480.000 ₫ │ │
│ │ ──────────────────────────────── │ │
│ │ 30 NGÀY QUA                      │ │
│ │ Đơn đã thanh toán             19 │ │
│ │ Tổng thu             6.850.000 ₫ │ │
│ │ Nền tảng giữ         1.370.000 ₫ │ │
│ │ Tác giả nhận         5.480.000 ₫ │ │
│ └──────────────────────────────────┘ │
│                                      │
│ Khu vực quản trị                     │
│ ┌──────────────────────────────────┐ │
│ │ [👤] Hồ sơ tác giả          Mở → │ │
│ └──────────────────────────────────┘ │
│ ... (4 ô lối tắt xếp 1 cột)         │
└──────────────────────────────────────┘
```

### 2.3. Các trạng thái của trang Admin

1. **Đang tải (lần đầu mở trang):**
   - Nút `[⟳ Tải lại]` `disabled`.
   - Khung chờ (`role="status"`): giữ đúng cấu trúc lưới 4 nhóm bằng các `Skeleton` cao bằng ô thật (`h-[88px] rounded-xl`) + `Skeleton` cho card Doanh thu (`h-40 rounded-xl`) để không nhảy bố cục khi số về.
   - Section **Khu vực quản trị** bên dưới vẫn hiển thị và bấm được ngay.
```
│ Số liệu                                                                      [⟳ Tải lại] │
│ ┌────────────────────┐ ┌────────────────────┐ ┌────────────────────┐ ┌──────────────────┐│
│ │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │ │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │ │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │ │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ ││
│ └────────────────────┘ └────────────────────┘ └────────────────────┘ └──────────────────┘│
```

2. **Lỗi tải API (`500` / rớt mạng):**
   - Hiện dải thông báo lỗi (`role="alert"`) ngay dưới tiêu đề `Số liệu`:
     `Không tải được số liệu. Hãy thử lại.` (`text-danger`) + nút `[⟳ Thử lại]`.
   - Toàn bộ các ô số và các ô trong bảng Doanh thu hiện `"—"`.
   - Các ô liên kết (`Hồ sơ chờ duyệt`, `Đơn chờ xác nhận`, `Đơn cần đối chiếu`) và 4 ô **Khu vực quản trị** vẫn bấm chuyển trang bình thường.
```
│ Số liệu                                                                      [⟳ Tải lại] │
│ ┌───────────────────────────────────────────────────────────────────────────────────────┐│
│ │ Không tải được số liệu. Hãy thử lại.                                      [⟳ Thử lại] ││
│ └───────────────────────────────────────────────────────────────────────────────────────┘│
│ NGƯỜI DÙNG                                                                               │
│ ┌────────────────────┐ ┌────────────────────┐ ┌────────────────────┐ ┌──────────────────┐│
│ │ TỔNG NGƯỜI DÙNG  👥│ │ ĐANG HOẠT ĐỘNG   ✓ │ │ ĐÃ KHÓA          🔒│ │ MỚI TRONG 7 NGÀY ││
│ │ —                  │ │ —                  │ │ —                  │ │ —                ││
│ └────────────────────┘ └────────────────────┘ └────────────────────┘ └──────────────────┘│
```

3. **Thiếu một nhóm hoặc thiếu trường con trong phản hồi JSON:**
   - Mọi nhóm (`users`, `authors`, `content`, `orders`, `revenue`) và trường con trong `AdminDashboard` đều là optional.
   - Khi API trả thành công (`200`) nhưng **thiếu một trường con** (ví dụ `content.forumQuestions === undefined`): **không render ô `Câu hỏi diễn đàn`** (tuyệt đối không hiện `0` thay cho trường thiếu).
   - Khi API trả thành công nhưng **thiếu cả một nhóm** hoặc nhóm không có trường con nào được định nghĩa (ví dụ `revenue === undefined` và `orders === undefined`, hoặc `authors === undefined`): **ẩn toàn bộ nhóm đó (kể cả tiêu đề `h3`)**.
```
│ (Ví dụ phản hồi không có nhóm `authors` và không có `content.forumQuestions`)            │
│ NGƯỜI DÙNG (h3) → hiện 4 ô                                                               │
│ (Nhóm TÁC GIẢ ẩn hoàn toàn)                                                              │
│ NỘI DUNG ĐANG CÔNG KHAI (h3) → chỉ hiện 4 ô: Bài viết, Khóa học, Bộ bài tập, Câu hỏi PV │
```

---

## 3. Trang Moderator (`/moderator`)

### 3.1. Desktop (≥ 1280px) — Trạng thái có số đầy đủ

- Header giữ tiêu đề `Không gian kiểm duyệt` + mô tả phụ bên trái, thêm nút `[⟳ Tải lại]` (`Button variant="outline" size="sm"`) ở góc phải.
- Thay thế hoàn toàn `ArticleStats` (5 lần gọi cũ) bằng khu `Số liệu` gồm **6 ô liên kết** trên lưới `grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6`.
- Không bao giờ có bất kỳ chữ hay con số nào liên quan tới doanh thu / đơn hàng.
- Thẻ `Hàng đợi kiểm duyệt` phía dưới giữ nguyên bố cục; câu mô tả lấy `pending.articles` từ kết quả của `GET /api/v1/moderator/dashboard` (`"{n} bài đang chờ duyệt."`, hoặc câu fallback `"Xem và xử lý các bài viết được gửi từ tác giả."` khi đang tải / lỗi / thiếu `pending.articles`).

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ Không gian kiểm duyệt                                                        [⟳ Tải lại] │
│ Theo dõi nội dung và hoạt động của cộng đồng.                                            │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                          │
│ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐ ┌──────────────┐ ┌──────────────┐
│ │ ● BÀI VIẾT    │ │ ● KHÓA HỌC    │ │ BỘ BÀI TẬP    │ │ ● CÂU HỎI PV  │ │ ● BÁO CÁO    │ │ NỘI DUNG     │
│ │   CHỜ DUYỆT ↗ │ │   CHỜ DUYỆT ↗ │ │   CHỜ DUYỆT ↗ │ │   CHỜ DUYỆT ↗ │ │   CHỜ XỬ LÝ ↗│ │   ĐANG ẨN  ↗ │
│ │ 4             │ │ 2             │ │ 0             │ │ 7             │ │ 3            │ │ 1            │
│ └───────────────┘ └───────────────┘ └───────────────┘ └───────────────┘ └──────────────┘ └──────────────┘
│   ↳ /moderator/     ↳ /moderator/     ↳ /moderator/     ↳ /moderator/     ↳ /moderator/    ↳ /moderator/
│     articles          courses           exercises         interview-        reports          reports?tab=hidden
│                                                           questions
│                                                                                          │
│ ┌─ Card: Hàng đợi kiểm duyệt ───────────────────────────────────────────────────────────┐│
│ │ [📋]  Hàng đợi kiểm duyệt                                    [Mở danh sách bài viết]  ││
│ │       4 bài đang chờ duyệt.                                        ↳ /moderator/articles│
│ └───────────────────────────────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

### 3.2. Mobile (390px) — Trang Moderator

- Lưới 6 ô liên kết: `grid-cols-2 gap-3` (3 hàng × 2 cột). Mỗi ô có `pointer-coarse:min-h-11 pointer-coarse:min-w-11`.
- Thẻ `Hàng đợi kiểm duyệt`: nút `[Mở danh sách bài viết]` xuống hàng gọn trong Card, không cuộn ngang.

```
┌──────────────────────────────────────┐
│ Không gian kiểm duyệt    [⟳ Tải lại] │
│ Theo dõi nội dung và hoạt động...    │
├──────────────────────────────────────┤
│ ┌────────────────┐ ┌───────────────┐ │
│ │ ● BÀI VIẾT     │ │ ● KHÓA HỌC    │ │
│ │   CHỜ DUYỆT  ↗ │ │   CHỜ DUYỆT ↗ │ │
│ │ 4              │ │ 2             │ │
│ └────────────────┘ └───────────────┘ │
│ ┌────────────────┐ ┌───────────────┐ │
│ │ BỘ BÀI TẬP     │ │ ● CÂU HỎI PV  │ │
│ │   CHỜ DUYỆT  ↗ │ │   CHỜ DUYỆT ↗ │ │
│ │ 0              │ │ 7             │ │
│ └────────────────┘ └───────────────┘ │
│ ┌────────────────┐ ┌───────────────┐ │
│ │ ● BÁO CÁO      │ │ NỘI DUNG      │ │
│ │   CHỜ XỬ LÝ  ↗ │ │   ĐANG ẨN   ↗ │ │
│ │ 3              │ │ 1             │ │
│ └────────────────┘ └───────────────┘ │
│                                      │
│ ┌─ Hàng đợi kiểm duyệt ────────────┐ │
│ │ [📋] Hàng đợi kiểm duyệt         │ │
│ │      4 bài đang chờ duyệt.       │ │
│ │      [Mở danh sách bài viết]     │ │
│ └──────────────────────────────────┘ │
└──────────────────────────────────────┘
```

### 3.3. Các trạng thái của trang Moderator

1. **Đang tải:**
   - 6 ô `Skeleton` (`h-[88px] rounded-xl`) trong lưới `grid-cols-2 sm:grid-cols-3 xl:grid-cols-6`.
   - Thẻ `Hàng đợi kiểm duyệt` hiện câu fallback `"Xem và xử lý các bài viết được gửi từ tác giả."` và nút `[Mở danh sách bài viết]` vẫn bấm được.

2. **Lỗi tải API:**
   - Dải thông báo lỗi (`role="alert"`): `Không tải được số liệu. Hãy thử lại.` (`text-danger`) + nút `[⟳ Thử lại]`.
   - Cả 6 ô liên kết hiện `"—"` nhưng vẫn giữ nguyên `<Link>` để Moderator bấm vào từng hàng đợi được.
   - Thẻ `Hàng đợi kiểm duyệt` hiện câu fallback `"Xem và xử lý các bài viết được gửi từ tác giả."`.
```
│ Không gian kiểm duyệt                                                        [⟳ Tải lại] │
│ ┌───────────────────────────────────────────────────────────────────────────────────────┐│
│ │ Không tải được số liệu. Hãy thử lại.                                      [⟳ Thử lại] ││
│ └───────────────────────────────────────────────────────────────────────────────────────┘│
│ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐ ┌──────────────┐ ┌──────────────┐
│ │ BÀI VIẾT      │ │ KHÓA HỌC      │ │ BỘ BÀI TẬP    │ │ CÂU HỎI PV    │ │ BÁO CÁO      │ │ NỘI DUNG     │
│ │ CHỜ DUYỆT   ↗ │ │ CHỜ DUYỆT   ↗ │ │ CHỜ DUYỆT   ↗ │ │ CHỜ DUYỆT   ↗ │ │ CHỜ XỬ LÝ  ↗ │ │ ĐANG ẨN    ↗ │
│ │ —             │ │ —             │ │ —             │ │ —             │ │ —            │ │ —            │
│ └───────────────┘ └───────────────┘ └───────────────┘ └───────────────┘ └──────────────┘ └──────────────┘
```

3. **Thiếu nhóm hoặc trường con trong phản hồi JSON:**
   - Nếu `reports` vắng mặt trong JSON: không render 2 ô `Báo cáo chờ xử lý` và `Nội dung đang ẩn` (chỉ render các ô có mặt trong `pending`).
   - Nếu một trường con như `pending.interviewQuestions` vắng mặt: ẩn ô đó, không hiện `0`.
   - Nếu cả `pending` và `reports` đều không có trường nào: ẩn lưới ô số, chỉ còn thẻ `Hàng đợi kiểm duyệt`.

---

## 4. Điều chỉnh khi duyệt 2026-11-23

1. **Nhãn viết tắt trong ASCII chỉ là do chỗ hẹp:** dùng đúng copy đầy đủ của spec, nhãn dài xuống dòng.
2. **Đang tải:** render ô thật có nhãn, chỉ thay số bằng `Skeleton` (không dùng khung `h-[88px]` cố định); ô cùng hàng cao bằng nhau, số canh đáy (`mt-auto`).
3. **Bấm "Tải lại" khi đã có số:** giữ số cũ, nút `disabled` + spinner, không quay về khung chờ; chỉ lượt mới nhất được ghi.
4. **Bảng doanh thu:** desktop `<table>` có `th scope`, ô tiêu đề cột kỳ để trống với nhãn `sr-only` (không thêm copy `"Kỳ"` hiển thị); mobile `<dl>`; thiếu một kỳ hoặc một trường tiền thì ẩn đúng hàng/dòng đó.
5. **Mobile:** ô lẻ cuối nhóm chiếm nửa hàng như các ô khác (không `col-span`).

---

## 5. Task 2b — Khu “Phân bổ” (biểu đồ, quyết định người dùng 2026-11-24)

Trạng thái: **Đã duyệt** (2026-11-24; mục 5.5 chọn “Doanh thu 30 ngày qua”). Nguồn: quyết định 2026-11-24 trong [`dashboard-stats.log.md`](dashboard-stats.log.md). Không đổi backend: mọi biểu đồ vẽ từ đúng response `GET /api/v1/admin/dashboard` và `GET /api/v1/moderator/dashboard` mà khu “Số liệu” đã tải (không gọi thêm API).

### 5.1. Nguyên tắc

- **Thư viện:** shadcn `chart` (`npx shadcn@latest add chart`, chạy trên Recharts; sinh `app/src/components/ui/chart.tsx`). Không thêm thư viện nào khác.
- **Phong cách:** mỗi biểu đồ nằm trong `Card` cùng kiểu ô số liệu (`rounded-xl border-border bg-card p-5`), tiêu đề `text-sm font-semibold`, một dòng phụ `text-xs text-muted-foreground`. Lưới và trục mờ (`--border`, chữ trục `--muted-foreground`), không gradient, không bóng, không hiệu ứng vào.
- **Dạng biểu đồ (theo hướng dẫn dataviz):** so sánh độ lớn giữa các loại → **cột ngang xếp từ lớn đến nhỏ, một màu**; một tổng chia ≤ 3 phần → **thanh chia đoạn** có chú thích. Không biểu đồ tròn, không hai trục.
- **Số luôn hiện cạnh thanh** (không phải rê chuột mới thấy); tooltip khi rê/chạm chỉ nhắc lại nhãn + số + phần trăm. Chữ dùng màu chữ (`foreground`/`muted-foreground`), không dùng màu của thanh.
- **Màu biểu đồ** (biến mới trong `tokens.css`, đã chạy `validate_palette.js`, cả 5 kiểm tra đạt ở cả hai chế độ):

  | Biến | Light (nền `--card` #f9fafb) | Dark (nền `--card` #111827) | Dùng cho |
  |---|---|---|---|
  | `--chart-1` | `#1d4ed8` (= `--tone-blue-fg` light) | `#3b82f6` | cột một màu; phần thứ nhất của thanh chia đoạn |
  | `--chart-2` | `#92400e` (= `--tone-amber-fg` light) | `#d97706` | phần thứ hai |
  | `--chart-3` | `#7e22ce` (= `--tone-purple-fg` light) | `#a855f7` | phần thứ ba |

  Dark không dùng được `--tone-*-fg` hiện có (quá nhạt: L > 0.8, rơi ra ngoài dải sáng của biểu đồ), nên lấy bậc đậm hơn cùng họ màu. Giữa các đoạn của thanh chia có khe 2px màu nền thẻ.
- **Bảng thay thế:** các ô số ở khu “Số liệu” phía trên là bản số đầy đủ của từng biểu đồ, nên không thêm nút “xem dạng bảng”.

### 5.2. Trang Admin — vị trí và nội dung

Thứ tự trang: Header → **Số liệu** (giữ nguyên) → **Phân bổ** (mới) → **Khu vực quản trị** (giữ nguyên, cuối trang).

| Thẻ | Dữ liệu | Dạng | Ẩn khi |
|---|---|---|---|
| **Nội dung đang công khai theo loại** | `content.*` (5 loại) | Cột ngang, `--chart-1`, xếp lớn → nhỏ, số ở cuối mỗi thanh, trục x từ 0 | thiếu cả nhóm `content`; loại nào thiếu trường thì bỏ hàng đó |
| **Tài khoản** | `users.active`/`users.locked`; `authors.approved`/`suspended`/`pendingApplications` | Hai thanh chia đoạn xếp dọc trong cùng thẻ: “Người dùng” (2 phần: đang hoạt động `--chart-1`, đã khóa `--chart-2`), “Tác giả” (3 phần: đã duyệt `--chart-1`, bị đình chỉ `--chart-2`, chờ duyệt `--chart-3`); chú thích dưới mỗi thanh: chấm màu + nhãn + số + % | thanh nào thiếu trường cần thiết thì ẩn thanh đó; ẩn thẻ khi không còn thanh nào |
| **Doanh thu 30 ngày qua** *(đề xuất thay “Chia doanh thu”, xem 5.5)* | `revenue.last30Days.grossAmount` / `revenue.allTime.grossAmount` | Một thanh tiến độ (meter): phần đã tô `--chart-1` là tỷ lệ tổng thu 30 ngày trên tổng thu toàn thời gian; dưới thanh: “6.850.000 ₫ / 9.120.000.000 ₫ · 0,1%” | thiếu một trong hai số, hoặc tổng thu toàn thời gian = 0 |

Desktop ≥ 1280px: lưới 2 cột — “Nội dung theo loại” bên trái chiếm 2 hàng; “Tài khoản” và “Doanh thu 30 ngày qua” xếp chồng bên phải. 768–1279px: 2 cột, mỗi thẻ một ô. < 768px: 1 cột.

```
│ Phân bổ (h2)                                                                             │
│ ┌─ Nội dung đang công khai theo loại ──────────┐ ┌─ Tài khoản ───────────────────────────┐│
│ │ Số mục đang công khai của từng loại          │ │ Người dùng                            ││
│ │                                              │ │ ███████████████████████████████████▒▒ ││
│ │ Câu hỏi diễn đàn   ███████████████████  512  │ │ ● Đang hoạt động 1.210 (97%)          ││
│ │ Bài viết           █████████████        342  │ │ ● Đã khóa 38 (3%)                     ││
│ │ Câu hỏi phỏng vấn  ███████              190  │ │                                       ││
│ │ Bộ bài tập         ██                    45  │ │ Tác giả                               ││
│ │ Khóa học           █                     28  │ │ ██████████████████████████████▒░      ││
│ │                    0    200   400   600      │ │ ● Đã duyệt 86 (93%) ● Bị đình chỉ 3   ││
│ │                                              │ │   (3%) ● Chờ duyệt 4 (4%)             ││
│ │                                              │ └───────────────────────────────────────┘│
│ │                                              │ ┌─ Doanh thu 30 ngày qua ───────────────┐│
│ │                                              │ │ So với tổng thu toàn thời gian        ││
│ │                                              │ │ █░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ ││
│ │                                              │ │ 6.850.000 ₫ / 9.120.000.000 ₫ · 0,1%  ││
│ └──────────────────────────────────────────────┘ └───────────────────────────────────────┘│
│                                                                                          │
│ Khu vực quản trị (h2 — giữ nguyên)                                                       │
```

Mobile 390px (1 cột, thứ tự: Nội dung theo loại → Tài khoản → Doanh thu 30 ngày qua). Nhãn loại dài ở cột ngang dùng trục y rộng cố định ~40% thẻ và xuống dòng; số vẫn ở cuối thanh, không cuộn ngang:

```
┌──────────────────────────────────────┐
│ Phân bổ                              │
│ ┌─ Nội dung đang công khai theo loại ┐│
│ │ Câu hỏi diễn   ████████████   512  ││
│ │ đàn                                ││
│ │ Bài viết       ████████       342  ││
│ │ Câu hỏi phỏng  ████           190  ││
│ │ vấn                                ││
│ │ Bộ bài tập     █               45  ││
│ │ Khóa học       ▌               28  ││
│ └────────────────────────────────────┘│
│ ┌─ Tài khoản ────────────────────────┐│
│ │ Người dùng                         ││
│ │ ████████████████████████████████▒▒ ││
│ │ ● Đang hoạt động 1.210 (97%)       ││
│ │ ● Đã khóa 38 (3%)                  ││
│ │ Tác giả                            ││
│ │ ███████████████████████████▒░      ││
│ │ ● Đã duyệt 86 (93%)                ││
│ │ ● Bị đình chỉ 3 (3%)               ││
│ │ ● Chờ duyệt 4 (4%)                 ││
│ └────────────────────────────────────┘│
│ ┌─ Doanh thu 30 ngày qua ────────────┐│
│ │ █░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ ││
│ │ 6.850.000 ₫ / 9.120.000.000 ₫      ││
│ │ 0,1%                               ││
│ └────────────────────────────────────┘│
│ Khu vực quản trị …                    │
```

### 5.3. Trang Moderator

Thứ tự: Header → 6 ô số (giữ nguyên) → **Việc đang chờ theo hàng đợi** (mới) → thẻ “Hàng đợi kiểm duyệt” (giữ nguyên).

- Một thẻ rộng hết trang: cột ngang `--chart-1`, xếp lớn → nhỏ, 5 hàng: Bài viết, Khóa học, Bộ bài tập, Câu hỏi phỏng vấn (từ `pending.*`), Báo cáo chờ xử lý (`reports.open`). Không gồm “Nội dung đang ẩn” (không phải việc chờ làm). Nhãn hàng ngắn (“Bài viết”, “Báo cáo”…); dòng phụ của thẻ: “Số mục đang chờ ở từng hàng đợi”.
- Hàng nào thiếu trường thì bỏ; không còn hàng nào thì ẩn thẻ.

```
│ ┌─ Việc đang chờ theo hàng đợi ─────────────────────────────────────────────────────────┐│
│ │ Số mục đang chờ ở từng hàng đợi                                                       ││
│ │ Câu hỏi phỏng vấn  ████████████████████████████████████████████████████████████   7  ││
│ │ Bài viết           ██████████████████████████████████                               4  ││
│ │ Báo cáo            █████████████████████████                                        3  ││
│ │ Khóa học           █████████████████                                                2  ││
│ │ Bộ bài tập                                                                          0  ││
│ └───────────────────────────────────────────────────────────────────────────────────────┘│
```

Mobile 390px: cùng thẻ, nhãn trục y ~40% bề ngang, xuống dòng khi dài.

### 5.4. Trạng thái (cả hai trang)

| Trạng thái | Khu “Phân bổ” |
|---|---|
| Đang tải lần đầu | Thẻ thật có tiêu đề; thân thẻ là `Skeleton` cao bằng biểu đồ (cột ngang: 5 thanh skeleton; thanh chia đoạn: 1 thanh skeleton mỗi dòng) |
| Đang “Tải lại” khi đã có số | Giữ biểu đồ cũ, không nháy (giống ô số) |
| Lỗi tải | **Ẩn cả khu** (tiêu đề h2 lẫn thẻ): thông báo lỗi + “Thử lại” đã ở khu “Số liệu” phía trên; tránh biểu đồ rỗng |
| Có dữ liệu nhưng mọi giá trị của một biểu đồ = 0 | Thẻ giữ tiêu đề, thân thẻ là chữ `text-sm text-muted-foreground` “Chưa có dữ liệu.” / “No data yet.” thay cho trục rỗng |
| Thiếu trường | Bỏ đúng hàng/thanh; thẻ hết dữ liệu thì ẩn thẻ; khu hết thẻ thì ẩn cả khu |

### 5.5. Điểm cần người dùng quyết

- **“Chia doanh thu” → đề xuất thay bằng “Doanh thu 30 ngày qua”.** Phần nền tảng giữ luôn bằng tỷ lệ hoa hồng (đang 20%), nên thanh chia nền tảng/tác giả của cả hai kỳ gần như giống hệt nhau (≈ 20/80): biểu đồ không cho thêm thông tin gì ngoài con số đã có trong bảng doanh thu. Thanh tỷ lệ “30 ngày qua / toàn thời gian” cho thấy nhịp bán gần đây — thứ bảng số không cho thấy ngay. Nếu vẫn muốn “Chia doanh thu”: hai thanh chia đoạn 100% (Toàn thời gian, 30 ngày qua), nền tảng `--chart-1`, tác giả `--chart-2`, chú thích số + %.

### 5.6. Copy mới (vi / en)

| Khóa | vi | en |
|---|---|---|
| Tiêu đề khu | Phân bổ | Breakdown |
| Thẻ nội dung | Nội dung đang công khai theo loại · Số mục đang công khai của từng loại | Public content by type · Public items of each type |
| Thẻ tài khoản | Tài khoản · Người dùng · Tác giả | Accounts · Users · Authors |
| Thẻ doanh thu | Doanh thu 30 ngày qua · So với tổng thu toàn thời gian | Revenue in the last 30 days · Compared with all-time gross |
| Thẻ Moderator | Việc đang chờ theo hàng đợi · Số mục đang chờ ở từng hàng đợi | Pending work by queue · Items waiting in each queue |
| Nhãn hàng Moderator | Bài viết / Khóa học / Bộ bài tập / Câu hỏi phỏng vấn / Báo cáo | Articles / Courses / Exercise sets / Interview questions / Reports |
| Rỗng | Chưa có dữ liệu. | No data yet. |

Nhãn chú thích của thẻ “Tài khoản” dùng lại copy ô số đã có (Đang hoạt động, Đã khóa, Tác giả đã duyệt → “Đã duyệt”, …).

### 5.7. Kiểm khi code (tóm tắt cho Task 2b)

- Test (Vitest, bám role/label/text): mỗi biểu đồ có tên truy cập (`role="img"` + `aria-label` liệt kê nhãn và số, hoặc `figure` + `figcaption`); thứ tự xếp lớn → nhỏ; % đúng và cộng lại 100% (làm tròn); thiếu trường → bỏ hàng; mọi số 0 → “Chưa có dữ liệu.”; lỗi → không có khu “Phân bổ”; Moderator không có hàng “Nội dung đang ẩn”. Recharts trong jsdom cần giả lập kích thước khung (`ResizeObserver`/kích thước phần tử) — đặt trong file test, không sửa `setup.ts` nếu không bắt buộc.
- Build + kiểm mắt dark/light × desktop/mobile cảm ứng 390px: không cuộn ngang, nhãn trục không chồng nhau, số không bị cắt.
