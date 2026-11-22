# Messaging — brief giao diện (thay wireframe, người dùng chốt 2026-11-22)

Người dùng bỏ cổng wireframe của module này: brief này là bố cục đã duyệt. Spec `plans/messaging.md` Task 2a/2b vẫn là nguồn cho phạm vi, copy, “Xong khi”; brief chỉ thêm bố cục và các điểm sáng tạo đã cho phép. Lệch giữa hai bên: làm theo brief, ghi “Lệch khác spec” trong log.

## Ràng buộc

- **Không sửa `server/`.** Backend 1a–1c đã nhận; thiếu gì ở API thì dừng và báo, không tự thêm.
- Bám `docs/design/UI_GUIDE.md`, skill `ui-components`, luật `.claude/rules/frontend.md` (primitive shadcn sẵn có, token màu, vùng chạm 44px, không thư viện mới, `WebSocket` gốc của trình duyệt).
- Ít file: chỉ tạo file mới cho trang/route mới; component con để chung file trang.
- Copy mới ngoài bảng copy của spec: thêm vi/en vào `messagingI18n.ts`, liệt kê trong log mục “Lệch khác spec”.

## Backend cần đọc (chỉ đọc, đọc đúng file này)

| File | Lấy gì |
|---|---|
| `server/.../controller/ConversationController.java` | Route người dùng: `POST /conversations` (mở theo `courseId`), `GET /conversations?page&size`, `GET /unread-count`, `GET /{id}`, `GET /{id}/messages?beforeSeq|afterSeq&size`, `POST /{id}/messages` (`content`, `clientId`; 201 mới / 200 lặp), `PUT /{id}/read` (`seq`), `PUT /{id}/block` (`blocked`), `POST /socket-ticket` |
| `server/.../dto/response/ConversationResponse.java` | `Summary`, `Detail` (`canSend`, `remainingBeforeReply`, `contextCourse`, `contextEnrolled`, chặn/khóa), `Message`, `Messages` (`hasMore`), `UnreadCount`, `SocketTicket` |
| `server/.../dto/request/ConversationRequest.java` | Biên validation (độ dài nội dung 2.000 sau trim, `size`, `page`, `seq`) để làm validation phía FE khớp |
| `server/.../exception/ErrorCode.java` (dòng ~185–200) | Mã lỗi `CONVERSATION_*`, `MESSAGE_*`, `REPORT_TARGET_EMPTY` → map copy vi/en |
| `server/.../controller/ModeratorConversationController.java` | `GET /moderator/conversations?locked=true`, `GET /{id}/messages`, `PATCH /{id}/lock` (`locked`, `note`) — Task 2b |
| `server/.../dto/request/ReportRequest.java`, `dto/response/ReportResponse.java`, `controller/ModeratorReportController.java` | Báo cáo `targetType: CONVERSATION`; hàng đợi `?targetType=CONVERSATION`; `Item.conversation` (`ModeratedConversation`); hành động `LOCK_CONVERSATION` (ghi chú bắt buộc) / `DISMISS` — Task 2b |

**Giao thức socket** (không cần đọc `MessageSocketHandler`): `POST /api/v1/conversations/socket-ticket` → `{ticket, expiresAt}`; mở `new WebSocket(API_BASE_URL.replace(/^http/, 'ws') + '/ws/messaging?ticket=' + ticket)`. Server chỉ đẩy JSON: `{"type":"message","conversationId","seq"}`, `{"type":"unread"}`, `{"type":"state","conversationId"}` — không có nội dung; nhận xong thì gọi REST. Server đóng kết nối khi access token hết hạn, khi phiên bị thu hồi, hoặc khi quá 5 tab → kết nối lại theo spec 2a (chờ 1 → 30 giây, xin vé mới, rồi lấy bù). Xin vé 401/403/429/503 → chạy chế độ tự làm mới 5/30 giây.

## Frontend — làm ở đâu

