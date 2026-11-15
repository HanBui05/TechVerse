# Course payment — Wireframe cổng trước Task 2a

Trạng thái: **người dùng đã duyệt 2026-11-15** (kết luận cuối file). Nguồn chuẩn: `course-payment.md` (spec, 1e hoãn nên không có checkout PayOS) + contract thật ở DTO Task 1a–1d (`OrderResponse`, `AdminOrderResponse`, `AuthorRevenueResponse`, `CommissionPolicyResponse`, `CourseResponse.priceAmount/commissionRateBps`, `PublishedCourse*Response.priceAmount`), `docs/design/UI_GUIDE.md`, nền phong cách `course-free.wireframe.md`. File chỉ chốt bố cục, luồng, trạng thái; mọi nút/số liệu có endpoint ở 1a–1d, không thêm chức năng.

Ký hiệu như `course-free.wireframe.md`: `[Nút]` · `(Badge)` · `▾` select · `⋯` menu phụ · `▓` Skeleton · `⟳` thử lại · `🔒` bài khóa · `⧉` nút copy. Icon thật là `lucide-react`, không emoji. Desktop 1440, mobile 390.

**Ngoài màn (không vẽ, không làm):** PayOS/checkout/return/cancel, giỏ hàng, mã giảm giá, hoàn tiền, nút hủy đơn (E2), xuất CSV (E3), “đã chi trả” cho tác giả, Admin cấp/thu hồi quyền, lịch tỷ lệ tương lai, giá/doanh thu trên màn Moderator.

## 0. Phong cách và theme

- Cùng ngôn ngữ đã duyệt ở article-flow/course-free: Card, hàng có viền trái theo trạng thái cần chú ý, Badge `statusTone`, nhãn trường 11 px in hoa, `AdminPagination`, Alert tone. Dark mặc định, light chọn được; chỉ token, không literal màu, không gradient. Danh sách Admin/Author là hàng trong Card, không dùng Table (UI_GUIDE).
- Màu trạng thái đơn: `PENDING` amber · `PAID` green · `EXPIRED` slate · `FAILED`/`CANCELLED` rose. Luôn có chữ, không chỉ màu. Số tiền hiển thị `1.250.000 ₫` (VND, nhóm nghìn theo locale), chữ số `tabular-nums`.
- Chuyển động tắt khi `prefers-reduced-motion`; vùng bấm ≥ 44 px trên cảm ứng; focus ring `ring`; contrast ≥ 4.5:1. Kiểm mắt dark/light × desktop/mobile.

## 1. Route, menu và quyền

| Route | Ai vào | Ghi chú |
|---|---|---|
| `/courses`, `/courses/:id`, trang bài | như course-free | thêm giá/CTA Mua (mục 2) |
| `/me/orders` | Đăng nhập, không phải manager | Guest → login kèm return URL |
| `/me/orders/:orderCode` | chủ đơn | người khác/không có → 404 `ORDER_NOT_FOUND` như nhau |
| `/author/courses/:id/edit` | `AUTHOR` | thêm ô giá (mục 3a) |
| `/author/revenue` | `AUTHOR` (còn role AUTHOR; bị đình chỉ → 403) | Moderator không có route |
| `/admin/orders`, `/admin/commission` | `ADMIN` | backend là ranh giới quyền |

```
Sidebar User                    Sidebar Admin (thêm vào nhóm sẵn có)
GÓC CỦA TÔI                       QUẢN TRỊ
  Bài đã lưu                        …
  Khóa học của tôi                  Đơn hàng            ← mới (/admin/orders)
  Đơn hàng của tôi    ← mới         Hoa hồng            ← mới (/admin/commission)
TÁC GIẢ ▾
  Bài viết của tôi
  Khóa học
  Doanh thu           ← mới (chỉ AUTHOR)
```

- Moderator Sidebar không đổi. Huy hiệu số đơn “cần xử lý” ở mục Admin “Đơn hàng”: **không làm** (API không có đếm riêng; cờ lọc nằm trong trang).

---

## 2. Người học (Task 2a + 2b)

### 2a-1 Giá trên danh mục và overview

