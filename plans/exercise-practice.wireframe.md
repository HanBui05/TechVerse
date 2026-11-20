# Exercise practice — Wireframe cổng trước Task 2a–2c

Trạng thái: **đã duyệt 2026-11-17** (người dùng chốt “theo ý Claude”: cả 5 mục ở mục 9 giữ khuyến nghị; viết cùng ngày). Nguồn chuẩn: `exercise-practice.md` (bảng mã lỗi 1a/1b/1c, phạm vi/copy/UI của 2a–2c) + contract thật ở `exercise-practice.log.md`. Nền phong cách: `course-free.wireframe.md` mục 0, `docs/design/UI_GUIDE.md`. File chỉ chốt bố cục, luồng, trạng thái; không thêm chức năng ngoài spec.

Ký hiệu như `course-free.wireframe.md`: `[Nút]` · `(Badge)` · `▓` Skeleton · `⟳` thử lại · `✦` AI · `✓`/`✗` đúng/sai · `⚠` cảnh báo · `▸` mục chọn được. Icon thật là `lucide-react`, không emoji. Desktop 1440, mobile 390. Copy lấy nguyên từ “Copy vi/en” của spec; chỗ spec chưa có chữ thì ghi “(copy mới)” để Task code bổ sung vào `exerciseI18n`.

**Ngoài màn (không vẽ, không làm):** tính giờ, bảng xếp hạng, thống kê theo chủ đề, lưu bài làm dở, lặp lại ngắt quãng, lưu/bình luận/báo cáo bộ, ảnh trong câu hỏi, nhập file, thông báo cho tác giả, ô số liệu ở màn Moderator, loại `CODE_BUG_FINDING`/`DEBUG_SCENARIO`.

## 0. Nguyên tắc chung

- Token/primitive có sẵn (`Card`, `Badge`, `Button`, `Input`, `Textarea`, `NativeSelect`, `AlertDialog`, `Dialog`, `Sheet`, `Pagination`, `EmptyState`, `Skeleton`), không màu mới, không gradient. Dark mặc định, kiểm cả light. `MarkdownContent` cho mọi chỗ hiện câu hỏi/giải thích/mặt thẻ (không ảnh).
- Badge trạng thái dùng `statusTone`: Bản nháp (neutral) · Chờ duyệt (warning) · Đang công khai (success) · Cần sửa (warning) · Đã ẩn (neutral) · Bị ẩn bởi kiểm duyệt (danger) · Đã gỡ (danger). Badge loại: Trắc nghiệm / Flashcard (outline). Badge độ khó: Dễ / Vừa / Khó (outline).
- Đúng/sai luôn có **biểu tượng + chữ**, không chỉ màu. Vùng bấm ≥ 44px trên cảm ứng, focus ring `ring`, contrast ≥ 4.5:1, không cuộn ngang ở 390. Hiệu ứng (lật thẻ, thanh tiến độ, skeleton) tắt khi `prefers-reduced-motion`.
- Mọi danh sách có đủ: tải (`▓`) · rỗng · lỗi (“Dịch vụ đang gián đoạn. Hãy thử lại.” + `[⟳ Thử lại]`). Mọi nút gọi API khóa khi đang chạy.
- Lỗi theo mã: chữ lấy từ cột “Copy hiển thị” của bảng 1a/1b/1c; mục 7 gom lại theo màn.

---

## 1. Tác giả — danh sách `/author/exercises`

Desktop (khung trang Tác giả; sidebar nhóm Tác giả có mục “Bài tập”):

```
│ Bài tập của tôi                                   [+ Tạo bộ bài tập]  │
│ [Trạng thái ▾ Tất cả] [Loại ▾ Tất cả] [🔍 Tìm theo tiêu đề…        ]  │
│ ┌───────────────────────────────────────────────────────────────────┐ │
│ │ Tiêu đề                 Loại     Câu  Trạng thái          Cập nhật│ │
│ │ SQL cơ bản              (Trắc…)  12   (Đang công khai)    16/11   │ │
│ │  (Có dùng AI)                         [Tạo bản sao][Ẩn]           │ │
│ │ Từ vựng React           (Flash…)  8   (Cần sửa)           15/11   │ │
│ │  ⚠ Ghi chú của Moderator: “Thẻ 3 thiếu…”   [Sửa][Gửi lại…]       │ │
│ │ Git nâng cao            (Trắc…)   0   (Bản nháp)          14/11   │ │
│ │                                           [Sửa][Xóa]              │ │
│ └───────────────────────────────────────────────────────────────────┘ │
│                          ‹ 1 2 3 ›                                    │
```

Nút theo trạng thái (đúng bảng 1a; nút không hợp lệ thì **ẩn**, không vô hiệu):

