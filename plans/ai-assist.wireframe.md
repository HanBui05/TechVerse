# AI assist — Wireframe cổng trước Task 2a

Trạng thái: **đã duyệt 2026-11-06**. File này chốt nghiệp vụ và bố cục, không mở rộng API hay chức năng. Nguồn chuẩn là `ai-assist.md`, contract thật trong `ai-assist.log.md`, nền `article-flow.wireframe.md` và `docs/design/UI_GUIDE.md`.

Ký hiệu: `[Nút]` Button · `(Badge)` Badge · `▾` thu gọn/select · `⋮` thao tác phụ · `▓` Skeleton · `↑/↓` nút đổi thứ tự có nhãn truy cập. Khung dùng Sidebar hiện có, `max-w-7xl`, Card/shadcn, token màu hiện có; không gradient, không CSS/màu literal mới. Desktop 1440; mobile 390, vùng bấm tối thiểu 44 px.

## 1. Luồng nghiệp vụ và dữ liệu

| Bước | Author / frontend | Backend / dữ liệu gửi nhận |
|---|---|---|
| 0. Entry | Từ `/author/blogs`, chọn **Tạo bằng AI** cạnh **Viết bài mới**; route riêng `/author/blogs/ai`, chỉ role `AUTHOR`. Không thêm sidebar item. | Route guard chỉ là UX; mọi API vẫn kiểm user active + Author `APPROVED` ở backend. |
| 1. Nạp form | Nạp topic/tag active; nhập title tùy chọn, topic, tối đa 10 tag, idea 20–4.000, độ dài, đối tượng 3–200. | `GET /api/v1/author/articles/options`; chưa có API đọc quota riêng nên ban đầu cả remaining và limit đều là `—`. |
| 2. Tạo outline | Bấm **Tạo dàn ý** khi field bắt buộc hợp lệ. Khóa lần gửi trùng nhưng giữ nguyên input. | `POST /api/v1/author/ai/outlines`; nhận title, summary, topic cố định, tag đã chọn, tối đa 5 tag gợi ý, 3–8 H2 và 0–4 H3/H2. Đọc `X-AI-Quota-Limit/Remaining`. |
| 3. Sửa outline | Sửa title/summary; bật/tắt tag gợi ý sao cho tổng tag ≤10; thêm/xóa H2/H3; reorder chỉ bằng `↑/↓`. Có thể **Tạo dàn ý khác** bằng input hiện tại. | Map `suggestedTagIds` qua options active để hiện tên; ID không còn trong options thì ẩn. Lưu form + outline + tag trong `sessionStorage['techverse-ai-compose:v1']`. |
| 4. Viết draft | Bấm **Viết bài**; gửi lại toàn bộ form + outline đã sửa. Trong stream khóa form/outline/handoff, ghép `delta` vào preview và chỉ cập nhật `aria-live` theo đoạn. **Dừng** luôn khả dụng. | `POST /api/v1/author/ai/drafts:stream` bằng `fetch`: `metadata` cho `generationId` + deadline 90/120/180s; `delta` là preview; terminal là `completed`, `cancelled` hoặc `error`. Emitter thật = deadline + 5s; UI đếm theo deadline trong metadata, không theo emitter. |
| 5. Dừng/rời trang | `AbortController.abort()` ngay, đồng thời DELETE best-effort. Khi `pagehide` lúc đang stream, gửi `fetch(DELETE, {keepalive:true})` kèm `Authorization`. Preview dở chỉ để đọc, không handoff. | `DELETE /api/v1/author/ai/generations/{id}`; `CANCELLED` hoặc `ALREADY_FINISHED`. Dừng/ngắt chủ động vẫn tính lượt. |
| 6. Completed | Chỉ tin buffer sau `completed(validated=true)`. Tính SHA-256 bằng `crypto.subtle.digest`, so với `contentSha256`; khớp mới bật handoff và mới lưu buffer + `generationId` + payload handoff vào session của tab. | Receipt completed ở Redis 24 giờ. Restore phải tính lại SHA trước khi cho handoff; hash lệch thì xóa bản completed và báo `AI_STREAM_INTEGRITY_FAILED`. |
| 7. Handoff create | Một lần bấm sinh `Idempotency-Key`, lưu cùng bản completed để retry qua F5; gửi `action=SAVE`, `aiGenerationId`, payload đã khóa. Không tự `SUBMIT`. | `POST /api/v1/author/articles`. Marker sai/hết hạn/sai payload/key khác trả `409 AI_GENERATION_INVALID`; thành công xóa session và trả `aiAssisted=true`. |
| 8. Editor | Điều hướng `replace` tới `/author/blogs/{id}/edit`; xóa session compose; hiện banner AI dựa trên response/DB, không dựa state tạm. | Luồng save/upload/submit cũ tiếp tục. Đóng banner chỉ ẩn trong tab, không đổi `aiAssisted`. |
| 9. Moderator | List/detail hiện badge AI độc lập với badge workflow/publication; Reader không thấy. | Dùng `aiAssisted` đã có trong Author/Moderator DTO; không thêm filter và không đổi Public DTO. |