- Tạo: `app/src/pages/Messages/MessagesPage.tsx` (một trang cho cả `/messages` và `/messages/:id`) + `MessagesPage.test.tsx`; `app/src/types/messaging.ts`; `app/src/services/messagingService.ts` (REST + một kết nối socket dùng chung cho cả app, có `subscribe`, đóng khi đăng xuất/đổi token — dùng `getAccessToken`/`getSessionVersion` của `services/api/client.ts`); `app/src/data/messagingI18n.ts` (copy + `messagingErrorText` như `forumErrorText`).
- Sửa: `App.tsx` (route `/messages`, `/messages/:id` bọc `AuthRoute` + `ReaderRoute`); `data/navigation.ts` + `components/layout/Sidebar.tsx` (mục “Tin nhắn” + số chưa đọc); `components/layout/Sidebar.test.tsx` (bỏ `messages` khỏi `deadUserPaths`); `pages/Courses/CourseOverviewPage.tsx` (nút “Nhắn tác giả”).
- Dùng lại: `components/MarkdownContent.tsx`, `UserAvatar`, `EmptyState`, `ui/{Button,Textarea,Dialog,AlertDialog,Popover,Sheet,Badge,Skeleton,Tooltip,Separator}`; hộp thoại báo cáo `ReportPostDialog` trong `pages/Forum/ForumQuestionDetailPage.tsx` + `validateReportInput` của `forumService.ts` (cùng lý do/quy tắc mô tả; nếu cần dùng ở 2 nơi thì được tách ra file component).
- Task 2b: `pages/Moderator/Reports/ModeratorReportsPage.tsx` (+ test), `services/forumService.ts`, `types/forum.ts`, `data/forumI18n.ts`; khung xem tin chỉ đọc dùng lại phần hiển thị tin của `MessagesPage` (export component đó).

## Bố cục

### `/messages` — desktop (≥ 1024px)

```
┌ Sidebar app ┐┌──────────────── main (cao = 100dvh, không cuộn trang) ────────────────┐
│ ...         ││ ┌ Danh sách (w-80, viền phải) ┐┌ Cuộc đang mở ─────────────────────────┐ │
│ Tin nhắn (3)││ │ Tin nhắn            [3]     ││ [Ảnh] Nguyễn A · Tác giả        [⋯]  │ │
│ ...         ││ │ ⚠ Đang kết nối lại… (nhỏ)   ││ Hỏi về: Spring Boot cơ bản ↗ [Chưa ĐK]│ │
│             ││ │ ● [Ảnh] Nguyễn A    10:24   ││───────────────────────────────────────│ │
│             ││ │   Tác giả · Em hỏi chút…    ││        [ Tải tin cũ hơn ]             │ │
│             ││ │   [Ảnh] Trần B   Hôm qua 🔒 ││ ─── Hôm nay ───                       │ │
│             ││ │   Người học · Cảm ơn thầy   ││ [Ảnh] ┌bong bóng của họ┐              │ │
│             ││ │   …                         ││       └ 10:20          ┘              │ │
│             ││ │        [ Tải thêm ]         ││              ┌bong bóng của mình┐     │ │
│             ││ └─────────────────────────────┘│              └ 10:24 · Đang gửi…┘     │ │
│             ││                                │            [ ↓ Tin mới ]              │ │
│             ││                                │ ⓘ Bạn có thể gửi thêm 2 tin trước…    │ │
│             ││                                │ ┌Nhập tin nhắn…              ┐[Gửi]  │ │
│             ││                                │ └Enter gửi · Shift+Enter xuống dòng 12/2000┘│
└─────────────┘└──────────────────────────────────────────────────────────────────────┘
```

- **Danh sách:** mỗi mục là một link (`/messages/:id`), vùng chạm ≥ 44px; ảnh 40px; tên (đậm + chấm màu nhấn khi chưa đọc); nhãn vai của **người kia** (“Tác giả”/“Người học”) bằng chữ phụ; đoạn trích 1 dòng cắt `…`; thời điểm dạng gọn (giờ nếu hôm nay, “Hôm qua”, ngày); biểu tượng nhỏ khóa/chặn kèm `aria-label`. Mục đang mở có nền nổi. Phân trang “Tải thêm” ở cuối.
- **Đầu cuộc:** ảnh + tên + vai; dòng 2 “Hỏi về: <khóa>” (link chỉ khi `available`) + Badge “Đã đăng ký” (tone thành công) / “Chưa đăng ký” (tone trung tính), không hiện khi `contextEnrolled = null`. Nút `⋯` mở Popover: Chặn/Bỏ chặn, Báo cáo. Chặn qua `AlertDialog` (copy xác nhận của spec).
- **Luồng tin:** bong bóng của mình bên phải nền nhấn nhạt (token), của họ bên trái nền bề mặt phụ; rộng tối đa ~70%; tin liên tiếp cùng người trong 5 phút gộp nhóm (ảnh chỉ ở tin đầu nhóm, giờ ở tin cuối); vạch ngày giữa các ngày. Markdown qua `MarkdownContent`; khối code cuộn ngang trong bong bóng. Tin đang gửi mờ nhẹ + “Đang gửi…”; lỗi → chữ `text-danger` “Gửi lỗi” + nút “Gửi lại”.
- **Cuộn:** mở cuộc thì xuống cuối; chỉ tự cuộn khi đang ở cuối; nếu đang đọc phía trên mà có tin mới → nút nổi “↓ Tin mới” (sáng tạo, copy mới). Tải tin cũ hơn giữ nguyên vị trí đang đọc.
- **Ô nhập:** `Textarea` tự cao 1–6 dòng; đếm ký tự luôn hiện, đổi màu cảnh báo khi > 1.800 và `text-danger` khi vượt; gợi ý phím chỉ hiện ở thiết bị có bàn phím (`pointer-fine`). Nút Gửi tắt khi rỗng/vượt/đang gửi. Thông báo `remainingBeforeReply` là dải ⓘ ngay trên ô nhập; hết lượt / bị chặn / bị khóa thì thay ô nhập bằng khung thông báo (người chặn có nút “Bỏ chặn”).
- **Chưa chọn cuộc (desktop):** cột phải là `EmptyState` “Chọn một cuộc trò chuyện để bắt đầu.” (copy mới). **Không có cuộc nào:** cả vùng là `EmptyState` copy “Bạn chưa có cuộc trò chuyện nào.” + gợi ý “Mở một khóa học và bấm Nhắn tác giả.” (copy mới) + link `/courses`.
- **Trạng thái:** tải = `Skeleton` (5 dòng danh sách, 4 bong bóng xen kẽ); lỗi tải = khung lỗi + nút “Thử lại”; mất kết nối socket = dòng nhỏ “Đang kết nối lại…” dưới tiêu đề danh sách (copy mới, `aria-live="polite"`), không chặn thao tác.