```
card /courses:  … (Cơ bản)(Java)                      overview info card:
                Tiêu đề 2 dòng…                        (Nâng cao)(▤ 8 chương)(▣ 46 bài)…
                Cập nhật 26/06      [Xem khóa học ›]    Tên khóa (H1)
                (av) Trần B  Tác giả   (Miễn phí)       …  (av) Trần B · Tác giả
                              hoặc (350.000 ₫)          (350.000 ₫)   [Mua khóa học]
                                                        ⓘ Khóa học đã mua không được hoàn tiền.
```

- Giá: chip `(Miễn phí)` tone green hoặc `(350.000 ₫)` tone blue cạnh dòng tác giả; không đổi bố cục card.
- **CTA theo `viewer` + `priceAmount`:** `priceAmount=0` → luồng course-free không đổi ([Bắt đầu học]). `priceAmount>0`: chưa enroll → [Mua khóa học] (Guest → login + return URL `/courses/:id`; đăng nhập → `POST /orders {courseId}` **luôn gọi**, kể cả đã có đơn chờ, rồi mở `/me/orders/:orderCode` trả về); đã enroll → [Tiếp tục học]; chủ khóa → không CTA, dòng “Bạn là tác giả khóa này — chỉ xem bài học thử.” Có bài preview → giữ nút phụ [Học thử].
- Dòng “Khóa học đã mua không được hoàn tiền.” hiện ngay dưới nút Mua (hiển thị trước khi mua, theo spec).
- Nút Mua: đang gửi thì khóa + spinner; **không tự retry**. Lỗi hiện Alert trên CTA, copy theo mã 1b: `ORDER_ALREADY_ENROLLED` “Bạn đã có quyền học khóa này.” + [Tải lại] (viewer cũ) · `ORDER_COURSE_UNAVAILABLE` “Không thể mua khóa học này.” · `COURSE_NOT_FOUND` · `PAYMENT_UNAVAILABLE` “Thanh toán tạm thời không khả dụng.” + [Thử lại] · `ORDER_RATE_LIMITED` “Bạn thao tác quá nhanh, hãy thử lại sau.” · 401/403 → login/“Bạn không có quyền.”.

### 2a-2 Bài khóa trong khóa trả phí

- Cây: bài thường `🔒` + tooltip “Hãy mua khóa học để tiếp tục.”; click (đăng nhập, chưa mua) → **không** `POST /start`; mở Dialog “Hãy mua khóa học để tiếp tục.” [Hủy] [Mua khóa học] (cùng luồng POST đơn ở 2a-1). Guest → Dialog đăng nhập như course-free.
- Mở thẳng URL bài thường khi chưa mua (`403 COURSE_PURCHASE_REQUIRED`): vùng nội dung thay bằng card khóa “Hãy mua khóa học để tiếp tục.” + [Mua khóa học]; cây vẫn hiện. Bài preview vẫn mở như cũ, cuối bài hiện khối “Mua khóa học để học tiếp và lưu tiến độ.”.

### 2b-1 Chi tiết đơn `/me/orders/:orderCode` — desktop, đang chờ

```
┌ Sidebar ┬──────────────────────────────────────────────────────────────────────┐
│         │ ‹ Đơn hàng của tôi                                                   │
│         │ Đơn TV000000000123  (Chờ Admin xác nhận)     Tạo 15/11 · Hết hạn 16/11 10:42│
│         │ Khóa: Spring Boot từ A đến Z            Tổng: 350.000 ₫              │
│         │ ┌ Chuyển khoản ngân hàng ─────────────────┐ ┌ Quét mã VietQR ───────┐│
│         │ │ NGÂN HÀNG   <bankId>                      │ │ ┌───────────────────┐ ││
│         │ │ SỐ TÀI KHOẢN 0123456789             [⧉]   │ │ │   ảnh QR 280×280  │ ││
│         │ │ CHỦ TÀI KHOẢN NGUYEN VAN A                │ │ │  (imageUrl, động)  │ ││
│         │ │ SỐ TIỀN     350.000 ₫               [⧉]   │ │ └───────────────────┘ ││
│         │ │ NỘI DUNG    TV000000000123          [⧉]   │ │ Mở app ngân hàng, quét││
│         │ │ ⚠ Nhập đúng nội dung để Admin đối chiếu.  │ │ mã; kiểm tra số tiền. ││
│         │ └───────────────────────────────────────────┘ └───────────────────────┘│
│         │ ┌ Sau khi chuyển khoản ──────────────────────────────────────────────┐ │
│         │ │ Quyền học chỉ mở khi Admin đối chiếu sao kê. Khóa học đã mua không   │ │
│         │ │ được hoàn tiền.                                                      │ │
│         │ │ [Tôi đã chuyển khoản]   [⟳ Làm mới trạng thái]                       │ │
│         │ └──────────────────────────────────────────────────────────────────────┘ │
└─────────┴──────────────────────────────────────────────────────────────────────┘
```