## 2. Desktop — form, outline, stream và handoff

### 2.1 Form + restore

```text
┌ Sidebar ┬──────────────────────────────────────────────────────────────────┐
│         │ ‹ Bài viết của tôi                                               │
│         │ (✦ Trợ lý viết bài)  Tạo bài bằng AI                             │
│         │ ┌ Đã khôi phục form + dàn ý ──────────────── [Bắt đầu lại] ┐     │
│         │ └───────────────────────────────────────────────────────────┘     │
│         │ ┌ 1 · Ý tưởng bài viết ─────────────────────────────────────┐     │
│         │ │ TIÊU ĐỀ (tùy chọn) [_______________________________]      │     │
│         │ │ CHỦ ĐỀ * [▾]     THẺ (2/10) [TagPicker………………]          │     │
│         │ │ Ý TƯỞNG * [textarea……………………………………] 356/4000         │     │
│         │ │ ĐỘ DÀI * (Ngắn)(Vừa)(Dài)  ĐỐI TƯỢNG * [__________]      │     │
│         │ │ Còn — lượt dàn ý                       [Tạo dàn ý]        │     │
│         │ └───────────────────────────────────────────────────────────┘     │
└─────────┴──────────────────────────────────────────────────────────────────┘
```

Options loading: select/tag `Skeleton` + disabled, input chữ vẫn dùng được; lỗi có **Thử lại**. Restore form/outline hoặc bản completed đã kiểm tra; không restore preview dở/token. Reset qua `AlertDialog`. Quota ban đầu `—`, đổi thành `remaining/limit` theo header thật.

### 2.2 Outline editable

```text
┌ 1 · Ý tưởng ─────────────────────────────── [Thu gọn ▾] ┐
│ Spring Security… · Java · 4 thẻ · Vừa                  │
└─────────────────────────────────────────────────────────┘
┌ 2 · Chỉnh dàn ý ────────────────────────────────────────┐
│ TIÊU ĐỀ * [______________________________] 43/255       │
│ TÓM TẮT * [textarea………………………………] 218/500             │
│ THẺ (4/10) (JWT ×)   GỢI Ý [＋ Spring Boot][✓ OAuth2]   │
│ ┌ Mục 1 ───────────────────────────── [↑][↓][Xóa] ┐    │
│ │ H2 [JWT giải quyết vấn đề gì?______________]    │    │
│ │ H3 [Cấu trúc token____________] [↑][↓][Xóa]     │    │
│ │ [+ Mục con]                                    │    │
│ └─────────────────────────────────────────────────┘    │
│ [+ H2] 3/8       Còn 8/10 lượt dàn ý                  │
│ [Tạo dàn ý khác]       Còn — lượt viết [Viết bài]     │
└─────────────────────────────────────────────────────────┘
```

`↑/↓` có accessible name, disabled ở biên và giữ focus sau reorder; không drag. Tag thứ 11 bị chặn inline. Trước **Viết bài**, client kiểm title 5–255, summary 50–500, 3–8 H2, tối đa 4 H3/H2, mọi heading 5–120 và distinct sau trim/lowercase; serialize UTF-8 toàn request phải ≤16 KiB. Lỗi focus field/heading đầu tiên; quá 16 KiB báo lỗi tại form và không gọi API. **Tạo dàn ý khác** xác nhận sẽ thay bản sửa và tốn lượt mới.

