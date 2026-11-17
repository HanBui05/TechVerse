# Author payout — Wireframe cổng trước Task 2a/2b/2c

Trạng thái: **chờ người dùng duyệt** (viết 2026-11-16). Nguồn chuẩn: `author-payout.md` (phạm vi + copy 2a/2b/2c) + contract thật ở DTO backend (`AuthorRevenueResponse`, `PayoutResponse`, `AdminRevenueResponse`, `AdminPayoutResponse`, `CourseStudentsResponse`), `docs/design/UI_GUIDE.md`, nền phong cách `course-payment.wireframe.md`. File chỉ chốt bố cục, luồng, trạng thái; mọi số liệu/nút có endpoint ở 1a–1d, không thêm chức năng. Copy vi/en lấy nguyên từ bảng “Copy vi/en” của spec.

Ký hiệu: `[Nút]` · `(Badge)` · `▾` select · `▓` Skeleton · `⟳` thử lại · `⧉` copy · `×` gỡ nhãn · `📅` ô ngày. Icon thật là `lucide-react`. Desktop 1440, mobile 390.

**Ngoài màn:** chi một phần, tự động chi, hoàn tiền, xuất CSV, sửa/xóa khoản chi, email học viên cho tác giả, biểu đồ doanh thu.

## 0. Phong cách và quy ước chung

- Card, Badge `statusTone`/`toneFor`, nhãn trường 11 px in hoa, `Pagination`/`AdminPagination`, Alert tone, `EmptyState`. Dark mặc định, light chọn được; chỉ token, không màu mới. Danh sách là hàng trong Card (không Table, theo UI_GUIDE).
- Tiền `1.250.000 ₫`, `tabular-nums`. Ngày chọn bằng `Calendar` + `Popover`.
- Bộ lọc nằm trên URL (`?from=&to=&courseId=&tab=` / `?q=&progress=&page=`); đổi bộ lọc về `page=0`.
- Vùng bấm ≥ 44 px trên cảm ứng; focus ring; contrast ≥ 4.5:1; motion tắt khi `prefers-reduced-motion`.

## 1. Route và menu

| Route | Ai vào | Ghi chú |
|---|---|---|
| `/author/revenue` | `AUTHOR` | có sẵn, mở rộng (2a) |
| `/author/courses/:id/students` | `AUTHOR` chủ khóa | mới (2c); khóa không phải của mình → 404 |
| `/admin/revenue` | `ADMIN` | mới (2b) |
| `/admin/payouts` | `ADMIN` | mới (2b) |

```
AdminSidebar, nhóm THANH TOÁN
  Đơn hàng
  Hoa hồng
  Doanh thu            ← mới (/admin/revenue)
  Chi trả tác giả      ← mới (/admin/payouts)
```

Sidebar tác giả không đổi (mục “Doanh thu” đã có).

---

## 2. Tác giả — `/author/revenue` (Task 2a)

### 2-1 Desktop, tab “Lượt bán”

```
┌ Sidebar ┬─────────────────────────────────────────────────────────────────────┐
│         │ Doanh thu                                                           │
│         │ ┌ Alert (chỉ khi chưa khai TK) ──────────────────────────────────┐ │
│         │ │ Hãy khai tài khoản ngân hàng để nhận doanh thu.  [Khai tài khoản]│ │
│         │ └────────────────────────────────────────────────────────────────┘ │
│         │ THEO BỘ LỌC                                                         │
│         │ ┌Lượt bán─┐┌Tổng thu──┐┌Hoa hồng sàn┐┌Phần của bạn┐                │
│         │ │   12    ││ 4.200.000││  840.000   ││ 3.360.000  │                │
│         │ └─────────┘└──────────┘└────────────┘└────────────┘                │
│         │ TOÀN THỜI GIAN  ⓘ Tính trên toàn bộ thời gian, không theo bộ lọc.   │
│         │ ┌Đã nhận──────────┐┌Chờ chi──────────┐                              │
│         │ │ 2.000.000 ₫     ││ 1.360.000 ₫     │                              │
│         │ └─────────────────┘└─────────────────┘                              │
│         │ [Lượt bán]  Theo khóa   Chi trả                                     │
│         │ Từ ngày [📅 01/11/2026]  Đến ngày [📅 16/11/2026]  [Xóa bộ lọc]      │
│         │ Đang lọc: (Khóa Java cơ bản ×)                                      │
│         │ ┌ hàng ──────────────────────────────────────────────────────────┐ │
│         │ │ Khóa Java cơ bản          15/11 10:42     350.000 ₫             │ │
│         │ │ Hoa hồng 20% −70.000 ₫                    Bạn nhận 280.000 ₫    │ │
│         │ └────────────────────────────────────────────────────────────────┘ │
│         │ … ·                                       ‹ 1 2 3 ›                 │
└─────────┴─────────────────────────────────────────────────────────────────────┘
```