- Mọi dữ liệu chuyển khoản lấy từ `vietQr` của API (ngân hàng, tài khoản, tên, số tiền, nội dung, `imageUrl`); client không tự dựng số tiền/nội dung. `[⧉]` copy từng dòng (số tài khoản, số tiền dạng số thuần, nội dung), nút đổi “Đã sao chép” 2 giây, live region.
- **Không** coi QR hiển thị, chuyển khoản hay quay lại trang là thành công. [⟳ Làm mới trạng thái] gọi `GET /orders/{code}` theo thao tác người dùng, không polling; `PAID` thì hiện mục 2b-4.
- **[Tôi đã chuyển khoản]** (chỉ đơn PENDING/EXPIRED chưa có `transferReportedAt`): `POST …/transfer-report`; đang gửi khóa nút; thành công (hoặc gọi lại → 200) đổi khối thành “Đã báo cho Admin lúc {transferReportedAt}; quyền học được mở sau khi Admin đối chiếu.” và nút biến mất (không bấm lại). Lỗi: `409 ORDER_TRANSFER_REPORT_NOT_ALLOWED` “Đơn này không cần báo chuyển khoản.” + tải lại đơn; `404`; `429` “Bạn thao tác quá nhanh…”.
- Ảnh QR lỗi (`onError`/không có `vietQr`): khung QR thay bằng “Không tải được QR; dùng thông tin chuyển khoản bên dưới.” [Tải lại ảnh]; khối thông tin chuyển khoản vẫn đủ. `vietQr` thiếu hẳn (backend chưa cấu hình tài khoản) → cùng cách, không hiện bảng rỗng.
- **Mobile 390:** một cột, thứ tự: tiêu đề + badge → tổng tiền → QR (full width, tối đa 280) → bảng thông tin (mỗi dòng nhãn trên, giá trị dưới, `[⧉]` 44 px) → nút [Tôi đã chuyển khoản] full width, [Làm mới] phụ.

### 2b-2 Các trạng thái đơn

| Trạng thái | Nội dung vùng chính | Hành động |
|---|---|---|
| `PENDING` (còn hạn) | Mục 2b-1 + dòng “Còn lại ~23 giờ” | [Tôi đã chuyển khoản] · [Làm mới] |
| `PENDING` + đã báo | Khối “Đã báo cho Admin lúc …; quyền học được mở sau khi Admin đối chiếu.” (tone info) | [Làm mới] |
| `EXPIRED` | Alert amber “Đơn đã hết hạn; liên hệ Admin nếu đã chuyển khoản.” **giữ nguyên QR + thông tin** (tiền về sau vẫn được xác nhận) | [Tôi đã chuyển khoản] (nếu chưa báo) · [Mua lại khóa học] → `POST /orders` tạo đơn mới rồi mở |
| `PAID` | Alert green “Đã nhận tiền · Vào học”; ẩn QR/thông tin chuyển khoản; hiện `paidAt` | [Vào học] → overview khóa |
| `FAILED`/`CANCELLED` | Alert rose “Đơn này không còn hiệu lực.” ẩn QR | [Mua lại khóa học] |

- Người học không thấy cờ đối chiếu/trùng (API chủ đơn không trả `needsReconciliation`); đơn `PAID` chỉ có [Vào học].
- Khóa đã bị ẩn/gỡ sau khi mua: [Vào học] theo luật course-free (404 → `EmptyState` chung); không xử lý riêng.