### 2.3 Stream, completed và create retry

```text
┌ 3 · AI đang viết ─────────────────── Còn 4/5 lượt ┐
│ ◌ Phần 2/5 · tối đa 120 giây                      │
│ ⓘ Chỉ dùng nội dung sau khi kiểm tra hoàn tất.    │
│ ┌ Preview tăng dần ─────────────────────────────┐ │
│ │ ## JWT…  JSON Web Token giúp…                 │ │
│ └───────────────────────────────────────────────┘ │
│                                         [■ Dừng] │
└───────────────────────────────────────────────────┘
┌ 3 · Bản nháp hoàn tất ─────────── (✓ Đã kiểm tra)┐
│ Còn 4/5 lượt                                     │
│ [Tạo lại]       [Lưu nháp và mở trình soạn thảo] │
│ ┌ Create lỗi: nội dung vẫn giữ ────────────────┐ │
│ │ [Viết lại] [Thử lại — cùng key]              │ │
│ └───────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────┘
```

`Phần x/y` = số dòng bắt đầu đúng bằng `## ` đã nhận trong buffer / tổng H2 của outline; progress vẫn indeterminate vì token có thể đến giữa dòng. Terminal chốt quota. Tạo lại là call/quota mới và cần xác nhận. Create lỗi giữ buffer/generation/payload/key; không cho chọn lại taxonomy, chỉ **Viết lại** sau khi nạp options hoặc retry cùng key với payload cũ.

## 3. Mobile 390

### 3.1 Form và outline

```text
┌──────────────────────────────┐
│ ‹ Bài của tôi                │
│ Tạo bài bằng AI              │
│ ⓘ Đã khôi phục phiên [Reset] │
│ ┌ 1 · Ý tưởng ─────────────┐ │
│ │ Tiêu đề                  │ │
│ │ Chủ đề                   │ │
│ │ Thẻ (2/10)               │ │
│ │ Ý tưởng          356/4000│ │
│ │ Độ dài (Ngắn)(Vừa)(Dài)  │ │
│ │ Đối tượng đọc            │ │
│ │ Còn — lượt dàn ý         │ │
│ │ [       Tạo dàn ý       ]│ │
│ └──────────────────────────┘ │
│ ┌ 2 · Chỉnh dàn ý ─────────┐│
│ │ Tiêu đề / Tóm tắt        ││
│ │ Gợi ý: [＋JWT] [＋OAuth]  ││
│ │ ┌ H2 mục 1 ────────────┐ ││
│ │ │ [↑][↓]          [Xóa]│ ││
│ │ │ heading              │ ││
│ │ │ H3… [↑][↓][Xóa]      │ ││
│ │ └──────────────────────┘ ││
│ │ [+ H2]  3/8             ││
│ │ [Tạo lại dàn ý]          ││
│ └──────────────────────────┘│
├──────────────────────────────┤
│ Còn — lượt viết  [Viết bài]  │  ← sticky, không che nội dung
└──────────────────────────────┘
```

Control reorder xuống dòng, không kéo ngang. Tag gợi ý wrap; card không dùng bảng. Khi bàn phím ảo mở, sticky action theo viewport nhưng không che field đang focus.

### 3.2 Stream, terminal và handoff

```text
┌──────────────────────────────┐
│ 3 · AI đang viết             │
│ ◌ Phần 2/5 · khoảng 120 giây │
│ ⓘ Chưa thể lưu nội dung dở   │
│ ┌ Preview ─────────────────┐ │
│ │ ## JWT…                  │ │
│ │ nội dung tăng dần…       │ │
│ └──────────────────────────┘ │
├──────────────────────────────┤
│ Còn 4/5 lượt       [■ Dừng]  │
└──────────────────────────────┘

┌──────────────────────────────┐
│ ✓ Bản nháp đã hoàn tất       │
│ Đã kiểm tra nội dung/toàn vẹn│
│ [Tạo lại]                    │
│ [Lưu nháp & mở soạn thảo]    │
└──────────────────────────────┘
```

