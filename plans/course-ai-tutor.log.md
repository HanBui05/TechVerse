# Course AI tutor — nhật ký

Trạng thái chính thức: xem [`PLAN.md`](PLAN.md). Spec: [`course-ai-tutor.md`](course-ai-tutor.md). Ba mục đầu và “Nhật ký phiên” được hook SessionStart tự nạp sau `/clear`; giữ chúng ngắn.

## Bắt đầu từ đây (cập nhật 2026-11-17)

- **Task tiếp:** Module hoàn tất và đã merge (2026-11-17); không còn task · Giao diện: Không
- Spec chốt lại 2026-11-17 sau phản biện vòng 1 (không chạy vòng 2); lịch sử ở `course-ai-tutor.review.md`.
- PR #10 đã merge vào `main` 2026-11-17, CI `test-server` đạt. Còn chưa kiểm: dark mobile, cảm ứng thật/vùng chạm 44px, lỗi/hết quota/Dừng trên giao diện thật.

## Quyết định người dùng chưa có trong spec

- (không có)

## Câu hỏi mở cho người dùng

- (không có)

## Nhật ký phiên
### 2026-11-17 — Nhận Task 2
- Người dùng nhận Task 2; commit cục bộ trên `feature/course-ai-tutor`.
### 2026-11-17 — Task 2 giao diện
- Người dùng bảo “triển khai task” sau khi có wireframe: coi là duyệt wireframe với 4 mặc định mục 8 (diễn giải của Claude).
- Code: `LessonTutorSheet.tsx` (`LessonTutor`: nút + sheet), `CourseLessonPage` (gắn, `key={lesson.id}` xóa hội thoại khi đổi bài), `courseService.lessonTutor`, `aiAssistService.streamPost` (tách từ `streamDraft`), `courseI18n` (`tutorText`, `tutorError`), `metadata.contextTruncated`.
- Test: `vitest run` LessonTutorSheet, CourseLessonPage, courseI18n, courseService, aiAssistService → 188 đạt; `npm run build` đạt. Test service/i18n viết sau code (không thấy đỏ trước).
- Lệch khác spec: lịch sử gửi cắt mỗi tin AI còn 2.000 ký tự (giới hạn server); lượt lỗi không có phần trả lời không đưa vào lịch sử.
- Kiểm bằng mắt (Playwright, backend thật, `bao.author` ở bài học thử `Java cơ bản…`): dark desktop (sheet 420px, focus vào ô nhập, stream thật, quota 19/20), light desktop (đo màu token), light mobile 390 (toàn màn hình, không cuộn ngang, quota 18/20). Chưa kiểm: cảm ứng thật (`pointer: coarse` = false, vùng chạm 44px chỉ kiểm bằng class), trạng thái lỗi/hết quota/Dừng trên giao diện thật (đã có test). Chưa chạy review Codex.
- Review vòng 1 (`review`; lần đầu lỗi 503 hạ tầng, chạy lại được): 3 góp ý P2, đều đúng, đã sửa: lịch sử giữ lượt Dừng/lỗi có phần trả lời; đọc lại quota thêm lần sau 2,5 giây khi ngắt/đứt stream; đổi ngôn ngữ tải ngầm nên không xóa hội thoại. Test lại: 5 file 189 đạt + build đạt. Vòng 2 (`adversarial-review`): 1 phát hiện medium — tải ngầm lỗi vẫn đưa trang sang màn lỗi (mất hội thoại) và `setData` không xóa `failure` cũ. Đúng; đã sửa (tải ngầm lỗi tạm thời thì giữ bài, trừ 403/404; thành công xóa `failure`) + thêm ca test. 2 file Courses 22 đạt + build đạt. Không chạy vòng 3.
### 2026-11-17 — Wireframe Task 2
- Viết `plans/course-ai-tutor.wireframe.md` (desktop + mobile; trống, đang trả lời, xong, Dừng, lỗi theo mã có/không có phần đã nhận, hết quota, bài chỉ video, guest). Chỉ tài liệu, chưa code. Chờ duyệt.
### 2026-11-17 — Nhận Task 1
- Người dùng nhận Task 1; commit cục bộ trên `feature/course-ai-tutor`.
### 2026-11-17 — Task 1 backend
- Code: `LessonTutorController/Service/Request`, `PublishedCourseService.tutorLesson` (tách `readable(...)` dùng chung với GET bài), `AiPromptFactory.tutor`, `Kind.TUTOR`, registry theo (người, loại), `Metadata.contextTruncated`, `longestTimeout()`, `AI_TUTOR_LESSON_NO_CONTENT`, YAML/`.env.example`.
- Test: `./gradlew test --tests 'com.techverse.server.ai.*' --tests '…course.LessonTutorIntegrationTest' --tests '…CourseLearningIntegrationTest' --tests '…PublishedCourseIntegrationTest'` → 156 đạt, 0 lỗi (gồm test `Ai*`/`drafts:stream` cũ). Chưa chạy full backend (CI).
- Lệch khác spec: `LessonTutorController` không dùng quota header riêng (tái dùng hằng của `AuthorAiController`); `Metadata` có thêm constructor 2 tham số (draft = false); bài có nội dung rỗng/toàn khoảng trắng cũng là `AI_TUTOR_LESSON_NO_CONTENT`; phản hồi rỗng với finish `stop` coi là `AI_PROVIDER_UNAVAILABLE` (hoàn lượt).
- Review vòng 1 (`review`): 2 góp ý P2. Sửa: `role` lịch sử đổi sang chuỗi + `@Pattern` để trả `VALIDATION_ERROR` (test đạt lại). Từ chối: hoàn lượt khi ngắt lúc emitter chưa khởi tạo — spec định nghĩa theo “send thành công delta đầu”, cùng cơ chế `drafts:stream`; tệ nhất mất 1 lượt. Không chạy vòng 2 (sửa nhỏ, có test).
- Ca MVC async: kiểm bằng `AiRateLimitServiceTest.asyncTimeoutMustCoverTheTutorDeadlineToo` (chưa có lớp test riêng cho `AiAssistConfiguration`).
### 2026-11-17 — Phản biện spec vòng 1
- Codex ghi “Phản hồi vòng 1”; Claude kiểm từng ý trên code và trả lời (chấp nhận phần lớn; từ chối API hủy và mã HTTP riêng cho lỗi nhà cung cấp).
- Sửa thân spec: `LESSON_PREVIEW_ONLY` thay `ACCESS_DENIED`, GET bài không tự enroll, chủ khóa/`USER_INACTIVE`/JSON hỏng/Redis hoàn lượt, slot registry theo loại, `contextTruncated` trong `metadata`, history 2.000 ký tự, token `TUTOR` 2.048, cổng wireframe Task 2, bớt ca tích hợp còn 5.
- Người dùng chốt (“ok”): không vòng 2; theo dõi chi phí AI tách module sau (ghi `PLAN.md`); chuyển tranh luận sang `course-ai-tutor.review.md`.
### 2026-11-17 — Mở module
- Chuyển `Module đang làm` sang `course-ai-tutor`; tạo log này.