### 2b-3 Danh sách `/me/orders`

```
│ Đơn hàng của tôi  (7 đơn)                                   [‹ Khóa học]   │
│ ┌ hàng ──────────────────────────────────────────────────────────────────┐│
│ │▌TV000000000123 · Spring Boot từ A đến Z          350.000 ₫               ││
│ │ (Chờ Admin xác nhận) (Đã báo chuyển khoản)  Tạo 15/11 · Hết hạn 16/11   ││
│ │                                            [Xem đơn / Chuyển khoản ›]    ││
│ ├────────────────────────────────────────────────────────────────────────┤│
│ │ TV000000000098 · React cơ bản   200.000 ₫  (Đã nhận tiền) 10/11 [Vào học ›]│
│ │ TV000000000071 · …              (Hết hạn)                  [Xem đơn ›]   ││
│ └────────────────────────────────────────────────────────────────────────┘│
│                         ‹ 1 2 ›                                             │
```

- Mới nhất trước (backend); phân trang `AdminPagination`-style (`Pagination` Reader). Viền trái amber cho đơn `PENDING`. Cả hàng là link tới chi tiết; nút phụ: PAID → [Vào học ›], còn lại [Xem đơn ›]. Badge phụ “Đã báo chuyển khoản” khi `transferReportedAt`.
- **Mobile:** hàng xếp dọc (mã + khóa, số tiền, badge, nút full width 44).
- Loading 4 hàng `▓`. Empty: icon `Receipt`, “Bạn chưa có đơn hàng nào” + [Khám phá khóa học]. Error + [⟳ Thử lại].

### 2b-4 Trạng thái chung trang đơn

- Loading: tiêu đề `▓` + khối thông tin 5 dòng `▓` + khung QR `▓`. 404 `ORDER_NOT_FOUND`: `EmptyState` “Không tìm thấy đơn.” + [Đơn hàng của tôi]. Mạng/5xx: card lỗi + [⟳ Thử lại]. 401: về login + return URL.

---

## 3. Tác giả

### 3a Giá trong editor khóa `/author/courses/:id/edit` — mục “Thông tin khóa học”

```
│ TIÊU ĐỀ* …   CHỦ ĐỀ* …   TRÌNH ĐỘ …   THẺ …                                │
│ GIÁ (VND)  [ 350000 ______ ₫ ]   ( ) Miễn phí                              │
│   ⓘ Miễn phí hoặc từ 10.000 đến 50.000.000 ₫. Đổi giá có hiệu lực ngay cho đơn mới.│
│   Nền tảng giữ 20%, bạn nhận 280.000 ₫      ← từ commissionRateBps của API  │
│   ⓘ Khóa đã công khai không đổi giữa miễn phí và trả phí.                   │
```

- Ô số nguyên (chỉ chữ số, hiển thị nhóm nghìn khi blur); công tắc “Miễn phí” đặt 0. Dòng “Nền tảng giữ {rate}%, bạn nhận {amount}” tính phía client **chỉ để xem**: `amount = giá − floor(giá × bps / 10000)` với `commissionRateBps` từ response (không hard-code 20%); server là nguồn cuối. Giá 0 → ẩn dòng.
- Lỗi: client kiểm sơ bộ 0 hoặc 10.000–50.000.000 (dưới ô, “Giá khóa học không hợp lệ.”); server `400 COURSE_PRICE_INVALID` cùng câu; `409 COURSE_PRICE_TYPE_LOCKED` “Không thể đổi loại giá của khóa đã công khai.” — khi `publishedVersion` đã có, **khóa sẵn** công tắc chuyển loại (chỉ sửa giữa các giá dương, hoặc giữ 0) và hiện ghi chú, vẫn xử lý 409 nếu bị đua.
- Giá lưu cùng autosave `PATCH action=SAVE` hiện có; không qua duyệt (giá độc lập kiểm duyệt): đổi giá khóa đang công khai **không** tạo nhãn “Có thay đổi chưa xuất bản”. Ghi chú dưới ô: “Giá được áp dụng ngay, không cần gửi duyệt.” Đơn cũ giữ giá/tỷ lệ lúc tạo.
- Workspace `/author/courses`: hàng hiện chip giá `(Miễn phí)`/`(350.000 ₫)` cạnh trình độ. **Moderator** (list + detail) không có chip, ô, dòng giá.

