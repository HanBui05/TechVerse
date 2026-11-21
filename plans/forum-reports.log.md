# Forum & reports — nhật ký

Trạng thái chính thức: xem [`PLAN.md`](PLAN.md). Spec: [`forum-reports.md`](forum-reports.md). Ba mục đầu và “Nhật ký phiên” được hook SessionStart tự nạp sau `/clear`; giữ chúng ngắn.

## Bắt đầu từ đây (cập nhật 2026-11-22)

- **Task tiếp:** Cuối module — nhờ Codex đồng bộ spec theo log (skill `codex-workflow` mục 3), rồi PR khi người dùng yêu cầu · Giao diện: Không
- Task 1a, 1b, 1c đã nhận (2026-11-21); Task 2a, 2b đã nhận (2026-11-22, đã kiểm bằng mắt Playwright cả trạng thái lỗi).
- Nhánh `feature/forum-reports` (tách từ `main` sau PR #13), commit cục bộ, chưa push.
- Chưa kiểm: full backend + full frontend (CI khi mở PR).

## Quyết định người dùng chưa có trong spec

- **2026-11-21 — Giữ cách xóa bài hỏi của F7 A:** đã cân nhắc “xóa hết” và “cấm xóa khi đã có trả lời”; người dùng giữ A (bài hỏi có câu trả lời bị xóa thì trang còn, hiện “đã xóa”, câu trả lời giữ nguyên). Không đổi spec/code.

- **2026-11-21 — React bài diễn đàn (thay cho “bình chọn” đang ở Ngoài phạm vi):** thêm Task 1c (sau 1b, trước wireframe). Bộ 4 loại `LIKE` 👍, `LOVE` ❤️, `HAHA` 😂, `ANGRY` 😡; áp cho cả bài hỏi lẫn câu trả lời; mỗi người một react trên một bài (bấm loại khác = đổi, bấm lại = bỏ); lưu DB theo người. Có danh sách “ai đã react” (giao diện chốt ở wireframe). Đã viết vào spec Task 1c; người dùng chốt 2026-11-21 sau hai vòng Codex phản biện.

- **2026-11-21 — Frontend giao AI khác, bỏ cổng wireframe:** người dùng không để Claude làm frontend nữa; Task 2a, 2b do AI khác làm theo prompt `forum-reports.frontend-prompt.md` (không sửa `server/`, tự thiết kế sạch, gọn theo `UI_GUIDE.md` và tham khảo web hỏi đáp thực tế). Bỏ cổng wireframe cho module này.

## Câu hỏi mở cho người dùng

- (không có)

## Lệch khác spec

- Task 1a — luật “Ít class” (`backend.md`) thắng tên lớp trong spec: không tạo `ForumContentService`/`ForumRateLimiter`/`ForumPostRules`; `checkContent`, `rateLimit(RateKind)` (gồm sẵn `REPORT` 10/phút cho 1b) và luật thuần (`questionReadable`, `answerReadable`, `solved`, `questionViewer`, `answerViewer`) là hàm public trong `ForumService`. Ba lớp test unit gộp thành `ForumPostRulesTest`.
- Task 1a — JSON hỏng/thiếu body vẫn trả 400 `MALFORMED_REQUEST` theo xử lý chung hiện có (spec ghi `VALIDATION_ERROR`). PATCH gửi `null`, thiếu `answerId`, `topicId` sai định dạng → 400 `VALIDATION_ERROR`. `topicId` không tồn tại → 400 `VALIDATION_ERROR` (field `topicId`).
- Task 1a — chọn lời giải trên bài hỏi `DELETED` còn hiển thị → 409 `FORUM_QUESTION_CLOSED` (bảng không ghi mã). PATCH `{}` hợp lệ, không đổi `editedAt`. `acceptedAnswerId` chỉ trả khi bài đang “đã giải quyết”; trường `null` bị bỏ khỏi JSON bài hỏi.
- Task 1a — `canReport` chưa xét “đã báo cáo” (chờ 1b, đúng spec). Task 1b đã bổ sung.
- Task 1b — “Ít class”: một `ModeratorReportController` (`/api/v1/moderator/reports` + `/forum/posts`) thay cho `ModeratorForumController` riêng; một `ReportService`; enum `ReportReason`/`ReportStatus`, `targetType` là chuỗi hằng `FORUM_POST`. Test: `ReportControllerTest` gộp hai controller, luật thuần vào `ForumPostRulesTest`, hai lớp tích hợp gộp thành `ReportIntegrationTest`; fixture chung tách ra `ForumIntegrationTestBase` (`ForumIntegrationTest` chỉ đổi lớp cha).
- Task 1b — `reason`/`action` là chuỗi có pattern để giá trị sai thành 400 `VALIDATION_ERROR` (enum Jackson sẽ ra `MALFORMED_REQUEST`). `description`/`note` chứa NUL → 400. `POST /reports` trả `{id, status, createdAt}`; `resolve` trả mục hàng đợi; `visibility` trả bài dạng Moderator.
- Task 1b — `publiclyVisible`: bài hỏi `VISIBLE`; câu trả lời `VISIBLE` và bài hỏi không `HIDDEN` (câu trả lời dưới bài hỏi `DELETED` vẫn tính là công khai vì vẫn hiện). `RESTORE` có `note` thì ghi đè `moderation_note`, không có thì giữ ghi chú ẩn. Bài đích của `resolve` không còn (không xảy ra vì không xóa cứng) → 409 `REPORT_ALREADY_HANDLED`.

- Task 1c — entity `ForumPostReaction` chỉ đọc, không kế thừa `BaseEntity` (bảng không có `created_by/updated_by`, đúng cột spec); ghi bằng upsert/delete trong repository, không gắn trigger `set_updated_at` (upsert tự đặt `updated_at`). Danh sách lọc loại dùng hai hàm `findByPostId`/`findByPostIdAndType` thay vì `:type is null` (tránh lỗi kiểu tham số null trên Postgres).
- Task 1c — PUT/DELETE react cũng tính nhịp với lần không đổi gì (PUT cùng loại, DELETE khi chưa có). `PostViewer`/`QuestionViewer` thêm `canReact` cuối record; `Summary` thêm `reactionCount`; `Answer`/`Question` thêm `reactions` (chỉ thêm trường).

## Nhật ký phiên
### 2026-11-21 — Sửa review vòng 1 (Task 2a, 2b)
- TDD (7 ca đỏ → xanh): (1) bỏ kiểm regex ảnh/HTML/link ở client (`isForumMarkdownInvalid` chỉ kiểm NUL), hiển thị `FORUM_CONTENT_INVALID` từ server ngay dưới ô đang soạn và giữ nguyên nội dung; (2) chặn `/forum/:id/edit` khi `viewer.canEdit === false` kèm nút quay lại bài; (3) tải lại chi tiết khi react hoặc thao tác ghi gặp 404/409 trạng thái nhưng vẫn giữ câu lỗi; (4) đóng hộp thoại, hiện thông báo và tải lại danh sách khi gặp `FORUM_STATE_INVALID` ở Moderator; (5) tự lùi về trang cuối hợp lệ khi xử lý mục cuối ở `page > 0`; (6) bỏ qua response về muộn của tab/lọc cũ bằng `latestRequest`; (7) hiện câu lỗi + nút `Thử lại` và khóa nút đăng khi `GET /forum/options` lỗi.
- File sửa: `app/src/services/forumService.ts` (+ `.test.ts`), `app/src/data/forumI18n.ts`, `app/src/pages/Forum/{ForumQuestionEditorPage,ForumQuestionDetailPage}.tsx` (+ `ForumPages.test.tsx`), `app/src/pages/Moderator/Reports/ModeratorReportsPage.tsx` (+ `.test.tsx`).
- Lệnh kiểm: `npx vitest run src/services/forumService.test.ts src/data/forumI18n.test.ts src/pages/Forum/ForumPages.test.tsx src/pages/Moderator/Reports/ModeratorReportsPage.test.tsx src/components/layout/Sidebar.test.tsx` → 5/5 suite, 53/53 test đạt.
- Build: `npm run build` (`tsc -b && vite build`) đạt; `server/` không thay đổi.
- Chưa kiểm: kiểm bằng mắt dark/light × desktop/mobile trên trình duyệt (chưa chạy backend/dev server trong sandbox).
- Claude kiểm lại phần sửa: đủ 7 test, 5 file 53/53 đạt, build đạt, `server/` không đổi. Còn 2 điểm thấp gửi Codex vòng 2: câu lỗi trả lời/sửa câu trả lời mất khi ô soạn biến mất sau tải lại; trang sửa khóa nút lưu khi tải chủ đề lỗi dù bài đã có chủ đề.
- Codex `adversarial-review` vòng 2 → needs-attention: [medium] câu lỗi + bản nháp mất sau tải lại (`ForumQuestionDetailPage.tsx:660-683`); [medium] đổi tab Moderator vẫn hiện dữ liệu và nút của tab cũ (`ModeratorReportsPage.tsx:362-368`, Claude xác nhận trên code). Điểm khóa lưu: xác nhận, không chặn. Đã chạm giới hạn 2 vòng; soạn prompt sửa vòng 2, chờ người dùng quyết.
- Người dùng giao Claude sửa (2026-11-21). TDD 4 ca đỏ → xanh: lỗi stale khi trả lời/sửa câu trả lời đưa câu lỗi lên đầu trang + khối “Nội dung bạn đã soạn” (sao chép/đóng, hiện cả ở trạng thái không tìm thấy); Moderator chỉ hiện dữ liệu khi `loadedKey` khớp bộ lọc (đang tải → skeleton, lỗi → chỉ khối lỗi); trang sửa không khóa “Lưu” khi tải chủ đề lỗi. Copy mới `lostDraft`, `copyDraft`. 5 file 57/57 đạt, build đạt.
- Kiểm bằng mắt (Playwright MCP, backend IntelliJ đã chạy lại có V21/V22, Vite 3000 do Claude bật rồi tắt; dữ liệu tạo qua API vào DB dev: 4 câu hỏi, 3 câu trả lời, react, 3 báo cáo chờ, 1 bài đã ẩn): Guest/learner `bao.author`/Moderator × dark/light × desktop 1280/mobile cảm ứng 390 — `/forum`, `?mine=true`, chi tiết (chủ bài, người khác, Moderator), bộ chọn react, hộp thoại/sheet “ai đã react”, hộp thoại báo cáo, `/forum/new`, `/forum/:id/edit`, `/moderator/reports` 3 tab + hộp thoại xử lý. Không tràn ngang, không lỗi console, không chữ tràn nút; duy nhất liên kết “‹ Hỏi đáp” ở chi tiết 61×20 trên cảm ứng → thêm `pointer-coarse:min-h-11` (đo lại 44px). Xem 2 ảnh: chi tiết desktop light, sheet react mobile dark — ổn. 57/57 test, build đạt sau sửa.
- Đã xóa dữ liệu thử khỏi DB dev theo yêu cầu người dùng (2026-11-22): 31 bài, 7 báo cáo `FORUM_POST`, 7 react (cascade) và khóa Redis `forum:rate:*`; diễn đàn về trống như sau V21/V22.
- Codex `adversarial-review` lại phần sửa (2026-11-22, người dùng yêu cầu, vượt giới hạn 2 vòng) → needs-attention, 3 [medium] Claude xác nhận trên code, chưa sửa, chờ người dùng quyết: tải lại lỗi cùng bộ lọc vẫn hiện thẻ + nút cũ (`ModeratorReportsPage.tsx` catch không xóa `loadedKey`); lỗi stale thứ hai ghi đè `lostDraft`; nhánh `notFound` không hiện câu lỗi thao tác (`ForumQuestionDetailPage.tsx:784`). Người dùng giao sửa (2026-11-22): TDD 3 ca đỏ → xanh — catch tải lỗi xóa `loadedKey`; `keepDraft` nối bản nháp sau `---` thay vì ghi đè; `notFound` hiện câu lỗi thao tác (bỏ nếu trùng “Không tìm thấy bài viết.”, phát hiện qua test cũ hỏng). 5 file 60/60 đạt, build đạt, `server/` không đổi. Không gọi Codex thêm vòng (khuyến nghị đã nêu).
- Kiểm bằng mắt trạng thái lỗi (2026-11-22, Playwright, desktop dark + mobile cảm ứng light; tái hiện thật qua API song song hoặc `page.route` 503): trả lời khi bài hỏi vừa bị xóa (409) và sửa câu trả lời vừa bị ẩn (404) → câu lỗi đầu trang + khối bản nháp; không tìm thấy; sửa bài người khác → “Bạn không có quyền.”; lỗi tải chủ đề (tạo: khóa “Đăng câu hỏi”; sửa: “Lưu” bật); lỗi tải danh sách; `REPORT_ALREADY_HANDLED` → thanh vàng + “Tải lại”; `FORUM_STATE_INVALID` khi hiện lại → thông báo + tải lại; đổi tab Moderator đang chờ/lỗi → không còn thẻ báo cáo cũ. Không tràn ngang, không vùng chạm < 44px, không lỗi console. Ghi chú: sau `REPORT_ALREADY_HANDLED` thẻ cũ còn tới khi bấm “Tải lại” (đúng spec 2b). Học: dừng Vite bằng TaskStop chỉ tắt `npm`, phải `taskkill /PID <vite> /T /F`; tạo dữ liệu thử nhớ giới hạn 3 câu hỏi/phút/tài khoản.
### 2026-11-21 — Task 2a & 2b: giao diện diễn đàn và kiểm duyệt báo cáo vi phạm
- Tạo `app/src/types/forum.ts`, `app/src/services/forumService.ts` (+ `.test.ts`), `app/src/data/forumI18n.ts` (+ `.test.ts`), `app/src/pages/Forum/{ForumListPage,ForumQuestionEditorPage,ForumQuestionDetailPage}.tsx` (+ `ForumPages.test.tsx`), `app/src/pages/Moderator/Reports/ModeratorReportsPage.tsx` (+ `.test.tsx`).
- Sửa `app/src/App.tsx`, `app/src/data/{navigation,managementI18n}.ts`, `app/src/components/layout/{ModeratorSidebar,AdminSidebar}.tsx`, `app/src/components/layout/Sidebar.test.tsx`.
- Lệnh kiểm: `npx vitest run src/services/forumService.test.ts src/data/forumI18n.test.ts src/pages/Forum/ForumPages.test.tsx src/pages/Moderator/Reports/ModeratorReportsPage.test.tsx src/components/layout/Sidebar.test.tsx` (5/5 suite, 46/46 test đạt) + `npm run build` (`tsc -b && vite build` đạt).
- Copy bổ sung ngoài bảng: tiêu đề phụ trang, placeholder các ô nhập, nhãn tab `Soạn thảo`/`Xem trước`, `Xem đầy đủ`/`Thu gọn` nội dung báo cáo dài, tiêu đề/mô tả hộp thoại xác nhận xử lý báo cáo và thông báo trạng thái sau khi xử lý.
- API backend: đầy đủ, không thiếu endpoint hay trường dữ liệu nào; không sửa bất kỳ file nào trong `server/`.
- Chưa kiểm: kiểm bằng mắt dark/light × desktop/mobile trên trình duyệt (chưa chạy backend/dev server trong sandbox).
- Claude kiểm lại: 5 file 46/46 test đạt, build đạt, `server/` không đổi. Review Claude + Codex `adversarial-review` → needs-attention, 6 mục trung bình chưa sửa: kiểm Markdown chặn nhầm ảnh/HTML trong code (`forumService.ts:40-48`); trang sửa bỏ qua `viewer.canEdit`; lỗi 404/409 (react, thao tác ghi, `FORUM_STATE_INVALID` Moderator) không tải lại; xử lý mục cuối ở trang > 0 để lại trang rỗng; response cũ ghi đè tab Moderator; lỗi tải chủ đề làm form tạo kẹt im lặng.
### 2026-11-21 — Task 1c: react bài diễn đàn
- V22 `forum_reactions.sql`; `ForumReactionType`, `ForumPostReaction`, `ForumPostReactionRepository`; `ForumRequest.React/ReactionFilter`; `ForumResponse.Reactions/Reactor` + `canReact`, `reactionCount`; `ForumService.react/unreact/reactions`, `RateKind.REACT` 30; `ForumController` 3 route.
- TDD: viết test 4 lớp trước, đỏ biên dịch (chưa có `ForumReactionType`, `react`…) → xanh lần đầu sau khi code.
- Lần cuối `--tests 'com.techverse.server.forum.*'` (gồm lớp 1b vì sửa `ForumService`/viewer dùng chung): Rules 12, ForumController 7, ReportController 4, Migration 1, ForumIntegration 8, ReportIntegration 6 — 38/38 đạt.
- Review vòng 1: [P2] upsert dùng `now()` (thời điểm bắt đầu transaction) → request chờ khóa nhận `reactedAt` cũ hơn request xử lý trước. Sửa: `clock_timestamp()` cho cả insert lẫn đổi loại. Test đỏ (`reactedAt` < lúc nhả khóa, `ForumIntegrationTest:353`) → xanh; `ForumIntegrationTest` 8/8 đạt.
- Review vòng 2 (`adversarial-review`, phần sửa): approve, không phát hiện. Người dùng nhận Task 1c (2026-11-21).
- Chưa kiểm: full backend (CI khi mở PR).
### 2026-11-21 — Task 1b: báo cáo vi phạm và kiểm duyệt
- `Report`, `ReportReason`, `ReportStatus`, `ReportRepository`, `ReportRequest`, `ReportResponse`, `ReportService`, `ReportController`, `ModeratorReportController`; `ForumPost.hide/restore`; 6 mã lỗi; `SecurityConfiguration`; `ForumService` đóng báo cáo `OPEN` khi người đăng xóa bài, `canReport` xét “đã báo cáo”.
- TDD: `ReportIntegrationTest` đỏ (403, chưa có route) → xanh lần đầu sau khi code.
- Lần cuối `--tests 'com.techverse.server.forum.*'`: Rules 11, ForumController 6, ReportController 4, Migration 1, ForumIntegration 5, ReportIntegration 6 — 33/33 đạt.
- Review vòng 1: [P2] `?status=` ghi đè mặc định `OPEN` thành null → hàng đợi rỗng. Sửa: `@NotNull` cho `Queue.status`, thêm ca `status=` vào `ReportControllerTest` (4/4 đạt).
- Review vòng 2 (`adversarial-review`, phần sửa): approve, không phát hiện.
- Người dùng nhận Task 1b (2026-11-21).
- Chưa kiểm: full backend (CI khi mở PR).
### 2026-11-21 — Task 1a: schema và API hỏi–đáp
- V21 `forum_reports.sql`; `ForumPost`, `ForumPostStatus`, `ForumPostRepository`, `ForumRequest`, `ForumResponse`, `ForumService`, `ForumController`; 9 mã `FORUM_*`; `SecurityConfiguration` GET `/api/v1/forum/**` permitAll, còn lại authenticated.
- TDD: migration đỏ (chưa có V21) → xanh; unit/controller/tích hợp đỏ biên dịch → xanh (sửa 3 lỗi trong test: GET khách ở `@WebMvcTest`, `findValuesAsString` lấy cả id lồng, MockMvc mã hóa lại `%` trong URL).
- Lần cuối: `ForumReportsMigrationTest` 1, `ForumPostRulesTest` 9, `ForumControllerTest` 6, `ForumIntegrationTest` 5 — 21/21 đạt.
- Chưa kiểm: full backend (CI khi mở PR).
- Review vòng 1: [P2] `accept` khóa bài `answerId` trước khi biết là câu trả lời của bài này → deadlock khi hai người chọn chéo ID bài hỏi. Sửa: đọc `parent_id` không khóa, lệch → 409 `FORUM_ANSWER_INVALID`, khớp mới khóa và kiểm lại. Test đỏ (giữ khóa bài kia ở kết nối riêng → request treo, Timeout) → xanh; Rules 9, Controller 6, Integration 5 đạt.
- Review vòng 2 (`adversarial-review`, phần sửa): approve, không phát hiện. Người dùng nhận Task 1a và chốt spec Task 1c (2026-11-21).