| Trạng thái | Nút trong hàng |
|---|---|
| Bản nháp | Sửa · Tạo bản sao · Xóa |
| Chờ duyệt | Xem (chỉ đọc) · Rút lại · Tạo bản sao |
| Cần sửa | Sửa · Tạo bản sao · Xóa (nếu chưa từng công khai) · hiện ghi chú Moderator |
| Đang công khai | Xem (chỉ đọc) · Tạo bản sao · Ẩn |
| Đã ẩn (do tôi) | Xem · Tạo bản sao · Hiện lại |
| Bị ẩn bởi kiểm duyệt / Đã gỡ | Xem · Tạo bản sao; hiện lý do của Moderator, không có Ẩn/Hiện |

- “Xóa” và “Gửi duyệt” qua `AlertDialog` (xóa: “Xóa bộ bài tập này? Không thể hoàn tác.” (copy mới)). Xóa bộ từng công khai/đang chờ duyệt không hiện nút; nếu server vẫn trả `EXERCISE_NOT_DELETABLE` thì hiện lỗi trong hộp thoại.
- Dòng phụ dưới tiêu đề: (Có dùng AI) khi `aiAssisted` (tác giả thấy nhãn của mình).
- Rỗng (chưa có bộ nào): `EmptyState` “Bạn chưa có bộ bài tập nào.” + `[+ Tạo bộ bài tập]` (copy mới). Rỗng do lọc: “Không có bộ nào khớp bộ lọc.” + `[Xóa lọc]`.
- Tác giả bị đình chỉ: dải cảnh báo đầu trang “Bạn không có quyền.” (copy 403) + vẫn xem/xóa được; nút Tạo/Sửa/Gửi bị ẩn.
- Tạo/sao chép quá nhanh → `EXERCISE_RATE_LIMITED` hiện toast lỗi.

Mobile 390: mỗi bộ là một thẻ, thay bảng; bộ lọc gập thành hai ô xếp dọc; nút hành động dồn xuống hàng cuối thẻ (cao 44), nút Xóa tách bằng `…` (menu) để không chạm nhầm.

```
┌──────────────────────────────┐
│ Bài tập của tôi              │
│ [+ Tạo bộ bài tập          ] │
│ [Trạng thái ▾][Loại ▾]       │
│ [🔍 Tìm…                   ] │
│ ┌──────────────────────────┐ │
│ │ SQL cơ bản               │ │
│ │ (Trắc nghiệm)(Vừa) 12 câu│ │
│ │ (Đang công khai)(Có dùng AI)│
│ │ [Tạo bản sao]  [Ẩn]  [⋯] │ │
│ └──────────────────────────┘ │
```

## 2. Tác giả — trình soạn `/author/exercises/new` và `/:id/edit`

Một trang, hai khối: **Thông tin** (trên) và **Câu hỏi** (dưới), thanh hành động dính đầu trang.

Desktop (cột chính ~760px + cột phải 340px cho Xem trước / panel AI):

```
│ ‹ Bài tập của tôi    SQL cơ bản (Bản nháp)    [Xem trước] [Lưu] [Gửi duyệt]│
│ ⚠ Moderator yêu cầu sửa: “Thẻ 3 thiếu…”   ← chỉ khi (Cần sửa)             │
├──────────────────────────────────────────────┬───────────────────────────┤
│ THÔNG TIN                                    │ ✦ Tạo câu hỏi bằng AI      │
│ Tiêu đề*      [__________________________]   │ (xem mục 3)               │
│ Mô tả         [__________________________]   │                           │
│               0/2.000                        │                           │
│ Chủ đề*       [Chọn chủ đề ▾]                │                           │
│ Độ khó*       (•) Dễ ( ) Vừa ( ) Khó         │                           │
│ Loại*         (•) Trắc nghiệm ( ) Flashcard  │                           │
│               ⓘ Không đổi được sau khi tạo.  │                           │
│                                              │                           │
│ CÂU HỎI (3/50)  Cần ít nhất 3 câu để gửi duyệt│                           │
│ ┌ Câu 1 ───────────────── [↑][↓][Sửa][Xóa] ┐ │                           │
│ │ SELECT khác gì …?                        │ │                           │
│ │ ✓ A. …   B. …   C. …   D. …             │ │                           │
│ └──────────────────────────────────────────┘ │                           │
│ [+ Thêm câu hỏi]                             │                           │
```