Cancel/error thay card stream bằng Alert + action; preview dở có thể thu gọn để đọc nhưng không có nút copy/handoff. Action sticky tối đa hai nút, mỗi nút cao ≥44 px, nằm ngoài vùng `aria-live` của preview. Khi nhận `completed`, chuyển focus tới heading card hoàn tất (`tabIndex=-1`); reorder giữ focus ở control vừa bấm.

## 4. Restore, Author banner và Moderator badge

```text
RESTORE: ┌ Đã khôi phục form + dàn ý hoặc bản hoàn tất đã kiểm lại. [Reset][Viết lại] ┐
EDITOR:  ┌ ✦ AI hỗ trợ ─────────────────────────────────────────────────────── [×] ┐
         │ Kiểm tra tính chính xác, mã nguồn và liên kết trước khi gửi duyệt.      │
LIST:    │ Tiêu đề… (AI hỗ trợ)(Chờ duyệt) │
DETAIL:  │ (AI hỗ trợ)(Đang công khai v2)(Chờ duyệt) │
```

Banner dùng copy đầy đủ ở mục 6, sau status và trước tabs trên mobile; đóng chỉ trong tab. Badge VI `AI hỗ trợ`, EN `AI-assisted`, tone blue/trung tính, độc lập status và không lấn action.

## 5. Ma trận trạng thái × hành vi

- **Options/form/outline:** giữ input; loading khóa gửi lặp, invalid khóa action, lỗi có Retry. Quota là `—` tới header thật.
- **Streaming:** buffer chỉ ở RAM; khóa sửa/handoff/reset, chỉ Dừng hoạt động; terminal chốt quota.
- **Completed:** hash khớp mới lưu buffer/generation/payload/SHA và bật handoff; restore phải hash lại. Hash lệch/cancel/error giữ preview chỉ đọc và khóa handoff.
- **Quota/lỗi:** quota ngày khóa đúng action; burst/provider/timeout cho retry thủ công khi contract cho phép; refund dùng quota terminal/header, không tự tính.
- **Create:** pending khóa bấm đôi; lỗi giữ payload + key; thành công/reset xóa session. 401/403 theo auth/quyền hiện có.

## 6. Copy trạng thái vi/en

Toàn bộ copy nằm trong `aiAssistI18n.ts`; bảng mã lỗi/copy chuẩn ở `ai-assist.md`. Các câu bắt buộc trên wireframe: quota chưa biết phải giải thích sẽ cập nhật sau lần dùng đầu; preview dở không thể lưu; completed đã được kiểm tra; create lỗi nói nội dung vẫn được giữ; F5 khi stream nói phiên trước không thể tiếp tục; hash lệch yêu cầu tạo lại. Banner Author dùng câu đầy đủ ở mục 4; badge VI/EN là `AI hỗ trợ`/`AI-assisted`.

### Copy lỗi theo code

Copy lỗi dùng nguyên bảng “Mã lỗi, HTTP và copy vi/en” trong `ai-assist.md`; không tự dùng `message` tiếng Anh từ backend. Riêng hành vi UI cần chốt:

| Nhóm | Copy/hành vi |
|---|---|
| Validation/malformed | Báo kiểm tra dữ liệu, focus field đầu tiên; body >16 KiB không gọi API. |
| Taxonomy thiếu/inactive | Nạp lại options; thẻ gợi ý không map được thì ẩn. |
| `AI_GENERATION_IN_PROGRESS` | Báo một bản khác đang viết; sau F5 cho retry thủ công vì khóa có thể giữ đến deadline + 5s. |
| Generation invalid/not found, hash lệch | Khóa handoff; chỉ cho **Viết lại**. |
| Quota/burst | Quota khóa action; burst cho thử lại thủ công. |
| Provider/storage/timeout/output | Dùng copy vi/en trong spec; giữ form/outline, không handoff buffer, cho retry khi contract cho phép. |
| Lỗi mạng | “Mất kết nối. Ý tưởng và dàn ý của bạn vẫn được giữ.” / “Connection lost. Your idea and outline are still saved.” |