### 3b Doanh thu `/author/revenue` — desktop

```
┌ Sidebar ┬──────────────────────────────────────────────────────────────────────┐
│         │ (Không gian tác giả)                                                  │
│         │ Doanh thu tác giả                                                     │
│         │ ┌ Số đơn ──┐ ┌ Tổng bán ────┐ ┌ Nền tảng giữ ─┐ ┌ Bạn nhận ──────┐   │
│         │ │ 12       │ │ 4.200.000 ₫  │ │ 840.000 ₫     │ │ 3.360.000 ₫    │   │
│         │ └──────────┘ └──────────────┘ └───────────────┘ └────────────────┘   │
│         │ ⓘ Số liệu theo tỷ lệ tại thời điểm mỗi đơn được tạo.                  │
│         │ ┌ hàng ──────────────────────────────────────────────────────────┐  │
│         │ │ Spring Boot từ A đến Z      Thanh toán 15/11 10:42              │  │
│         │ │ Giá 350.000 ₫ · Nền tảng giữ 20% (70.000 ₫) · Bạn nhận 280.000 ₫│  │
│         │ ├────────────────────────────────────────────────────────────────┤  │
│         │ └────────────────────────────────────────────────────────────────┘  │
│         │                         ‹ 1 2 3 ›                                    │
└─────────┴──────────────────────────────────────────────────────────────────────┘
```

- Bốn ô số liệu = `totals` của server (`itemCount`, `grossAmount`, `platformAmount`, `authorAmount`), không cộng lại ở client, không là filter. Hàng = `items` (khóa, `paidAt`, `unitPriceAmount`, `commissionRateBps`/100 %, `commissionAmount`, `authorNetAmount`), mới nhất trước; **không có thông tin người mua**, không có chữ “đã chi trả/thanh toán cho bạn”.
- Mobile: 4 ô thành lưới 2×2; hàng xếp dọc (khóa, ngày, ba dòng số).
- Loading 4 ô + 4 hàng `▓`. Empty: icon `Wallet`, “Chưa có doanh thu” + “Doanh thu hiện khi có người học thanh toán khóa của bạn.”. Error + [⟳ Thử lại]. 403 → trang “Bạn không có quyền.”.

---

## 4. Admin (Task 2c)

### 4c-1 Đơn hàng `/admin/orders` — desktop

```
┌ Sidebar ┬──────────────────────────────────────────────────────────────────────┐
│         │ Đơn hàng                                                  (42 đơn)    │
│         │ ┌ Bộ lọc ─────────────────────────────────────────────────────────┐  │
│         │ │ [⚲ Mã đơn TV…  ⏎ ✕] [Trạng thái ▾]                               │  │
│         │ │ (Tất cả)(Chờ)(Đã nhận)(Hết hạn)  [☐ Đã báo chuyển khoản]          │  │
│         │ │ [☐ Cần đối chiếu]                                                 │  │
│         │ └─────────────────────────────────────────────────────────────────┘  │
│         │ ┌ hàng ──────────────────────────────────────────────────────────┐  │
│         │ │▌TV000000000123 · Spring Boot…  350.000 ₫   (Hết hạn)           │  │
│         │ │ Nguyễn Văn B · b@mail.com · Tạo 15/11 · Hết hạn 16/11          │  │
│         │ │ (Người học đã báo chuyển khoản 15/11 10:50)                    │  │
│         │ │                                      [Đối chiếu & xác nhận]    │  │
│         │ ├────────────────────────────────────────────────────────────────┤  │
│         │ │▌TV…098 · React cơ bản  200.000 ₫ (Đã nhận tiền)                │  │
│         │ │ (⚠ Có khoản thanh toán trùng cần đối chiếu)    [Xem · Đối chiếu] │  │
│         │ └────────────────────────────────────────────────────────────────┘  │
│         │                         ‹ 1 2 3 ›                                    │
└─────────┴──────────────────────────────────────────────────────────────────────┘
```