- Bốn ô trên đổi theo bộ lọc; hai ô “Đã nhận”, “Chờ chi” (toàn thời gian) có nhãn nhóm riêng nên không bị hiểu là theo bộ lọc.
- Nhãn “Đang lọc: {khóa} ×” chỉ hiện khi có `courseId`; bấm × gỡ.
- `from > to`: ô “Đến ngày” viền lỗi + dòng “Khoảng ngày không hợp lệ.”, không gọi API.

### 2-2 Tab “Theo khóa”

```
│ Lượt bán   [Theo khóa]   Chi trả                                            │
│ (cùng thanh bộ lọc ngày; không có nhãn khóa)                                │
│ ┌ hàng bấm được ─────────────────────────────────────────────────────────┐ │
│ │ Java cơ bản            8 lượt   Tổng 2.800.000   HH 560.000   Bạn 2.240.000 ›│ │
│ └────────────────────────────────────────────────────────────────────────┘ │
```

Bấm một hàng → chuyển sang tab “Lượt bán” với `courseId` đó (nhãn gỡ được).

### 2-3 Tab “Chi trả”

```
│ Lượt bán   Theo khóa   [Chi trả]                                            │
│ ┌ Tài khoản nhận tiền ───────────────────────────────────── [Sửa] ───────┐ │
│ │ NGÂN HÀNG  Vietcombank      SỐ TÀI KHOẢN  0123456789                    │ │
│ │ CHỦ TÀI KHOẢN  NGUYEN VAN A                                             │ │
│ │ ⓘ Nền tảng chuyển khoản thủ công; thời gian nhận tùy đợt chi.           │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
│ Lịch sử chi trả                                                             │
│ ┌ 15/11/2026 10:42   1.360.000 ₫   Mã sao kê FT26319…   TK …6789 ┐          │
│ └────────────────────────────────────────────────────────────────┘          │
│                                                     ‹ 1 2 ›                  │
```

- Chưa khai: khối tài khoản thành `EmptyState` nhỏ + [Khai tài khoản]; Alert đầu trang như 2-1 (hiện ở mọi tab).
- Form “Tài khoản nhận tiền” mở trong **Sheet** (480 px desktop, toàn màn hình mobile): NativeSelect ngân hàng (từ `banks`), số tài khoản, tên chủ tài khoản, [Lưu] [Hủy]. Lỗi 400 `PAYOUT_ACCOUNT_INVALID` hiện Alert đầu Sheet; lưu xong đóng Sheet + toast “Đã lưu tài khoản nhận tiền.”
- Số tài khoản trong lịch sử chỉ hiện 4 ký tự cuối (backend đã che).

### 2-4 Mobile (390)

```
Doanh thu
[Alert chưa khai TK + nút]
THEO BỘ LỌC
┌Lượt bán 12┐ (xếp dọc 4 thẻ)
TOÀN THỜI GIAN
┌Đã nhận┐ ┌Chờ chi┐
Lượt bán | Theo khóa | Chi trả   (tab cuộn ngang không cần: 3 nhãn vừa)
Từ ngày [📅]      (xếp dọc)
Đến ngày [📅]
[Xóa bộ lọc]
Đang lọc: (Java ×)
┌ thẻ lượt bán ──────────┐
│ Khóa Java cơ bản       │
│ 15/11  350.000 ₫       │
│ HH −70.000 · Nhận 280.000│
└────────────────────────┘
```