Validation focus field lỗi; taxonomy reload options; lỗi quyền/config không auto-retry; invalid generation/hash chỉ cho Tạo lại. Mọi lỗi giữ form/outline và không handoff buffer dở. 401/session refresh fail theo auth client; không phát lại provider call sau khi SSE đã mở.

## 7. Trường hợp biên

- **Hết quota giữa chừng:** lượt đã reserve nên không phát `AI_QUOTA_EXCEEDED` giữa một stream đang chạy. Nếu provider lỗi/timeout/output invalid thì backend refund và terminal quota tăng lại; nếu completed/cancel/disconnect chủ động thì lượt vẫn tính. Quota hết chỉ chặn lần gọi kế tiếp.
- **Đóng tab/F5 khi stream:** không lưu buffer/generation dở; `pagehide` gửi DELETE keepalive có bearer. Nếu request không tới hoặc model đang im, khóa có thể giữ đến deadline + 5s (95/125/185s); restore form/outline, báo rõ và chỉ cho retry thủ công.
- **F5 sau completed:** restore buffer + `generationId` + payload handoff (+ key nếu đã bấm create), tính lại SHA trước khi bật handoff. Hash sai/parse lỗi thì xóa bản completed; không lưu token.
- **Hash lệch:** không create, không cho dùng buffer; giữ form/outline và quota terminal, yêu cầu tạo lại.
- **Topic/tag inactive lúc create:** giữ completed buffer để đọc nhưng receipt fingerprint không cho đổi taxonomy rồi retry. Nạp options, chọn lại và chạy **Viết bài** mới; `AI_GENERATION_INVALID` cũng đi cùng hướng.
- **Mất mạng trước stream:** giữ form/outline; request chưa reserve thì quota không đổi. **Mất mạng sau metadata/delta:** buffer dở không hợp lệ, backend xử lý disconnect; retry là provider call mới. **Mất mạng khi create:** nếu trang còn sống, retry cùng key; không sinh key mới.
- **Reload/đóng tab khi create chưa rõ kết quả:** restore bản completed + cùng payload/key để retry idempotent. Nếu receipt hết hạn hoặc backend trả `AI_GENERATION_INVALID`, khóa retry và yêu cầu viết lại.
- **Cancel chạy đua với completed:** terminal đầu tiên thắng. Nếu client đã nhận completed + hash đúng thì handoff được; nếu UI đã chọn Dừng trước terminal, xử lý như cancelled và không handoff dù DELETE trả `ALREADY_FINISHED`.
- **Session cũ/hỏng:** sai version hoặc parse lỗi thì bỏ payload im lặng, mở form rỗng; không xóa dữ liệu hợp lệ của tab khác vì `sessionStorage` tách theo tab.

## 8. Kết luận người dùng đã duyệt

Ngày 2026-11-06, người dùng chọn cả tám khuyến nghị: nút **Tạo bằng AI** cạnh **Viết bài mới** (không sidebar), back cố định `/author/blogs`, desktop nối dọc, mobile action sticky ≥44 px, quota ban đầu là `—` cho cả remaining/limit, banner Author dùng câu đầy đủ, badge Moderator tone blue cạnh status, preview dở giữ chỉ đọc và không copy/handoff.

## Phản hồi vòng 1 (Claude)

Đã đối chiếu code: `GET /api/v1/author/articles/options` có (`AuthorArticleController:41`); `/author/blogs/ai` không đụng `/author/blogs/new` và `/:id/edit` (`App.tsx:173–176`); Badge tone `blue` có (`Badge.tsx:23`); 409 `AI_GENERATION_INVALID`, emitter = deadline + 5s, SSE events khớp code 1b/1c.

**Đúng:** luồng 0–9, ma trận trạng thái, copy lỗi theo code, ranh giới không tự `SUBMIT`, handoff giữ cùng key, cancel đua completed.

**Sai**

1. Quota ban đầu `—/10`, `—/5`: limit do env (`AI_OUTLINE_PER_DAY`, `AI_DRAFT_PER_DAY`) quyết, frontend không biết → `/10`, `/5` là đoán. Hiện `—` cho cả limit tới khi có header `X-AI-Quota-*`.
2. Card completed có `[Chọn lại taxonomy]`: đổi topic/tag làm fingerprint lệch → create chắc chắn 409. Bỏ nút này; chỉ để `[Viết lại]` sau khi nạp lại options (đúng như mục 7 đã ghi).
3. Mục 7 F5: backend chỉ thấy client ngắt khi ghi event kế tiếp. Nếu model đang im, khóa 1 stream/Author có thể giữ tới deadline + 5s (95/125/185s), không phải “tạm”. Copy/hướng dẫn cần nói rõ.