- Lọc = `status`, `code` (khớp **chính xác**, đặt placeholder “Mã đơn đầy đủ, vd. TV000000000123”), `transferReported`, `needsReconciliation`; đồng bộ URL, phân trang `AdminPagination`. Mặc định: trạng thái Chờ, mới nhất trước.
- Hàng: viền trái amber khi `PENDING`/`EXPIRED` **và** đã báo chuyển khoản (ưu tiên nhìn); viền trái rose khi `needsReconciliation`. Badge: trạng thái, “Người học đã báo chuyển khoản {thời điểm}” (`transferReportedAt`), “⚠ Có khoản thanh toán trùng cần đối chiếu” (cờ mở) / “Đã đối chiếu” (cờ đóng, có `reconciledAt`). **Cờ báo chuyển khoản không phải xác nhận**: nhãn kèm tooltip “Cần kiểm tra sao kê trước khi xác nhận.”.
- Hiện tên + email người mua (`buyerName`, `buyerEmail`). Đơn `PAID` bình thường: chỉ xem, không nút xác nhận.
- Mobile: bộ lọc gập trong card (Sheet đáy khi bấm [⚲ Bộ lọc]); hàng xếp dọc; nút full width 44.
- Loading 5 hàng `▓`. Empty “Không có đơn phù hợp” + [Xóa bộ lọc]. Error + [⟳ Thử lại].

### 4c-2 Xác nhận thanh toán — Sheet phải 480 px (mobile: toàn màn hình)

```
│ Xác nhận đơn TV000000000123                                       ✕ │
│ Spring Boot từ A đến Z · Nguyễn Văn B                              │
│ Số tiền cần nhận (theo đơn)        350.000 ₫                       │
│ ⓘ Kiểm tra sao kê ngân hàng (mã đơn, số tiền) trước khi xác nhận.   │
│ SỐ TIỀN TRÊN SAO KÊ*  [ 350000 ______ ₫ ]  ← điền sẵn, sửa nếu khác │
│ MÃ GIAO DỊCH SAO KÊ*  [____________________________] 0/255        │
│ (Đã nhận 1 khoản: ref ABC123 · 350.000 ₫ · 15/11)  ← khi có payments│
│                                  [Hủy]   [Kiểm tra lại…]           │
```

- Ô số tiền **điền sẵn** bằng tổng đơn (`amount` của API, người dùng chốt 2026-11-15), Admin sửa lại nếu sao kê khác; mã giao dịch để trống. Vì dễ bấm theo thói quen, bước kiểm tra lại vẫn bắt buộc và nhãn ô ghi rõ “theo sao kê”. [Kiểm tra lại…] (khóa khi trống/không hợp lệ) mở `AlertDialog` “Xác nhận đã nhận {amount} ₫ cho đơn TV…, mã giao dịch {ref}? Hành động ghi nhận thanh toán và mở quyền học.” [Quay lại] [Xác nhận đã nhận tiền]. So khớp client **không** quyết định; server so số tiền.
- Validation client: số nguyên dương; mã giao dịch trim 1–255 → `400 PAYMENT_INVALID` “Thông tin đối chiếu không hợp lệ.” dưới ô.
- Lỗi theo mã (Alert đầu Sheet, giữ giá trị đã nhập, không tự retry): `PAYMENT_AMOUNT_MISMATCH` “Số tiền không khớp đơn; hãy đối chiếu sao kê.” · `PAYMENT_STATE_INVALID` “Không thể xác nhận đơn ở trạng thái này.” + [Tải lại] · `PAYMENT_REFERENCE_CONFLICT` “Mã giao dịch đã được dùng hoặc không khớp.” · `ORDER_NOT_FOUND` · `ACCESS_DENIED`/401.
- Thành công `200`: đóng Sheet, **tải lại danh sách từ server** (không sửa cục bộ). Câu thành công theo kết quả: “Đã ghi nhận thanh toán.” hoặc, khi đơn đã PAID/đã có quyền từ đơn khác, “Đã ghi nhận; cần đối chiếu khoản thanh toán trùng.” (đọc `needsReconciliation` sau khi tải lại, hiện ở Alert đầu trang vì chưa có toast).
- Đơn `PAID` + cờ mở: [Xem · Đối chiếu] mở **cùng Sheet** ở chế độ “Khoản thanh toán” (danh sách `payments`: mã, số tiền, nguồn, thời điểm) + khối “Có khoản thanh toán trùng cần đối chiếu — tiền thừa xử lý ngoài hệ thống, không hoàn tiền trong sản phẩm.” + ô ghi thêm khoản trùng (cùng form amount + reference, cho PAID đúng 1c) + [Đóng cờ đối chiếu].
- **[Đóng cờ đối chiếu]** → `AlertDialog` “Đánh dấu đã đối chiếu {n} khoản thanh toán của đơn này?” → `POST …/reconcile {paymentCount: n}` (n = số khoản Admin đang xem). Lỗi: `409 PAYMENT_RECONCILIATION_STALE` “Có khoản thanh toán mới; hãy xem lại danh sách.” + tự tải lại Sheet (cờ giữ nguyên) · `409 PAYMENT_RECONCILIATION_NOT_REQUIRED` “Không có khoản cần đối chiếu.” + tải lại · `404`. Thành công: “Đã đối chiếu.”