Theo khóa: mỗi khóa một thẻ (không bảng). Lịch sử chi: mỗi khoản một thẻ. Không cuộn ngang.

### 2-5 Trạng thái

| Trạng thái | Hiển thị |
|---|---|
| Đang tải | ▓ cho ô tổng, ▓ ba hàng danh sách |
| Lỗi tải | Alert lỗi + [⟳ Thử lại] trong vùng bị lỗi |
| Chưa khai TK | Alert đầu trang + khối rỗng tab Chi trả |
| Lịch sử rỗng | “Chưa có khoản chi nào.” |
| Lọc rỗng | “Không có lượt bán nào trong khoảng đã chọn.” |
| `REVENUE_FILTER_INVALID` (400 từ server) | Alert “Khoảng ngày không hợp lệ.” đầu danh sách |

---

## 3. Admin — `/admin/revenue` (Task 2b)

```
┌ Sidebar ┬─────────────────────────────────────────────────────────────────────┐
│         │ Doanh thu                                                           │
│         │ Từ ngày [📅]  Đến ngày [📅]  [Xóa bộ lọc]                           │
│         │ THEO BỘ LỌC                                                         │
│         │ ┌Đơn đã trả┐┌Tổng thu┐┌Hoa hồng sàn┐┌Phần tác giả┐                  │
│         │ TOÀN THỜI GIAN                                                      │
│         │ ┌Tác giả được hưởng┐┌Đã chi┐┌Còn nợ┐          [Chi trả tác giả ›]   │
│         │ (cả ba ô là link sang /admin/payouts)                               │
│         │ ┌ hàng ──────────────────────────────────────────────────────────┐ │
│         │ │ Java cơ bản · Nguyễn Văn A     8 lượt                           │ │
│         │ │ Thu 2.800.000   HH 560.000   Tác giả 2.240.000                  │ │
│         │ └────────────────────────────────────────────────────────────────┘ │
│         │                                           ‹ 1 2 3 ›                 │
└─────────┴─────────────────────────────────────────────────────────────────────┘
```

Mobile: ô tổng xếp dọc, bộ lọc xếp dọc, mỗi khóa một thẻ. Trạng thái: tải (▓), lỗi (Alert + ⟳), rỗng “Không có lượt bán nào trong khoảng đã chọn.”.

---

## 4. Admin — `/admin/payouts` (Task 2b)

### 4-1 Danh sách, tab “Công nợ”

```
│ Chi trả tác giả                                                             │
│ [Công nợ]   Lịch sử chi                                                     │
│ ☐ Hiện cả tác giả đã chi đủ                                                 │
│ ┌ hàng (viền trái amber khi còn nợ) ─────────────────────────────────────┐ │
│ │ (av) Nguyễn Văn A  a@mail.com                                           │ │
│ │ ĐÃ KIẾM 3.360.000   ĐÃ CHI 2.000.000   CÒN NỢ 1.360.000   [Chi trả]    │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
```

Mobile: mỗi tác giả một thẻ, [Chi trả] full-width. Rỗng: “Không còn khoản nào phải chi.”.

### 4-2 Sheet “Chi trả” (480 px desktop, toàn màn hình mobile)

```
┌ Chi trả — Nguyễn Văn A ───────────────────────── × ┐
│ [Alert lỗi API nếu có]                              │
│ SỐ TIỀN CẦN CHUYỂN      1.360.000 ₫ (cố định)       │
│ ┌ QR trắng ┐   NGÂN HÀNG Vietcombank                 │
│ │ VietQR   │   SỐ TK 0123456789 ⧉                    │
│ └──────────┘   CHỦ TK NGUYEN VAN A ⧉                 │
│ ⚠ Đối chiếu tên chủ tài khoản app ngân hàng hiện ra │
│   với tên bên dưới trước khi chuyển.                │
│ MÃ SAO KÊ  [____________________]                   │
│ [Ghi nhận đã chuyển]                                │
│ ─ Lịch sử chi của tác giả này ─                     │
│  15/11  1.000.000 ₫  FT26319…                       │
└─────────────────────────────────────────────────────┘
```

