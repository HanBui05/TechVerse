# Prompt giao diện Task 2b — Moderator xử lý báo cáo cuộc trò chuyện

Làm **Task 2b của module messaging** trong repo TechVerse (React + TypeScript + Vite, shadcn/ui + Tailwind v4). Nhánh `feature/messaging`. Trả lời bằng tiếng Việt.

## Ràng buộc cứng

- **Không sửa gì trong `server/`.** Backend đã xong và đã được nhận. Nếu API thiếu thứ gì thì dừng lại và báo, không tự thêm.
- **Không thêm thư viện.** Chỉ dùng primitive có sẵn trong `app/src/components/ui/` và token màu trong `app/src/styles/tokens.css`: không hex/rgb, không `text-white`.
- Mọi nút, link và ô nhập phải có vùng chạm ≥ 44px trên màn cảm ứng (`pointer-coarse:min-h-11 pointer-coarse:min-w-11`).
- **Ít file:** không tạo file mới; component con để chung file với trang.
- Luật dự án: đọc `CLAUDE.md`, `.claude/rules/frontend.md`, `docs/design/UI_GUIDE.md`, skill `ui-components`.
  - Làm theo TDD: viết test trước, chạy thấy đỏ, rồi mới code.
  - Chỉ chạy test liên quan và `npm run build`.
  - Ghi log vào `plans/messaging.log.md`.
  - Commit không nhắc AI, không `Co-Authored-By`.

## Đọc trước (theo thứ tự)

1. `plans/messaging.md`: chỉ mục **Task 2b** (phạm vi, copy vi/en, “Xong khi”) và bảng **“Quy tắc nghiệp vụ và mã lỗi”** của Task 1b.
2. `plans/messaging.log.md`: phần “Bắt đầu từ đây”.
3. Mục “Moderator (Task 2b)” trong `plans/messaging.ui-prompt.md`. Bố cục trong prompt này thay thế mục đó khi hai bên lệch nhau.

## Backend cần đọc (chỉ đọc)

| File trong `server/src/main/java/com/techverse/server/` | Lấy gì |
|---|---|
| `controller/ModeratorReportController.java` | `GET /api/v1/moderator/reports?status&reason&targetType&page&size` (mặc định `targetType=FORUM_POST`, nên phải gửi `CONVERSATION` mới thấy báo cáo cuộc trò chuyện); `PATCH /reports/{id}/resolve` |
| `dto/request/ReportRequest.java` | `Queue` (bộ lọc); `Resolve`: `action` = `HIDE_CONTENT` / `LOCK_CONVERSATION` / `DISMISS`, `note` ≤ 1.000 ký tự, bắt buộc khi khác `DISMISS` |
| `dto/response/ReportResponse.java` | `Item`: theo `targetType` chỉ một trong hai trường `post` / `conversation` có giá trị; `otherOpenReports`. `ModeratedConversation`: `learner`, `author`, `blocked`, `locked`, `lockNote`, `lockedBy`, `lockedAt` |
| `controller/ModeratorConversationController.java` | `GET /api/v1/moderator/conversations?locked=true&page&size`; `GET /{id}/messages?beforeSeq&size`; `PATCH /{id}/lock` với body `{locked, note}` (note bắt buộc khi `locked=true`) |
| `dto/request/ConversationRequest.java` | `Locked`, `Messages` (giới hạn `size`), `Lock` |
| `dto/response/ConversationResponse.java` | `Message(id, seq, senderId, mine, content, createdAt)`; `Messages(messages, hasMore)` luôn tăng dần theo `seq`. Với Moderator, `mine` luôn là false: xếp bên trái/phải theo `senderId` |
| `exception/ErrorCode.java` (dòng ~185–200) | `CONVERSATION_NOT_FOUND`, `CONVERSATION_STATE_INVALID` (khóa cuộc đang khóa / mở cuộc đang mở), `REPORT_NOT_FOUND`, `REPORT_ALREADY_HANDLED`, `REPORT_TARGET_NOT_FOUND` |

## Frontend: sửa ở đâu

- `app/src/pages/Moderator/Reports/ModeratorReportsPage.tsx` + `ModeratorReportsPage.test.tsx`: trang chính cần mở rộng. Giữ nguyên toàn bộ hành vi của báo cáo bài diễn đàn.
- `app/src/types/forum.ts`:
  - `ReportResolveAction` thêm `LOCK_CONVERSATION`.
  - `ModeratorReportItem` thêm `targetType`, `conversation`.
  - `ModeratorReportsFilter` thêm `targetType`.
