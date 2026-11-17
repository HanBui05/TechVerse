# Course AI tutor — Wireframe cổng trước Task 2

Trạng thái: **chờ người dùng duyệt** (viết 2026-11-17). Nguồn chuẩn: `course-ai-tutor.md` (Task 1 bảng mã lỗi, Task 2 phạm vi/copy/UI) + contract thật ở `course-ai-tutor.log.md`. Nền phong cách: `course-free.wireframe.md` mục 0 và 2c-4/2c-5 (trang bài), `docs/design/UI_GUIDE.md`. File chỉ chốt bố cục, luồng, trạng thái; không thêm chức năng ngoài spec.

Ký hiệu như `course-free.wireframe.md`: `[Nút]` · `(Badge)` · `▓` Skeleton · `⟳` thử lại · `✦` AI · `■` Dừng · `▍` con trỏ stream. Icon thật là `lucide-react`, không emoji. Desktop 1440, mobile 390. Copy lấy nguyên từ bảng “Copy vi/en” của spec.

**Ngoài màn (không vẽ, không làm):** lưu/xem lại hội thoại cũ, thích/không thích, báo sai, chia sẻ, hỏi trên cả khóa, nút “Hỏi AI” ở overview hay khung khác ngoài trang bài.

## 0. Nguyên tắc

- Bảng trượt (`Sheet` bên phải) mở từ trang bài; tiêu đề “Trợ lý AI của bài học”. Chỉ token/primitive có sẵn, không màu mới, không gradient. Dark mặc định, kiểm cả light.
- Hội thoại giữ trong bộ nhớ trang: đóng/mở lại vẫn còn; đổi bài hoặc F5 thì xóa. Mỗi lần gửi kèm ≤ 6 tin gần nhất.
- Chuyển động (con trỏ nhấp nháy, trượt sheet) tắt khi `prefers-reduced-motion` (con trỏ tĩnh). Vùng bấm ≥ 44px trên cảm ứng, focus ring `ring`, contrast ≥ 4.5:1.

## 1. Nút mở trên trang bài

Desktop (cạnh H1, bên phải; không đụng cột TOC):

```
│ Khóa học › Tên khóa › Chương 1 › Bài 1                              │
│ Tên bài học (H1 30)  (Học thử)              [✦ Hỏi AI về bài này]   │
│ Tóm tắt bài (muted)                                                 │
```

Mobile 390 (dưới H1 và badge, full width, cao 44; thanh đáy ‹ ✓ › của trang bài giữ nguyên):

```
│ Tên bài học (H1 24)          │
│ (Học thử)                    │
│ [✦ Hỏi AI về bài này       ] │
```

| Người xem / bài | Nút |
|---|---|
| Đã đăng nhập, đọc được nội dung bài có chữ | Bật; bấm mở sheet |
| Guest, bài học thử có chữ | Hiện “Đăng nhập để hỏi AI”; bấm → `/login` kèm return URL là bài (cơ chế `returnTo`) |
| Bài chỉ video (không có chữ), ai cũng vậy | Vô hiệu (`aria-disabled`, vẫn focus được) + dòng phụ muted dưới nút: “Bài này chưa có nội dung chữ để AI dựa vào.” |
| Đang hiện card khóa 🔒 (chưa mua / chưa bắt đầu học / chủ khóa bài thường) | Không hiện nút (trang không có nội dung để hỏi) |
| ADMIN/MODERATOR | Không tới trang này (`ReaderRoute`) |

## 2. Sheet — desktop (rộng ~420px, trượt từ phải)

Trạng thái **trống** (mới mở):

```
┌ Trợ lý AI của bài học ──────────────── ✕ ┐
│ ⓘ AI chỉ dựa trên nội dung chữ của bài   │  ← lưu ý, muted, luôn hiện đầu sheet
│   này và có thể trả lời sai. Hãy đối      │
│   chiếu với bài học.                      │
│ ─────────────────────────────────────── │
│                                          │
│        ✦                                 │
│  Hỏi bất cứ điều gì bạn chưa hiểu        │
│  trong bài.                              │
│                                          │
│ ─────────────────────────────────────── │
│ Còn 20/20 câu hôm nay                    │
│ ┌ Nhập câu hỏi của bạn…            ┐[Gửi]│
│ └──────────────────────────────────┘ 0/500│
└──────────────────────────────────────────┘
```