- Khi tạo mới (`/new`): chỉ khối Thông tin + `[Tạo]`; sau khi tạo chuyển sang `/:id/edit` để thêm câu (API tạo bộ không nhận câu). Loại chỉ chọn được ở đây; ở `/edit` hiện chữ (read-only) kèm chú thích.
- **Hai nút lưu tách theo API:** Thông tin (PATCH metadata) và Câu hỏi (PUT thay toàn bộ) cùng bấm `[Lưu]` ở thanh đầu — nút lưu cả hai theo thứ tự, dùng `version` mới sau mỗi lần ghi. Trong chưa lưu, nút có chấm “•” và rời trang hiện cảnh báo “Bạn có thay đổi chưa lưu. Rời trang?”.
- `[Gửi duyệt]` bật khi đủ (≥ 3 câu / ≥ 5 thẻ) và không còn thay đổi chưa lưu (bấm khi chưa lưu → lưu trước rồi hỏi xác nhận). Chưa đủ: nút khóa, dòng chú thích “Cần ít nhất 3 câu trắc nghiệm (hoặc 5 thẻ) để gửi duyệt.” Xác nhận `AlertDialog`: “Gửi bộ bài tập này để Moderator duyệt?” (copy mới).

### 2a. Soạn một câu (Dialog trên desktop, trang con toàn màn hình trên mobile)

Trắc nghiệm:

```
┌ Câu 2 ───────────────────────────────────── ✕ ┐
│ Nội dung*   [Markdown…                       ] │ 0/2.000
│ Mã nguồn    [ ] Thêm đoạn code
│             Ngôn ngữ [javascript   ]  [code…  ] │ ≤ 5.000
│ Lựa chọn*   (○) [A. ______________________][✕]│
│             (●) [B. ______________________][✕]│  ← nút tròn = đáp án đúng
│             [+ Thêm lựa chọn]   (2–6 lựa chọn) │
│ Giải thích* [Markdown…                       ] │ 0/2.000
│ [Xem trước]                    [Hủy] [Xong]    │
└────────────────────────────────────────────────┘
```

Flashcard:

```
│ Mặt trước*  [………………………] 0/1.000
│ Mặt sau*    [………………………] 0/1.000
│ Giải thích  [………………………] 0/2.000   (tùy chọn)
```

- Lỗi hiện **ngay dưới ô**, kèm tổng kết trên đầu hộp thoại “Câu {n}: thông tin chưa hợp lệ.” / “Thẻ {n}: …”: lựa chọn trùng, thiếu đáp án đúng, thiếu ngôn ngữ khi có code, ô vượt giới hạn, ảnh Markdown `![…](…)` hoặc HTML thô → “Nội dung chứa định dạng không được hỗ trợ.” (`EXERCISE_CONTENT_INVALID`).
- `[Xong]` chỉ cập nhật danh sách đang soạn (chưa gọi API); chỉ `[Lưu]` mới ghi.
- Thứ tự: nút `[↑][↓]` (có `aria-label` “Chuyển lên/xuống”), không kéo-thả (giữ một đường cho bàn phím và cảm ứng).

### 2b. Xem trước (Dialog / mobile toàn màn hình)

Trình bày đúng như người học thấy (mục 6/7), dùng dữ liệu đang soạn, có đáp án hiện sẵn (nhãn “Đáp án đúng”) vì tác giả là người ra đề. Không nộp, không ghi. Nút `[Đóng]`.

### 2c. Chỉ đọc (Chờ duyệt / Đang công khai / Đã ẩn / Bị ẩn / Đã gỡ)

- Mọi ô khóa, ẩn `[+ Thêm]`, `[Lưu]`, `[Xóa]`, `[↑][↓]`; thay bằng dải thông tin: “Bộ đã công khai không sửa được. Hãy tạo bản sao để chỉnh sửa.” (đang công khai/ẩn) hoặc “Bộ bài tập đang ở trạng thái không sửa được.” (chờ duyệt…). Nút đầu trang: `[Tạo bản sao]` + (nếu hợp lệ) `[Rút lại]` / `[Ẩn]` / `[Hiện lại]`.
- Xung đột `EXERCISE_VERSION_CONFLICT`: `Dialog` “Bộ bài tập đã được sửa ở nơi khác. Hãy tải lại trước khi lưu.” + `[Tải lại]` (giữ bản đang soạn trong bộ nhớ để người dùng so, chọn Tải lại sẽ bỏ).
- Mở id không phải của mình / không tồn tại → trang “Không tìm thấy bộ bài tập.” + `[Về danh sách]`.

### 2d. Mobile 390

- Thanh hành động dính đáy (`Lưu` · `Gửi duyệt`, cao 44, safe-area); khối Thông tin và Câu hỏi xếp dọc; mỗi câu là thẻ gập (tiêu đề dòng đầu, chạm để mở); panel AI thành `Sheet` toàn màn hình mở từ nút `[✦ Tạo bằng AI]` trên đầu khối Câu hỏi.

## 3. Tác giả — panel “Tạo câu hỏi bằng AI”