- `app/src/services/forumService.ts`:
  - `moderatorReportsFilter` / `moderatorReportsSearch` đọc và ghi `targetType` trên URL (`?type=conversation`).
  - `moderatorReportService.queue` gửi `targetType`.
  - Dùng lại `validateModerationNote`.
- `app/src/data/forumI18n.ts`: copy vi/en của Task 2b, lấy đúng bảng copy trong spec. Copy thêm ngoài bảng thì ghi vào log mục “Lệch khác spec”.
- `app/src/services/messagingService.ts`: **đã có** `moderatorMessages`, `moderatorSetLocked`, `moderatorListLocked`.
  - Kiểm lại cho khớp DTO; `LockedConversationItem` thiếu `blocked`/`locked` so với `ModeratedConversation` thì bổ sung.
  - Dùng lại helper này, không viết `fetch` mới.
- Dùng lại:
  - `ConversationMessageThread` (export từ `app/src/pages/Messages/MessagesPage.tsx`) cho khung xem chỉ đọc. Truyền `viewer.participantsById` để hiện tên người gửi; không truyền `pendingMessages` / `onRetryPending`.
  - `UserAvatar`, `EmptyState`, `Pagination`.
  - `ui/{Sheet, Dialog, AlertDialog, Textarea, Badge, Button, NativeSelect, Skeleton}`.
  - Hộp thoại ghi chú sẵn có của trang (đếm `x/1.000`).

## Bố cục (được sáng tạo, nhưng gọn và khớp phần còn lại của trang)

**Hàng đợi `/moderator/reports`**

- Dưới hàng tab (Đang mở / Đã xử lý / Nội dung đang ẩn) thêm bộ chọn loại đích dạng segmented: **Bài diễn đàn | Cuộc trò chuyện**.
  - Lưu trên URL; đổi loại thì về trang 1.
  - Không hiện ở tab “Nội dung đang ẩn”; tab đó tự chia hai phần (xem dưới).
- **Thẻ báo cáo cuộc trò chuyện** cùng khung với thẻ báo cáo bài diễn đàn đang có, nội dung như sau:
  - Dòng đầu: hai `UserAvatar` nhỏ chồng mép + “Tên người học ↔ Tên tác giả”, nhãn nhỏ “Người học” / “Tác giả”. Bên phải là Badge trạng thái: “Đang bị chặn” (tone cảnh báo), “Đang bị khóa” (tone nguy hiểm).
  - Thân: lý do (Badge), mô tả (gập/mở như `CollapsibleMarkdown` đang dùng), người báo cáo, thời gian, “+N báo cáo khác đang mở” nếu `otherOpenReports > 0`.
  - Chân thẻ:
    - **“Xem tin nhắn”** (outline).
    - **“Khóa cuộc trò chuyện”** (destructive). Ẩn nếu cuộc đã khóa.
    - **“Bỏ qua”** (ghost).
    - Mobile: các nút xếp `grid` full-width, không dựa vào `min-w-*`.
  - Tab “Đã xử lý” không có nút hành động; hiện kết quả xử lý + ghi chú, giống thẻ diễn đàn đã xử lý.
- **Không tải tin nhắn khi mở danh sách.** Chỉ tải khi bấm “Xem tin nhắn”.

**Khung “Xem tin nhắn”**: `Sheet` mở từ bên phải, desktop rộng ~560px, mobile toàn màn.

- Đầu khung: hai người tham gia + Badge trạng thái. Dải lưu ý nền nhạt: “Bạn chỉ xem được vì cuộc trò chuyện này đã bị báo cáo.” (khung mở từ tab khóa thì bỏ câu “đã bị báo cáo” nếu spec có copy khác; không có thì giữ nguyên).
- Thân: `ConversationMessageThread` chỉ đọc.
  - Người học bên trái, tác giả bên phải, tên trên mỗi nhóm tin.
  - Có “Tải tin cũ hơn” (`beforeSeq`).
  - **Không có ô nhập, không gọi API đánh dấu đã đọc, không mở WebSocket.**