Trạng thái **đang trả lời** (ô nhập mở nhưng Gửi khóa; [Dừng] thay [Gửi]):

```
│                      ┌──────────────────┐│
│                      │ Câu hỏi của bạn  ││  ← căn phải, nền muted
│                      └──────────────────┘│
│ ✦ AI                                     │  ← căn trái, không nền, nhãn “AI”
│ Câu trả lời hiện dần theo stream, render │
│ bằng MarkdownContent (đoạn, danh sách,   │
│ code cuộn trong khung)▍                  │  ← aria-live="polite"
│ ─────────────────────────────────────── │
│ Còn 20/20 câu hôm nay                    │
│ ┌ (ô nhập vẫn gõ được, Gửi khóa) ┐ [■ Dừng]│
```

Trạng thái **xong**: bỏ con trỏ; [Dừng] trở lại [Gửi]; quota cập nhật từ event kết thúc (“Còn 19/20 câu hôm nay”). Nếu `metadata.contextTruncated` → dòng muted dưới câu trả lời đó: “Bài học dài nên AI chỉ đọc phần đầu.”

Trạng thái **Dừng**: huỷ stream; phần đã nhận giữ nguyên, không có dòng lỗi; gọi lại quota (server có thể đã hoàn lượt nếu chưa nhận delta nào).

## 3. Trạng thái lỗi (hiện ngay dưới câu hỏi tương ứng, `text-danger`, có icon + chữ)

```
 ┌ Câu hỏi của bạn ┐
 ✦ AI
 (không có phần đã nhận)
 ⚠ Dịch vụ AI đang gián đoạn. Hãy thử lại.   [⟳ Thử lại]
```

```
 ✦ AI
 Phần đã nhận trước khi lỗi vẫn hiện…  (giữ nguyên, không xóa)
 ⚠ AI phản hồi quá lâu. Hãy thử lại.          [⟳ Thử lại]
```

| Mã (spec Task 1) | Copy | [Thử lại] | Ghi chú |
|---|---|---|---|
| `AI_PROVIDER_UNAVAILABLE` / `_REQUEST_REJECTED` / `_AUTH_FAILED` / `_RATE_LIMITED` | Dịch vụ AI đang gián đoạn. Hãy thử lại. | Có | |
| `AI_TIMEOUT` | AI phản hồi quá lâu. Hãy thử lại. | Có | |
| `AI_OUTPUT_TRUNCATED` | Câu trả lời bị cắt. Hãy hỏi cụ thể hơn. | Không | Cảnh báo (amber) dưới phần đã nhận; hỏi lại bằng câu khác |
| `AI_RATE_LIMITED` | Bạn hỏi quá nhanh, hãy thử lại sau ít phút. | Có | |
| `AI_GENERATION_IN_PROGRESS` | AI đang trả lời câu trước. | Có | Ví dụ mở hai tab |
| `AI_STORAGE_UNAVAILABLE` | Trợ lý AI tạm thời không khả dụng. | Có | |
| `AI_CONFIGURATION_INVALID` | Trợ lý AI chưa sẵn sàng. | Không | |
| `AI_TUTOR_LESSON_NO_CONTENT` | Bài này chưa có nội dung chữ để AI dựa vào. | Không | Đồng thời khóa nút mở/ô nhập |
| `COURSE_PURCHASE_REQUIRED` | Hãy mua khóa học để tiếp tục. | Không | Quyền đổi giữa chừng |
| `LESSON_PREVIEW_ONLY` | Hãy bắt đầu học khóa này để hỏi AI về bài. | Không | |
| `VALIDATION_ERROR` / `MALFORMED_REQUEST` | Không gửi được câu hỏi. Hãy tải lại trang. | Không | |
| 401 | Đăng nhập để hỏi AI. + [Đăng nhập] (return URL = bài) | Không | |
| 403 `ACCESS_DENIED`, `USER_INACTIVE` | Bạn không có quyền. | Không | |
| 404 `COURSE_NOT_FOUND` / `LESSON_NOT_FOUND` | Không tìm thấy khóa học / bài học. | Không | |
| Mã lạ / mạng đứt | Dịch vụ AI đang gián đoạn. Hãy thử lại. | Có | Fallback chung |