### 4c-3 Hoa hồng `/admin/commission` — desktop

```
│ Tỷ lệ hoa hồng nền tảng                                                      │
│ ┌ Hiện hành ────────────────────────────────────────────────────────────┐   │
│ │ Nền tảng giữ  20%   (2000 bps)     Hiệu lực từ 14/11/2026 09:00        │   │
│ │ ⓘ Đổi tỷ lệ có hiệu lực ngay cho đơn mới; đơn đã tạo giữ tỷ lệ cũ.      │   │
│ └────────────────────────────────────────────────────────────────────────┘   │
│ ┌ Đổi tỷ lệ ───────────────────────────────────────────────────────────┐   │
│ │ TỶ LỆ MỚI (%)* [ 15 ____ ]  = 1500 bps     [Lưu tỷ lệ]               │   │
│ │ Ví dụ: khóa 350.000 ₫ → nền tảng giữ 52.500 ₫, tác giả nhận 297.500 ₫ │   │
│ └────────────────────────────────────────────────────────────────────────┘   │
```

- Nhập theo **phần trăm** (0–100, tối đa 2 chữ số thập phân → bps nguyên; không chấp nhận nhiều hơn, vì API chỉ nhận `rateBps` nguyên 0–10000). Dòng ví dụ tính client chỉ để minh họa, giá mẫu cố định, `floor` như spec.
- [Lưu tỷ lệ] → `AlertDialog` “Đổi tỷ lệ nền tảng giữ thành {x}% ngay bây giờ? Áp dụng cho đơn tạo từ lúc này.” [Hủy] [Đổi tỷ lệ]. Thành công: tải lại policy từ server, Alert “Đã cập nhật tỷ lệ.” (hoặc “Tỷ lệ hiện tại không đổi.” khi trùng). Lỗi `400 COMMISSION_RATE_INVALID` “Tỷ lệ không hợp lệ.” dưới ô; 401/403 như chung.
- Chưa có policy (`data: null`): thẻ “Hiện hành” báo “Chưa có tỷ lệ; thanh toán tạm thời không khả dụng.” (tone amber); [Lưu tỷ lệ] tạo policy đầu tiên.
- **Không có** lịch sử policy, đặt lịch, sửa policy cũ (API chỉ trả policy hiện hành). Mobile: hai card xếp dọc, nút full width.
- Loading 2 card `▓`. Error + [⟳ Thử lại].

---

## 5. Copy chính vi/en (bổ sung bảng trong spec)