Cột phải (desktop) / Sheet (mobile). Chỉ bật khi bộ sửa được; ở chỉ đọc thì ẩn.

```
┌ ✦ Tạo câu hỏi bằng AI ────────────────────┐
│ ⓘ AI có thể sai. Hãy kiểm tra trước khi    │
│   dùng. Kết quả chưa được lưu vào bộ.      │
│ Yêu cầu      [________________________]    │ ≤ 500
│ Nội dung nguồn (dán vào)                    │
│              [________________________]    │ ≤ 8.000
│ Số câu       [ 5 ▾ ]  (1–10)               │
│ Còn 10/10 lượt hôm nay                      │
│ [✦ Tạo câu hỏi]                             │
└─────────────────────────────────────────────┘
```

Sau khi tạo (đang chờ: nút thành “Đang tạo…” khóa, `aria-busy`, ô nhập khóa; không stream, tối đa theo timeout server):

```
│ AI tạo được 4/5 câu. Hãy kiểm tra trước khi dùng.   ← chỉ in “n/count”
│ ┌ [✓] Câu đề xuất 1            [Xem/Sửa] ┐
│ │ SELECT khác gì …? A.… B.… ✓C.… D.…     │
│ └────────────────────────────────────────┘
│ ┌ [✓] Câu đề xuất 2 …                    │
│ [Chọn tất cả] [Bỏ chọn]   [Thêm câu đã chọn (2)]
```

- Mọi đề xuất chọn sẵn; `[Xem/Sửa]` mở lại hộp soạn câu (mục 2a) để sửa trước khi thêm. “Thêm câu đã chọn” đưa vào cuối danh sách đang soạn (chưa lưu), xóa các đề xuất đã thêm; vượt 50 câu → lỗi “Mỗi bộ tối đa 50 câu.” và không thêm. Đề xuất còn lại giữ cho tới khi rời trang.
- Body gọi AI luôn kèm `version` đang giữ (quyết định 2026-11-17; đang có thay đổi chưa lưu thì lưu trước, rồi mới gọi). Sau mỗi lần tạo, `version` mới trả về dùng cho lần `[Lưu]` sau. Cờ “Có dùng AI” đã đặt ở server; tác giả thấy nhãn trong danh sách.
- Lượt còn lại lấy từ header phản hồi/`GET …/ai/quota` (`exercise`); đang tải → `▓`; lỗi đọc quota → ẩn dòng, vẫn cho gửi (server quyết). Hết lượt (`remaining = 0`): nút khóa, dòng “Bạn đã dùng hết lượt AI hôm nay.”

| Mã | Copy | Ghi chú |
|---|---|---|
| `VALIDATION_ERROR` (instruction/source/count) | Yêu cầu tối đa 500 ký tự. / Nội dung nguồn tối đa 8.000 ký tự. / Số câu từ 1 đến 10. | Lỗi dưới ô, không gọi API |
| `EXERCISE_QUESTIONS_INVALID` (409) | Mỗi bộ tối đa 50 câu. | |
| `AI_OUTPUT_INVALID` | AI trả về nội dung không dùng được. Hãy thử lại. | |
| `AI_OUTPUT_TRUNCATED` | Kết quả bị cắt. Hãy giảm số câu. | |
| `AI_RATE_LIMITED` / `AI_QUOTA_EXCEEDED` | Bạn thao tác quá nhanh. / Bạn đã dùng hết lượt AI hôm nay. | |
| `AI_GENERATION_IN_PROGRESS` | AI đang xử lý yêu cầu trước. | Gồm cả đang sinh bản nháp bài viết |
| `AI_PROVIDER_*`, `AI_TIMEOUT`, `AI_STORAGE_UNAVAILABLE`, `AI_CONFIGURATION_INVALID` | Dịch vụ AI đang gián đoạn. Hãy thử lại. | |
| `EXERCISE_VERSION_CONFLICT` | Như mục 2c | Giữ nguyên đề xuất để không mất kết quả AI |
| `EXERCISE_NOT_EDITABLE` / 404 / 403 | Như bảng 1a | Panel khóa |

## 4. Moderator — danh sách `/moderator/exercises`

Theo chuẩn màn duyệt bài viết, **không có ô số liệu**.

```
│ Bài tập                                                              │
│ [Trạng thái ▾ Chờ duyệt] [Loại ▾] [Chủ đề ▾] [🔍 Tìm…            ]   │
│ ┌──────────────────────────────────────────────────────────────────┐ │
│ │ Tiêu đề / Tác giả          Loại  Câu  Trạng thái     Gửi lúc    │ │
│ │ SQL cơ bản                 (Trắc…) 12 (Chờ duyệt)    16/11 09:10│ │
│ │  Nguyễn A · (Có dùng AI)  ⚠ Tác giả không còn đủ điều kiện       │ │
│ └──────────────────────────────────────────────────────────────────┘ │
```