- [Thử lại] gửi lại đúng câu hỏi đó (thay lượt lỗi, không nhân đôi câu hỏi); khóa khi đang stream.
- Chỉ lượt cuối có thể có [Thử lại]; lượt lỗi cũ hơn hiện chữ lỗi nhưng không còn nút.
- Lỗi nhập (client): dưới ô, “Hãy nhập câu hỏi (tối đa 500 ký tự).” khi rỗng/chỉ khoảng trắng hoặc > 500; không gọi API.

## 4. Hết quota (`AI_QUOTA_EXCEEDED` hoặc quota đọc được `remaining = 0`)

```
│ ─────────────────────────────────────── │
│ ⚠ Bạn đã dùng hết lượt hỏi AI hôm nay.   │
│ Còn 0/20 câu hôm nay                     │
│ ┌ Nhập câu hỏi của bạn…  (khóa) ┐ [Gửi ⊘]│
```

Ô nhập và [Gửi] khóa (`disabled`); hội thoại cũ vẫn đọc/cuộn được. Mở sheet gọi `GET /me/ai-tutor/quota`: đang tải → “Còn …” là `▓`; lỗi quota → ẩn dòng “Còn”, vẫn cho gửi (server quyết).

## 5. Đếm ký tự và nhập liệu

- Đếm `n/500` chỉ hiện từ 400 ký tự (muted); > 500 chuyển `text-danger` và khóa [Gửi].
- Enter gửi, Shift+Enter xuống dòng; ô tự giãn tối đa ~5 dòng rồi cuộn trong ô.
- Tin cũ nhiều → vùng hội thoại cuộn riêng; tự cuộn xuống tin mới nhất khi đang stream, **trừ khi** người dùng đã cuộn lên (khi đó hiện nút nhỏ “↓ Tin mới” để nhảy xuống).

## 6. Mobile 390

```
┌──────────────────────────────┐   Toàn màn hình (Sheet full), không che thanh trình duyệt
│ ✦ Trợ lý AI của bài học    ✕ │
│ ⓘ AI chỉ dựa trên nội dung   │
│   chữ của bài này và có thể  │
│   trả lời sai…               │
├──────────────────────────────┤
│        ┌────────────────────┐│
│        │ Câu hỏi            ││
│        └────────────────────┘│
│ ✦ AI                         │
│ Câu trả lời…▍                │
│            (cuộn riêng)      │
├──────────────────────────────┤
│ Còn 19/20 câu hôm nay        │  ← dính đáy cùng ô nhập
│ ┌ Nhập câu hỏi…        ┐[Gửi]│   cao 44, safe-area dưới
│ └──────────────────────┘     │
└──────────────────────────────┘
```

- Không cuộn ngang; code/bảng trong Markdown cuộn trong khung. Bàn phím ảo mở: ô nhập dính trên bàn phím (dùng `dvh`).
- [Dừng] thay [Gửi] cùng vị trí; [Thử lại] và nút ✕ cao 44.
- Sheet che thanh đáy ‹ ✓ › của trang bài khi mở (đóng sheet thì trở lại).

## 7. Trợ năng và focus

- Mở sheet: focus vào ô nhập; đóng (Esc/✕/bấm nền): trả focus về nút “Hỏi AI về bài này”. Sheet có tiêu đề (`DialogTitle`) làm tên truy cập.
- Vùng câu trả lời `aria-live="polite"`; khi lỗi, dòng lỗi `role="alert"`. [Dừng] có `aria-label` “Dừng”.
- Thứ tự Tab: ✕ → hội thoại (lỗi → [Thử lại]) → ô nhập → [Gửi]/[Dừng].
- Đổi bài khi sheet đang mở (qua điều hướng trước/sau): huỷ stream đang chạy, xóa hội thoại, giữ sheet đóng.

## 8. Câu hỏi chốt cho người dùng

1. **Nút “Hỏi AI” chỉ nằm ở trang bài**, cạnh H1 (desktop) / dưới H1 (mobile) như mục 1, không thêm nút nổi (FAB) hay ở thanh đáy mobile. Khác: FAB góc dưới phải luôn hiện khi cuộn.
2. **Bài chỉ video: nút hiện nhưng vô hiệu kèm câu giải thích** (không ẩn hẳn), để người học hiểu vì sao.
3. **Lỗi tạm thời có [Thử lại] cho lượt cuối**, lỗi quyền/cấu hình/cắt token thì không (bảng mục 3).
4. **Nút “↓ Tin mới”** khi người dùng cuộn lên giữa lúc stream (mục 5) — chi tiết nhỏ ngoài spec, bỏ nếu không muốn.