- Chân khung (sticky): lặp lại “Khóa cuộc trò chuyện” / “Bỏ qua” khi khung mở từ một báo cáo đang mở, để Moderator đọc xong xử lý ngay.
- Các trạng thái:
  - Đang tải: skeleton 3–4 bong bóng.
  - Rỗng: `EmptyState`.
  - Lỗi: thông báo + nút “Thử lại”.
  - `CONVERSATION_NOT_FOUND` / `REPORT_TARGET_NOT_FOUND`: báo nội dung không còn.

**Khóa**

- `Dialog` có `Textarea` ghi chú **bắt buộc**, đếm `x/1.000`, lỗi “Hãy ghi lý do (tối đa 1.000 ký tự).”.
- Nút xác nhận có trạng thái đang gửi, chặn bấm hai lần.
- Gọi `resolve` với `LOCK_CONVERSATION` + `note`. Thành công thì đóng dialog/sheet, báo thành công, **tải lại danh sách**.
- `REPORT_ALREADY_HANDLED`: báo đã có người xử lý rồi tải lại.

**Bỏ qua**: `AlertDialog` xác nhận (ghi chú không bắt buộc, theo hộp sẵn có) → `resolve` với `DISMISS` → tải lại danh sách.

**Tab “Nội dung đang ẩn”**

- Chia hai phần có tiêu đề nhỏ: “Bài diễn đàn đang ẩn” (giữ nguyên) và **“Cuộc trò chuyện đang bị khóa”** (`moderatorListLocked`).
- Thẻ cuộc khóa: hai người tham gia, “Khóa bởi <tên> · <thời gian>”, ghi chú khóa. Nút “Xem tin nhắn” và **“Mở khóa”**.
- “Mở khóa”: `AlertDialog` xác nhận → `moderatorSetLocked(id, false)` → tải lại. `CONVERSATION_STATE_INVALID` thì báo trạng thái đã đổi rồi tải lại.
- Mỗi phần phân trang riêng; rỗng thì một dòng chữ nhỏ, không dùng `EmptyState` to.

## Test (gộp vào `ModeratorReportsPage.test.tsx`, mock `fetch`)

1. Chọn “Cuộc trò chuyện” thì gọi queue với `targetType=CONVERSATION`, thẻ hiện hai người tham gia và Badge chặn/khóa.
2. Mở danh sách không gọi API tin nhắn. Bấm “Xem tin nhắn” mới gọi `/moderator/conversations/{id}/messages`; khung không có ô nhập và không gọi `/read`; “Tải tin cũ hơn” gửi `beforeSeq`.
3. Khóa với ghi chú rỗng thì báo lỗi và không gọi API. Ghi chú hợp lệ thì `resolve` gửi `LOCK_CONVERSATION` + `note`, rồi tải lại danh sách.
4. Bỏ qua gửi `DISMISS`; `REPORT_ALREADY_HANDLED` hiện thông báo và tải lại.
5. Tab ẩn: hiện cuộc đang khóa; “Mở khóa” gọi `PATCH /lock` với `locked:false`.
6. Regression: báo cáo bài diễn đàn vẫn chạy như cũ (các test sẵn có phải xanh).

Chạy: `cd D:/work/Project/TechVerse/app && npx vitest run src/pages/Moderator/Reports/ModeratorReportsPage.test.tsx src/pages/Messages/MessagesPage.test.tsx` + `npm run build`.

## Kiểm bằng mắt (skill `visual-check`, Playwright MCP)

- Tài khoản Moderator: `moderator@techverse.test` (mật khẩu ở `docs/RUNBOOK.md`). DB dev đã có 1 báo cáo cuộc trò chuyện giữa `learner.kiemmat` và `bao.author`.
- Kiểm dark/light × desktop 1440 / mobile cảm ứng 390. Đo:
  - không cuộn ngang;
  - control ≥ 44px;
  - Sheet 560px trên desktop, toàn màn trên mobile;
  - chữ không tràn trong nút.
- Làm thật một vòng: xem tin → khóa → thấy ở tab ẩn → mở khóa.
- Không khởi động lại backend của người dùng; tắt Vite nếu tự bật.

## Kết thúc

Ghi log (lệnh test + số đạt, phần chưa kiểm, “Lệch khác spec”). Sau đó chạy Codex review theo skill `codex-workflow`, rồi dừng chờ người dùng nhận.