- Mặc định lọc “Chờ duyệt”; các giá trị khác: Đang công khai, Cần sửa, Đã ẩn (tác giả), Bị ẩn bởi kiểm duyệt, Đã gỡ. Không có “Bản nháp” (API không trả).
- Nhãn `(Có dùng AI)`; cảnh báo vàng “Tác giả không còn đủ điều kiện” khi `authorEligible = false` (Duyệt sẽ bị chặn, vẫn cho Yêu cầu sửa/Ẩn/Gỡ).
- Rỗng: “Không có bộ bài tập nào.” (copy mới). Lỗi: “Dịch vụ đang gián đoạn. Hãy thử lại.” + `[⟳]`. Mobile: thẻ thay bảng như mục 1.

## 5. Moderator — chi tiết `/moderator/exercises/:id`

```
│ ‹ Bài tập   SQL cơ bản (Chờ duyệt) (Trắc nghiệm) (Vừa) (Có dùng AI)  │
│ Tác giả: Nguyễn A · Chủ đề: SQL · 12 câu                             │
│ ⚠ Tác giả không còn đủ điều kiện   ← khi áp dụng                     │
│ Ghi chú lần duyệt trước: “…”        ← nếu có                         │
│ ┌ Câu 1 ───────────────────────────────────────────────────────────┐ │
│ │ SELECT khác gì …?                                                │ │
│ │  A. …                                                            │ │
│ │  ✓ B. …   (Đáp án đúng)                                          │ │
│ │ Giải thích: …                                                    │ │
│ └──────────────────────────────────────────────────────────────────┘ │
│ (flashcard: Mặt trước / Mặt sau / Giải thích)                        │
├──────────────────────────────────────────────────────────────────────┤
│ Hành động (dính đáy desktop): [Duyệt] [Yêu cầu sửa]                  │
```

| Trạng thái | Nút |
|---|---|
| Chờ duyệt | Duyệt · Yêu cầu sửa |
| Đang công khai / Đã ẩn (tác giả) | Ẩn · Gỡ |
| Bị ẩn bởi kiểm duyệt | Khôi phục · Gỡ |
| Cần sửa / Đã gỡ | Chỉ đọc, không có nút ghi (bảng 1b: HIDE/REMOVE không áp dụng) |

- Duyệt: `AlertDialog` xác nhận, ghi chú tùy chọn (≤ 1.000). Yêu cầu sửa / Ẩn / Gỡ: `Dialog` có ô lý do **bắt buộc** (“Hãy ghi lý do (tối đa 1.000 ký tự).”), đếm `n/1.000`, nút xác nhận khóa khi rỗng.
- Gỡ là thao tác cuối: hộp thoại ghi “Gỡ không hoàn tác được.” (copy mới), nút đỏ.
- Không tự thử lại thao tác duyệt khi lỗi; thành công thì tải lại từ server và hiện toast.

| Mã | Hiển thị |
|---|---|
| `EXERCISE_REVIEW_STALE` | Dải cảnh báo trên đầu + `[Tải lại]`: “Bộ bài tập đã thay đổi. Hãy tải lại trước khi duyệt.” Mọi nút ghi khóa tới khi tải lại |
| `EXERCISE_STATE_INVALID` | Không thực hiện được ở trạng thái hiện tại. + `[Tải lại]` |
| `EXERCISE_AUTHOR_INELIGIBLE` / `EXERCISE_TOPIC_INACTIVE` / `EXERCISE_NOT_READY` | Tác giả không còn đủ điều kiện. / Chủ đề đã ngừng hoạt động. / Bộ bài tập chưa đủ điều kiện. (trong hộp thoại, giữ hộp mở) |
| 404 `EXERCISE_SET_NOT_FOUND` | “Không tìm thấy bộ bài tập.” + `[Về danh sách]` (cả khi bộ vừa bị chuyển về DRAFT) |
| 401/403 | Bạn không có quyền. |

Mobile 390: thân xếp một cột, câu hỏi thẻ gập, thanh hành động dính đáy (nút chính `Duyệt` + `⋯` chứa các nút còn lại).

---

## 6. Người học — khu Luyện tập

Sidebar người đọc có mục “Luyện tập”. Trang trong `ReaderRoute`; Guest xem được danh sách và giới thiệu.

### 6a. Danh sách `/practice`