| vi | en |
|---|---|
| Miễn phí / Mua khóa học / Mua lại khóa học | Free / Buy course / Buy again |
| Đơn hàng của tôi / Đơn hàng / Hoa hồng / Doanh thu | My orders / Orders / Commission / Revenue |
| Chuyển khoản ngân hàng / Quét mã VietQR | Bank transfer / Scan VietQR |
| Ngân hàng / Số tài khoản / Chủ tài khoản / Số tiền / Nội dung | Bank / Account number / Account name / Amount / Transfer note |
| Nhập đúng nội dung để Admin đối chiếu. | Use the exact transfer note so an admin can match it. |
| Làm mới trạng thái / Đã sao chép | Refresh status / Copied |
| Đơn này không còn hiệu lực. | This order is no longer valid. |
| Người học đã báo chuyển khoản {time} / Cần kiểm tra sao kê trước khi xác nhận. | Buyer reported a transfer {time} / Check the bank statement before confirming. |
| Số tiền trên sao kê / Mã giao dịch sao kê | Statement amount / Statement reference |
| Xác nhận đã nhận tiền / Đóng cờ đối chiếu | Confirm payment received / Close reconciliation flag |
| Có khoản thanh toán mới; hãy xem lại danh sách. | A new payment arrived; review the list again. |
| Tỷ lệ mới / Đổi tỷ lệ / Đã cập nhật tỷ lệ. / Tỷ lệ hiện tại không đổi. | New rate / Change rate / Rate updated. / The current rate is unchanged. |
| Đã báo cho Admin; quyền học được mở sau khi Admin đối chiếu. | Reported to admin; access opens after the admin verifies the transfer. |
| Tổng bán / Số đơn | Gross sales / Orders |
| Chưa có doanh thu | No revenue yet |

Copy lỗi theo mã: bảng Task 1a–1d trong spec; mã lạ dùng fallback chung. `PAYMENT_RECONCILIATION_STALE` chưa có trong bảng spec (thêm ở 1c, log “Lệch 9”).

## 6. Dữ liệu và biên kỹ thuật cần nhớ khi code

- Tiền: số nguyên VND, định dạng bằng `Intl.NumberFormat`, không float. Chuỗi `payment amount` nhập vào gửi dạng **số nguyên JSON** (chuỗi/số thực bị 400).
- `imageUrl` VietQR dùng nguyên từ API (đã encode); `<img>` có `alt` “Mã VietQR đơn {code}”, `referrerpolicy="no-referrer"`. VietQR giới hạn 10 ảnh/10 giây/IP: không tự tải lại ảnh theo vòng lặp.
- Không giữ khóa giá/tỷ lệ ở client: sau mỗi mutation tải lại từ server. Moderator: không import type/hook/service tiền vào màn Moderator.
- Quay lại từ Dialog login: dùng `rememberReturnTo` hiện có; sau login về `/courses/:id` thì người dùng tự bấm Mua (không tự tạo đơn).

## 7. Câu hỏi chốt cho người dùng

1. **Route đơn người học:** `/me/orders` và `/me/orders/:orderCode` (cạnh `/me/courses`), mục Sidebar “Đơn hàng của tôi” dưới “Góc của tôi”. Khác: gộp thành tab trong `/me/courses`.
2. **Bấm Mua mở trang đơn riêng** (không Dialog/Sheet), rồi người học tự chuyển khoản và báo. Khác: hiện QR ngay trong Sheet ở overview.
3. **Admin xác nhận bằng Sheet phải + hộp thoại kiểm tra lại**, số tiền điền sẵn theo đơn (đã chọn phương án này).
4. **Hoa hồng nhập theo phần trăm** (tối đa 2 chữ số thập phân), không hiện lịch sử policy vì API chưa có.
5. **Không có huy hiệu số đơn cần xử lý** ở Sidebar Admin; Admin vào `/admin/orders` lọc “Đã báo chuyển khoản”/“Cần đối chiếu”.
6. **Người học không thấy cờ “trùng/cần đối chiếu”** (chỉ Admin thấy); đơn PAID người học chỉ có [Vào học].
7. **Khóa đã công khai khóa sẵn công tắc Miễn phí ↔ trả phí** ngay trên form (không chờ lỗi 409).

## Kết luận người dùng đã duyệt

- **2026-11-15:** người dùng duyệt wireframe, đồng ý cả 7 câu ở mục 7, riêng câu 3 chọn phương án khác: ô số tiền xác nhận của Admin **điền sẵn** theo đơn (vẫn có bước kiểm tra lại). Task 2a–2c code theo file này + spec.
