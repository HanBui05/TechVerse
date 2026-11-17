# Exercise practice — nhật ký

Trạng thái chính thức: xem [`PLAN.md`](PLAN.md). Spec: [`exercise-practice.md`](exercise-practice.md). Ba mục đầu và “Nhật ký phiên” được hook SessionStart tự nạp sau `/clear`; giữ chúng ngắn.

## Bắt đầu từ đây (cập nhật 2026-11-17)

- **Task tiếp:** Task 1b — Moderator duyệt, khu Luyện tập và lượt làm (Task 1a đã nhận 2026-11-17) · Giao diện: Không
- Spec chốt 2026-11-15; `course-payment` và `course-ai-tutor` đã merge vào `main` nên đủ điều kiện bắt đầu. Migration lấy số kế tiếp lúc code (spec ghi V14 nếu V13 đã có) — kiểm `db/migration` trước.
- Nhánh: `feature/exercise-practice` (từ `main` sau PR #10).

## Quyết định người dùng chưa có trong spec

- (không có)

## Câu hỏi mở cho người dùng

- (không có)

## Nhật ký phiên
### 2026-11-17 — Task 1a đã nhận: schema + API tác giả
- Migration `V19__exercise_practice.sql` (V13–V18 đã dùng). Code: `ExerciseSet/ExerciseQuestion`, `AuthorExerciseService` (validator `normalize` static, rate limit Redis, khóa dòng), `AuthorExerciseController`, `ExerciseSetRequest/Response`; `CustomException` có `fieldErrors`.
- Test: `ExercisePracticeMigrationTest`, `ExerciseLifecycleTest` (cả validator), `AuthorExerciseControllerTest`, `AuthorExerciseIntegrationTest` + `AuthorAiControllerTest`, `DatabaseBootstrapIntegrationTest` — 51 ca, 0 lỗi.
- Lệch khác spec: theo luật “ít class” không tạo `ExerciseAccessService`/`ExerciseQuestionValidator` riêng (private/static trong service); `version` sai kiểu JSON → `MALFORMED_REQUEST` (hành vi chung), thiếu/âm → `VALIDATION_ERROR`; submit khi chủ đề ngừng → `EXERCISE_NOT_READY`; rate limit để trong service tác giả — 1b chuyển ra nếu cần dùng chung.
- Review vòng 1 (2 phát hiện P2, đúng): PATCH/PUT chưa kiểm chủ đề đang giữ; NUL trong snippet/ngôn ngữ/lựa chọn/title/description gây lỗi DB. Đã sửa + thêm ca test `savesRecheckTheKeptTopicAndRejectNulCharacters`; 3 lớp test liên quan đạt. Vòng 2 (adversarial, chỉ phần sửa): approve, không phát hiện.
- Chưa làm: entity chuyển Moderator đã có sẵn (`approve/moderatorHide/...`) cho 1b.

### 2026-11-17 — Mở module
- Chuyển `Module đang làm` sang `exercise-practice`; tạo log này; ghi CI đạt/PR #10 đã merge vào `course-ai-tutor`.