```
│ Luyện tập                                                              │
│ [Chủ đề ▾][Độ khó ▾][Loại ▾][🔍 Tìm bộ bài tập…                    ]   │
│ ┌────────────────────┐ ┌────────────────────┐ ┌────────────────────┐   │
│ │ SQL cơ bản         │ │ Từ vựng React      │ │ Git nâng cao       │   │
│ │ (Trắc nghiệm)(Vừa) │ │ (Flashcard)(Dễ)    │ │ (Trắc nghiệm)(Khó) │   │
│ │ 12 câu · SQL       │ │ 8 thẻ · React      │ │ 20 câu · Git       │   │
│ │ Tác giả: Nguyễn A  │ │ Tác giả: Trần B    │ │ Tác giả: Lê C      │   │
│ │ Lần gần nhất:      │ │ Lần gần nhất:      │ │ (chưa làm / Guest  │   │
│ │ 9/12 (75%)  16/11  │ │ Đã nhớ 6/8         │ │  không hiện dòng)  │   │
│ └────────────────────┘ └────────────────────┘ └────────────────────┘   │
│                           ‹ 1 2 3 ›                                    │
```

- Lưới 3 cột desktop, 2 cột tablet, 1 cột mobile; cả thẻ là một liên kết tới `/practice/:id`. Liên kết “Lịch sử luyện tập” ở đầu trang (chỉ khi đã đăng nhập) → `/me/practice`.
- Rỗng không có bộ nào: “Chưa có bộ bài tập nào.” (copy mới). Rỗng do lọc: “Không có bộ nào khớp bộ lọc.” + `[Xóa lọc]`. Lỗi: có `[⟳ Thử lại]`.
- Bộ lọc nằm trong query string (chia sẻ, F5 giữ nguyên); mobile: bộ lọc xếp dọc, chủ đề + độ khó cùng hàng.

### 6b. Giới thiệu `/practice/:id`

```
│ ‹ Luyện tập                                                            │
│ SQL cơ bản                                                             │
│ (Trắc nghiệm)(Vừa)(SQL) · 12 câu · Tác giả: Nguyễn A                  │
│ Mô tả (Markdown)…                                                      │
│ ┌ Lần gần nhất của bạn: 9/12 (75%) · 16/11   [Xem lại] ┐ ← đã đăng nhập │
│ [Bắt đầu]            hoặc Guest: [Đăng nhập để làm bài]               │
```

| Người xem | Hiển thị |
|---|---|
| Đã đăng nhập, được làm | `[Bắt đầu]` → `/practice/:id/attempt` |
| Guest | `[Đăng nhập để làm bài]` → `/login` với `returnTo` = trang này |
| Chủ bộ | Nút khóa + dòng “Bạn không thể làm bộ bài tập của chính mình.” |
| ADMIN/MODERATOR | Không tới trang (`ReaderRoute`) |
| Bộ ẩn/gỡ/không tồn tại | Trang “Bộ bài tập không còn khả dụng.” + `[Về danh sách]` |

Mobile: nút Bắt đầu dính đáy (cao 44, safe-area).

### 6c. Làm trắc nghiệm `/practice/:id/attempt`

Desktop (cột nội dung ~720px giữa trang, danh sách câu bên phải 240px):

```
│ SQL cơ bản                                  Câu 3/12   ▓▓▓░░░░░░░ 25%  │
├────────────────────────────────────────────┬───────────────────────────┤
│ Câu hỏi (Markdown, code cuộn trong khung)   │ Danh sách câu             │
│                                            │ [1✓][2✓][3●][4 ][5 ] …    │
│ ( ) A. …                                   │ ✓ đã trả lời  ● đang xem  │
│ (●) B. …           ← chọn, chưa có đúng/sai │ ○ chưa trả lời            │
│ ( ) C. …                                   │                           │
│ ( ) D. …                                   │                           │
│                                            │                           │
│ [‹ Câu trước]  [Câu sau ›]       [Nộp bài] │                           │
```

- Không có đáp án/giải thích/đúng-sai trước khi nộp. Chọn lại được; bấm lại lựa chọn đang chọn để bỏ chọn. Radio thật (`role="radiogroup"`), nhãn “A.”, phím tắt `1`–`6` chọn lựa chọn (chỉ khi focus không ở ô nhập/nút; không chặn trình đọc màn hình), `←/→` qua lại câu.
- Danh sách câu: nút ô vuông 44px, trạng thái bằng **biểu tượng + chữ ẩn** (“Câu 4, chưa trả lời”), chạm nhảy tới câu.
- `[Nộp bài]`: còn câu trống → `AlertDialog` “Còn {n} câu chưa trả lời. Vẫn nộp?” `[Làm tiếp]` `[Nộp]`; đủ câu → nộp luôn (không hỏi lại).
- Đang nộp: nút “Đang nộp…” khóa, mọi lựa chọn khóa; mỗi lần nộp tạo `Idempotency-Key` mới, lỗi mạng thì `[Thử lại]` dùng **cùng khóa**.
- Rời trang (liên kết, nút Back, đóng tab): cảnh báo “Bài làm chưa nộp sẽ bị mất. Rời trang?”. Tải lại (F5) = làm lại từ đầu, không báo thêm.
- Tải câu hỏi: skeleton; lỗi: `[⟳ Thử lại]`; 401 → `/login` có returnTo.