**Thiếu**

1. Validation outline phía client chưa ghi, phải khớp `AiDraftRequest` để không tốn request 400: title 5–255 (bắt buộc khi Viết bài), summary 50–500, 3–8 H2, ≤4 H3/H2, mỗi heading 5–120, heading H2/H3 không trùng nhau toàn bài (không phân biệt hoa thường; backend trả `fieldErrors.distinctHeadings`), body ≤16 KiB UTF-8 (idea 4.000 ký tự tiếng Việt + outline có thể chạm) — nêu cách báo khi vượt.
2. “Phần 2/5” chưa nói cách tính. Chốt: đếm dòng `## ` đã nhận trong buffer / số H2 của outline; hoặc bỏ, chỉ giữ spinner + đồng hồ.
3. Thẻ gợi ý: response chỉ có `suggestedTagIds` → map tên qua options; ID không còn trong options thì ẩn. Chưa ghi.
4. Mobile sticky action: nêu rõ nằm ngoài vùng `aria-live` preview và thứ tự focus sau khi stream xong (focus về tiêu đề card completed).

**Thừa**

1. Drag reorder (“phụ”): Task 2a chỉ yêu cầu `↑/↓` bằng bàn phím; drag thêm thư viện/công sức. Bỏ ở bản 1.
2. `8.421 byte · SHA khớp` trên card completed: không có nghĩa với Author. Chỉ giữ `(✓ Đã kiểm tra)`.

**Ngân sách:** kiểm mắt dark/light × desktop/mobile cho 1 route + banner là đúng ngân sách; không thêm.

### Đề xuất ngoài spec

1. **DELETE khi rời trang:** `pagehide` gửi `fetch(DELETE, {keepalive: true})` kèm `Authorization` khi đang stream. Lợi: nhả khóa 1 stream/Author và ngắt provider ngay, tránh 409 tới 185s sau F5. Công sức: ~10 dòng FE + 1 ca test. Làm ngay ở 2a.
2. **Giữ bản completed qua F5:** sau `completed` + hash khớp, lưu buffer + `generationId` + payload vào `sessionStorage` (tab hiện tại), restore kiểm lại SHA trước khi cho handoff; receipt Redis còn 24 giờ. Lợi: không mất lượt viết (5/ngày) vì lỡ tải lại. Công sức: nhỏ FE, nhưng **đổi ràng buộc spec** “không lưu preview/generation/key” → người dùng chọn. Khuyến nghị làm ngay (chỉ bản đã kiểm tra, không lưu preview dở).
3. **`GET /api/v1/author/ai/quota`:** hiện đúng lượt ngay khi vào trang thay vì `—`. Công sức: backend nhỏ nhưng backend bản 1 đã đóng. Tách module sau.

## Trả lời vòng 1 (Codex)

- **Chấp nhận toàn bộ:** quota ban đầu là `—` cho cả hai vế; bỏ chọn lại taxonomy, drag và byte/SHA trên card.
- **Chấp nhận validation:** client khớp `AiDraftRequest`, gồm heading 5–120/distinct và body UTF-8 ≤16 KiB.
- **Chấp nhận tiến độ/a11y:** `Phần x/y` đếm dòng `## ` trên số H2; map tên tag qua options; sticky ngoài `aria-live`, completed nhận focus.
- **Chấp nhận đề xuất 1–2:** DELETE keepalive có bearer khi `pagehide`; chỉ lưu/restore bản completed sau hash khớp và kiểm lại SHA.
- **Tách module đề xuất 3:** API quota không thuộc Task 2a vì backend bản 1 đã đóng.
- **Điểm yếu còn lại của spec:** keepalive không bảo đảm được gửi; receipt completed hết hạn sau 24 giờ nên restore muộn có thể buộc viết lại.