- Bấm [Ghi nhận đã chuyển] → AlertDialog “Ghi nhận đã chuyển 1.360.000 ₫ cho Nguyễn Văn A? Không sửa được sau khi ghi.” [Hủy] [Xác nhận].
- Thành công: Sheet đóng, dòng cập nhật, toast “Đã ghi nhận khoản chi.”; nếu `accountChanged` hiện thêm Alert cảnh báo (copy spec) trước khi đóng.
- Lỗi: `PAYOUT_EXCEEDS_BALANCE` → Alert + tải lại số nợ trong Sheet; `PAYOUT_REFERENCE_CONFLICT`, `PAYOUT_INVALID` → Alert tại Sheet.
- Chưa có tài khoản: không có QR/form, chỉ Alert “Tác giả chưa khai tài khoản nhận tiền.”.
- QR lỗi tải: vẫn hiện thông tin chuyển khoản, chỗ QR thành khung “Không tải được mã QR”.

### 4-3 Tab “Lịch sử chi”

```
│ Công nợ   [Lịch sử chi]                                                     │
│ ┌ 15/11 10:42  Nguyễn Văn A   1.360.000 ₫   FT26319…                       │
│ │ Vietcombank 0123456789 · NGUYEN VAN A     Ghi bởi: Admin Trần            │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                     ‹ 1 2 ›                  │
```

Mới nhất trước, phân trang; rỗng “Chưa có khoản chi nào.”. Mobile: mỗi khoản một thẻ.

---

## 5. Tác giả — `/author/courses/:id/students` (Task 2c)

```
┌ Sidebar ┬─────────────────────────────────────────────────────────────────────┐
│         │ ‹ Khóa học của tôi                                                  │
│         │ Học viên · Java cơ bản                                              │
│         │ ┌Tổng học viên┐┌Chưa học┐┌Đã hoàn thành┐                             │
│         │ │     48      ││   10   ││     12      │                             │
│         │ [🔍 Tìm theo tên học viên    ]  [Tất cả ▾]                          │
│         │ ┌ hàng ──────────────────────────────────────────────────────────┐ │
│         │ │ (av) Lê Thị B   Vào học 10/11   Học gần nhất 15/11              │ │
│         │ │ 7/20 bài  ▓▓▓▓▓░░░░░░░░                                         │ │
│         │ └────────────────────────────────────────────────────────────────┘ │
│         │ (Chưa học bài nào) khi 0 bài                     ‹ 1 2 3 ›          │
└─────────┴─────────────────────────────────────────────────────────────────────┘
```

- Không hiện email. Ô tìm debounce, đổi → `page=0`; select tiến độ: Tất cả / Chưa học / Đang học / Đã hoàn thành.
- Ba ô tổng không đổi theo bộ lọc (backend).
- Mobile: ô tổng và bộ lọc xếp dọc, mỗi học viên một thẻ (avatar + tên, hai dòng ngày, thanh tiến độ full-width).
- Trạng thái: tải (▓), lỗi (Alert + ⟳), rỗng “Khóa học chưa có học viên.”, lọc rỗng “Không có học viên khớp bộ lọc.”, 404 `EmptyState` “không tìm thấy khóa học” + link về danh sách khóa, `COURSE_STUDENT_FILTER_INVALID` Alert “Bộ lọc không hợp lệ.”.

### Điểm vào

- `AuthorCoursesPage`: mỗi thẻ khóa thêm dòng “{count} học viên” là link sang trang trên.
- `CourseEditorPage`: thêm link “Học viên” cạnh các hành động hiện có.

---

## 6. Điểm cần người dùng chốt khi duyệt

1. Doanh thu tác giả chia **ba tab** (Lượt bán / Theo khóa / Chi trả), hai ô “Đã nhận / Chờ chi” nằm trên tab, luôn thấy ở mọi tab — đúng spec; đồng ý?
2. Form tài khoản nhận tiền dùng **Sheet** (spec ghi “form”, chưa nói Sheet) — đề xuất Sheet cho thống nhất với Admin.
3. Trang `/admin/revenue` và `/admin/payouts` tách riêng như spec (không gộp một trang hai tab).