Mobile 390: một cột; trên cùng “Câu 3/12” + thanh tiến độ; lựa chọn là thẻ rộng cao ≥ 44 xếp dọc; thanh dưới dính đáy: `[‹]` `[Danh sách câu ▾]` `[›]` + `[Nộp bài]` ở hàng riêng; “Danh sách câu” mở `Sheet` đáy có lưới ô.

### 6d. Làm flashcard

```
│ Từ vựng React                                Thẻ 2/8   ▓▓░░░░░░░░ 25% │
│        ┌───────────────────────────────────────────┐                   │
│        │  Mặt trước (Markdown)                     │  ← bấm thẻ/Space  │
│        │                                           │    hoặc [Lật thẻ] │
│        └───────────────────────────────────────────┘                   │
│                          [Lật thẻ]                                     │
│  (sau khi lật: mặt sau + giải thích nếu có)                            │
│                 [✗ Chưa nhớ]        [✓ Đã nhớ]                         │
```

- Chưa lật thì **chưa có** nút Đã nhớ/Chưa nhớ (khóa tới khi lật xong). Bấm Đã nhớ/Chưa nhớ → sang thẻ kế; thẻ cuối → tự nộp (không xác nhận), nộp `results` + `Idempotency-Key`.
- Có `[‹ Thẻ trước]` để sửa lựa chọn của thẻ trước. Thẻ lật bằng xoay 3D; khi giảm chuyển động thì chuyển ngay (không hoạt ảnh) và chỉ hiện một mặt tại một lúc. Mặt thẻ là nút `aria-pressed` + tên “Lật thẻ”; nội dung mặt sau `aria-live="polite"` khi lật.
- Mobile: thẻ chiếm gần hết chiều rộng, nút `Chưa nhớ`/`Đã nhớ` dính đáy, rộng nửa-nửa, cao 56.

### 6e. Kết quả (hiện ngay sau khi nộp, cùng khung `/attempt`; dùng lại cho `/me/practice/:attemptId`)

Trắc nghiệm:

```
│ Bạn đúng 9/12 câu (75%)                                               │
│ [Làm lại]  [Về danh sách]                                             │
│ ┌ Câu 1 ──── ✓ Đúng ──────────────────────────────────────────────┐  │
│ │ SELECT khác gì …?                                                │  │
│ │ Bạn chọn: B. …   (✓ Đúng)                                        │  │
│ │ Giải thích: …                                                    │  │
│ └──────────────────────────────────────────────────────────────────┘  │
│ ┌ Câu 2 ──── ✗ Sai ───────────────────────────────────────────────┐   │
│ │ Bạn chọn: A. …  (✗ Sai)    Đáp án đúng: C. …                     │   │
│ │ Giải thích: …                                                    │   │
│ ┌ Câu 3 ──── ○ Bỏ trống ──────────────────────────────────────────┐   │
│ │ Bạn chọn: Bỏ trống         Đáp án đúng: B. …                     │   │
```

- Bộ lọc nhanh đầu danh sách: `[Tất cả] [Chỉ câu sai/bỏ trống]` (copy mới) — chỉ thu gọn danh sách, không gọi API.
- Flashcard: “Đã nhớ 6/8 thẻ” + danh sách “Thẻ chưa nhớ” (mặt trước, mặt sau, giải thích) + `[Ôn lại]` (làm lại cả bộ) và `[Về danh sách]`. Mọi nội dung lấy từ snapshot đã lưu.
- `[Làm lại]`/`[Ôn lại]` sang `/practice/:id/attempt` mới (tải câu hỏi lại); nếu bộ không còn khả dụng thì hiện “Bộ bài tập không còn khả dụng.” thay vì lỗi trắng. Xem lại lượt cũ của bộ đã ẩn/gỡ: không có nút Làm lại, hiện dòng muted “Bộ bài tập không còn khả dụng.”
- Mobile: cùng nội dung xếp dọc; `[Làm lại]` dính đáy.

### 6f. Lịch sử `/me/practice` và xem lại `/me/practice/:attemptId`

```
│ Lịch sử luyện tập                          [Bộ bài tập ▾ Tất cả]       │
│ ┌──────────────────────────────────────────────────────────────────┐   │
│ │ SQL cơ bản (Trắc nghiệm)   9/12 (75%)   2 phút     16/11 09:30   │ ▸ │
│ │ Từ vựng React (Flashcard)  Đã nhớ 6/8   1 phút     15/11 21:00   │ ▸ │
│ └──────────────────────────────────────────────────────────────────┘   │
│                           ‹ 1 2 3 ›                                    │
```