### `/messages` — mobile (390px)

- `/messages`: chỉ danh sách, full chiều rộng. `/messages/:id`: chỉ cuộc trò chuyện; đầu trang có nút ← về `/messages` (44px), tên, `⋯`; dòng “Hỏi về” cắt `…`.
- Ô nhập dính đáy (`sticky bottom-0`, chừa `env(safe-area-inset-bottom)`), không bị bàn phím ảo che (dùng `100dvh`). Không cuộn ngang trang; khối code cuộn trong bong bóng. Ẩn gợi ý phím.

### Thanh bên người dùng

- Mục “Tin nhắn” (icon `MessageCircle` của lucide) sau “Hỏi đáp”; chỉ khi đã đăng nhập và là tài khoản người đọc. Số chưa đọc là Badge nhỏ (`99+` khi lớn hơn 99); khi thanh bên thu gọn thì thành chấm trên icon, `aria-label` theo copy “{n} cuộc trò chuyện chưa đọc”.

### Trang khóa học

- Nút “Nhắn tác giả” (variant `outline`, icon `MessageCircle`) đặt trong khối thông tin tác giả (hoặc ngay dưới nút hành động chính nếu trang không có khối tác giả), theo đúng điều kiện hiện của spec 2a. Bấm → trạng thái chờ trên nút; lỗi → thông báo theo mã (vd. `CONVERSATION_NOT_ALLOWED`, `MESSAGE_RATE_LIMITED`).

### Moderator (Task 2b)

- Hàng đợi `/moderator/reports`: thêm bộ lọc loại đích (Bài diễn đàn / Cuộc trò chuyện → `targetType`). Thẻ báo cáo cuộc trò chuyện: hai ảnh nhỏ “A ↔ B” + tên (Người tham gia), Badge “Đang bị chặn”/“Đang bị khóa”, lý do, mô tả, số báo cáo mở; nút “Xem tin nhắn” (chỉ tải khi bấm), “Khóa cuộc trò chuyện”, “Bỏ qua”.
- “Xem tin nhắn” mở `Sheet` bên phải (desktop rộng ~ 560px, mobile toàn màn): dải lưu ý “Bạn chỉ xem được vì cuộc trò chuyện này đã bị báo cáo.”, luồng tin chỉ đọc (không ô nhập, không đánh dấu đã đọc), “Tải tin cũ hơn”. Bong bóng xếp theo người: người học bên trái, tác giả bên phải, có tên trên mỗi nhóm.
- Khóa: `Dialog` có `Textarea` ghi chú bắt buộc (≤ 1.000 ký tự, đếm ký tự). Tab “Nội dung đang ẩn”: thêm phần “Cuộc trò chuyện đang bị khóa” cùng kiểu thẻ, nút “Xem tin nhắn” và “Mở khóa”.

## Quy trình

- Mỗi task một session: **Task 2a** trước, **Task 2b** sau. TDD theo luật dự án; test/kiểm bằng mắt theo “Xong khi” của spec + skill `visual-check` (dark/light × desktop/mobile, một lượt). Cuối task: test liên quan + `npm run build`, ghi log, Codex review theo `codex-workflow`.