- Mới nhất trước; bấm hàng → `/me/practice/:attemptId` (mục 6e, có `[‹ Lịch sử]`). Bộ đã ẩn/gỡ vẫn xem được.
- Rỗng: “Chưa có lượt làm nào.” + `[Đến khu Luyện tập]`. Lỗi: `[⟳ Thử lại]`. Lượt của người khác/không tồn tại: “Không tìm thấy lượt làm.” + `[Về lịch sử]`.
- Mobile: hàng thành thẻ hai dòng (tên + loại / điểm + thời gian).

## 7. Lỗi theo màn Luyện tập (bảng 1b)

| Mã / tình huống | Hiển thị | Ở đâu |
|---|---|---|
| 404 `EXERCISE_SET_NOT_FOUND` | Bộ bài tập không còn khả dụng. + `[Về danh sách]` | Giới thiệu, làm bài (cả khi bị ẩn giữa chừng: thay vùng làm bài bằng thông báo, bài làm dở bị bỏ) |
| 401 `AUTH_ACCESS_TOKEN_REQUIRED` | Đăng nhập để làm bài. + `[Đăng nhập]` (returnTo) | Câu hỏi, nộp bài |
| 403 `ACCESS_DENIED` | Bạn không có quyền làm bộ bài tập này. | Câu hỏi, nộp |
| 400 `EXERCISE_ATTEMPT_INVALID` | Bài làm không hợp lệ. Hãy tải lại và làm lại. + `[Làm lại]` | Nộp |
| 409 `EXERCISE_ATTEMPT_KEY_CONFLICT` | Yêu cầu trùng. Hãy làm lại. + `[Làm lại]` | Nộp |
| 429 `EXERCISE_RATE_LIMITED` | Bạn thao tác quá nhanh, hãy thử lại sau. + `[Nộp lại]` (cùng khóa, câu trả lời giữ nguyên) | Nộp |
| 503 `EXERCISE_STORAGE_UNAVAILABLE` / mạng đứt / mã lạ | Dịch vụ đang gián đoạn. Hãy thử lại. + `[Thử lại]` (cùng khóa) | Nộp, tải |
| 404 `EXERCISE_ATTEMPT_NOT_FOUND` | Không tìm thấy lượt làm. | Xem lại |
| `VALIDATION_ERROR` (lọc/phân trang) | Tự đặt lại bộ lọc, không hiện lỗi thô | Danh sách |

Lỗi nộp hiện ở vùng thông báo trên nút Nộp (`role="alert"`, có icon `⚠` + chữ); **câu trả lời đã chọn không bị xóa** cho tới khi nộp thành công.

## 8. Trợ năng và focus (gộp)

- Lật thẻ, chọn đáp án, qua câu đều dùng được bằng bàn phím; phím tắt số/Space chỉ nhận khi focus nằm ngoài ô nhập/nút/lựa chọn đang có focus riêng.
- Kết quả và lỗi nộp: `role="alert"`/`aria-live`, chuyển focus vào tiêu đề kết quả “Bạn đúng …”. Đổi câu: focus vào tiêu đề câu.
- Dialog (soạn câu, lý do, xác nhận): focus vào ô đầu, Esc đóng, trả focus về nút gọi. Thứ tự Tab theo thứ tự đọc; không bẫy focus trong `Sheet` ngoài mặc định của primitive.
- Thanh tiến độ có `role="progressbar"` + `aria-valuenow`; biểu tượng đúng/sai có chữ ẩn “Đúng”/“Sai”/“Bỏ trống”.

## 9. Câu hỏi chốt cho người dùng

1. **Một nút `[Lưu]` ghi cả Thông tin và Câu hỏi** (hai API nối tiếp, mục 2) thay vì hai nút lưu riêng; lỗi giữa chừng báo rõ phần nào chưa lưu. Khuyến nghị: giữ một nút.
2. **Sắp xếp câu bằng nút `↑ ↓`**, không kéo-thả (mục 2a) — dùng được cho cảm ứng và bàn phím, ít mã.
3. **Không lưu bài làm dở** theo spec: rời trang cảnh báo, F5 làm lại từ đầu (mục 6c). Không thêm tự lưu cục bộ.
4. **Chi tiết nhỏ ngoài spec, bỏ nếu không muốn:** bộ lọc “Chỉ câu sai/bỏ trống” ở kết quả (6e); nút `[‹ Thẻ trước]` ở flashcard (6d); các dòng copy ghi “(copy mới)”.
5. **Số liệu Moderator:** xác nhận không vẽ ô số liệu như spec đã chốt (mục 4).
