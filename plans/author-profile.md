# Author Profile

Trạng thái: xem [`PLAN.md`](PLAN.md). Spec do Codex viết; Claude chỉ ghi vào mục “Phản hồi”.

**Mục tiêu:** Kiểm chứng và giữ ổn định toàn bộ Backend từ lúc người dùng nộp hồ sơ tác giả đến khi admin duyệt/từ chối, gửi lại, đình chỉ/khôi phục quyền; bổ sung lịch sử append-only cho mọi quyết định duyệt/từ chối để không mất phản hồi sau khi hồ sơ được gửi lại.
**Làn:** Đầy đủ
**Giai đoạn:** Backend
**Đổi giao diện:** Không

## Đường dẫn thuộc module

Chỉ được sửa các đường dẫn sau. Ngoài danh sách là ngoài phạm vi.

- `server/src/main/resources/db/migration/V8__create_author_application_review_history.sql` — tạo bảng lịch sử trống cùng ràng buộc/index; không backfill dữ liệu cũ theo D-022.
- `server/src/main/java/com/techverse/server/entity/AuthorApplicationReview.java` — tạo mới; bản ghi xét duyệt bất biến, có snapshot nội dung.
- `server/src/main/java/com/techverse/server/repository/AuthorApplicationReviewRepository.java` — tạo mới; lưu và đọc lịch sử theo hồ sơ với thứ tự ổn định.
- `server/src/main/java/com/techverse/server/dto/response/AuthorReviewHistoryResponse.java` — tạo mới; lịch sử an toàn cho chính chủ, không có định danh admin.
- `server/src/main/java/com/techverse/server/dto/response/AdminAuthorReviewHistoryResponse.java` — tạo mới; lịch sử đầy đủ cho admin.
- `server/src/main/java/com/techverse/server/dto/response/MyAuthorProfileResponse.java` — thêm danh sách lịch sử cho `GET /author-profiles/me`.
- `server/src/main/java/com/techverse/server/dto/response/AdminAuthorApplicationDetailResponse.java` — thêm danh sách lịch sử cho admin detail và response sau review/status action.
- `server/src/main/java/com/techverse/server/service/impl/AuthorProfileServiceImpl.java` — ánh xạ lịch sử an toàn cho owner; giữ nguyên apply/resubmit/permission.
- `server/src/main/java/com/techverse/server/service/impl/AdminAuthorApplicationServiceImpl.java` — ghi lịch sử cùng transaction review và ánh xạ lịch sử đầy đủ cho admin.
- `server/src/test/java/com/techverse/server/author/AuthorProfileIntegrationTest.java` — regression apply/get và quyền riêng tư lịch sử owner.
- `server/src/test/java/com/techverse/server/admin/AdminAuthorApplicationIntegrationTest.java` — lịch sử review, snapshot, constraint, concurrency, rollback, resubmit và quyền admin.

## Bản đồ chi tiết

| Hiện ở đâu (file, tên class/hàm/bean) | Dùng bởi (component/trang/lớp gọi) | Đích sau thay đổi |
|---|---|---|
| `ApplyAuthorProfileRequest` | `POST /api/v1/author-profiles/me` | Giữ `bio` 50–2000, `expertise` 3–255, portfolio HTTP/HTTPS tùy chọn và chuẩn hóa hiện có |
| `AuthorProfileServiceImpl.apply/getMyProfile/resubmit` | Người nộp hồ sơ | Giữ một hồ sơ/user, `NOT_APPLIED → PENDING`, chỉ `REJECTED` được resubmit cùng `expectedVersion`; GET owner trả thêm lịch sử an toàn |
| `ReviewAuthorApplicationRequest` + `AuthorReviewValidator` | `PATCH /admin/author-applications/{id}/review` | Giữ lý do bắt buộc khi `REJECTED`, note tối đa 2000 và optimistic version |
| `AdminAuthorApplicationServiceImpl.review` | Admin duyệt/từ chối | Trong cùng transaction với đổi trạng thái/thêm role, append đúng một review event chứa snapshot và version trước review |
| `AuthorProfile.review` và các cột `review_*` | Response hiện tại và tương thích ngược | Tiếp tục giữ quyết định gần nhất; history mới là nguồn cho toàn bộ chu kỳ, không xóa theo resubmit |
| `AuthorProfile.resubmit` đang xóa `reviewNote/reviewedBy/reviewedAt` | Người dùng sửa và gửi lại hồ sơ bị từ chối | Vẫn xóa trạng thái review hiện tại để trở về `PENDING`, nhưng bản ghi lịch sử cũ không đổi |
| `JwtConfiguration` + `AuthorProfileService.isApprovedAuthor` | Mọi endpoint `hasRole('AUTHOR')` | Giữ kiểm tra động role + tài khoản active + profile `APPROVED`; suspension/JWT cũ không được nới |
| `suspend/restore` và audit V7 | Quản lý tác giả sau phê duyệt | Giữ độc lập; không tạo record trong lịch sử xét hồ sơ `APPROVED/REJECTED` |
| `MyAuthorProfileResponse` | Owner xem trạng thái/phản hồi | Thêm `reviewHistory` mới nhất trước, có decision/note/version/snapshot/time; không có reviewer ID/name |
| `AdminAuthorApplicationDetailResponse` | Admin xem detail/review/suspend/restore | Thêm `reviewHistory` mới nhất trước, có thêm reviewer ID và tên snapshot |

- Baseline ngày 2026-11-02: `AuthorProfileIntegrationTest` 14/14 và `AdminAuthorApplicationIntegrationTest` 26/26 đạt; tổng 40/40, `BUILD SUCCESSFUL` trong 2 phút.
- Backend hiện đã đúng ở các điểm: rejection note bắt buộc; stale/concurrent review-resubmit bị chặn; approval thêm AUTHOR nguyên tử; refresh lấy role mới; JWT cũ mất AUTHOR khi profile không `APPROVED`; suspension không khóa tài khoản và restoration không tự mở khóa.

## Phạm vi

- Tạo bảng `author_application_reviews` append-only. Mỗi record tương ứng đúng một quyết định admin thành công `APPROVED` hoặc `REJECTED`, gồm:
  - `author_profile_id` bắt buộc tham chiếu `author_profiles(id) ON DELETE CASCADE`; `application_version` là version request đã xét trước khi profile tăng version. Cascade chỉ phục vụ xóa cứng toàn aggregate user/profile, không phải sửa/xóa riêng history.
  - `decision`, `review_note`, `reviewed_at`.
  - `reviewed_by` tham chiếu user với `ON DELETE SET NULL` và `reviewer_name_snapshot` để lịch sử vẫn đọc được nếu tài khoản admin không còn.
  - Snapshot `bio`, `expertise`, `portfolio_url` tại thời điểm xét.
  - Audit chuẩn từ `BaseEntity`; entity không có method sửa/xóa nội dung lịch sử.
- DB có CHECK decision chỉ nhận `APPROVED/REJECTED`; CHECK rejection note dùng đúng biểu thức `decision <> 'REJECTED' OR (review_note IS NOT NULL AND btrim(review_note) <> '')` để chặn cả `NULL` lẫn chuỗi rỗng; `application_version` bắt buộc và không âm; unique `(author_profile_id, application_version)` và index `(author_profile_id, reviewed_at DESC, application_version DESC)`.
- `AdminAuthorApplicationIntegrationTest` kiểm trực tiếp constraint bằng JDBC vì `ddl-auto: validate` không xác nhận CHECK/unique: REJECTED với note `NULL`, note `''` và duplicate `(author_profile_id, application_version)` đều phải bị DB từ chối.
- Theo D-022, V8 chỉ tạo bảng trống và không chuyển dữ liệu review cũ. DB dev đã được làm mới để Flyway chạy lại từ V1; môi trường dev còn schema V1–V7 cũ phải làm mới trước khi dùng task này. Lịch sử bắt đầu từ quyết định review đầu tiên sau V8, không có cột/khái niệm `legacy` và không suy đoán record quá khứ.
- Trong `review`, lấy một `Instant` dùng chung, tạo history từ profile trước mutation, rồi cập nhật profile/thêm role như hiện tại. History, role và current review phải commit/rollback cùng transaction; mọi lỗi validation, self-review, inactive, stale version, status không phải PENDING hoặc lỗi flush không tạo history.
- `review_note` trong history dùng đúng giá trị đã chuẩn hóa như current profile: trim hai đầu, chuỗi rỗng thành `null`; history và các cột `review_*` hiện tại không được lệch nội dung.
- Thứ tự lịch sử là `reviewedAt DESC, applicationVersion DESC`. Hai admin cạnh tranh cùng version chỉ một người thành công và chỉ có một record; lần resubmit/review tiếp theo tạo record mới với snapshot/version mới mà không sửa record cũ.
- `GET /api/v1/author-profiles/me` trả `reviewHistory: []` khi chưa có lịch sử. Owner thấy decision, note, applicationVersion, snapshots và reviewedAt; không trả reviewer ID, tên hoặc audit nội bộ.
- Admin detail và mọi response dùng `AdminAuthorApplicationDetailResponse` trả cùng lịch sử, thêm `reviewedBy` nullable và `reviewerNameSnapshot`. Admin list phân trang không nhúng history để tránh tăng tải.
- Giữ các cột review hiện tại và shape field hiện tại để tương thích; lịch sử là field response cộng thêm, không đổi request, URL, status code hoặc semantics hiện có.
- Audit lại bằng regression toàn bộ chuỗi apply → reject → owner đọc note → resubmit → approve → refresh nhận AUTHOR → suspend/restore; chỉ sửa lỗi thực tế nếu test chứng minh trong phạm vi các đường dẫn đã liệt kê.

## Ngoài phạm vi

- Không sửa `app/` hoặc giao diện; giai đoạn Giao diện chỉ mở sau khi Backend này được nhận kết quả.
- Không thêm bằng cấp/chứng chỉ, upload tài liệu, nhiều portfolio, sample article hoặc field hồ sơ mới.
- Không thêm email, notification hoặc polling khi admin phản hồi; đây là module riêng nếu cần.
- Không chuyển sang mô hình application revision riêng và không tạo bản sao cho mỗi lần submit/resubmit; snapshot chỉ được lưu khi admin ra quyết định.
- Không đưa `SUSPENDED`/`RESTORED`, khóa/mở tài khoản hoặc thay đổi role thủ công vào bảng review history; các audit hiện tại của V7 giữ nguyên.
- Không backfill hoặc suy đoán lịch sử trước V8; không sửa V1–V7. Việc làm mới DB dev đã được chốt ở D-022 và nằm ngoài phần code của task này.
- Không thêm endpoint xóa/sửa history, không cho owner xem định danh admin, không đổi quyền ADMIN hoặc cơ chế JWT/session.
- Không đổi filter/sort admin list, trạng thái enum, rate limit hoặc luồng article.

## Ràng buộc

- Được đổi API: Có — chỉ thêm field response `reviewHistory`. Được đổi DB (Flyway mới): Có — chỉ V8, không sửa migration cũ.
- Giữ nguyên hành vi hiện tại: Có; thay đổi duy nhất là lưu và trả lịch sử duyệt/từ chối.
- Entity mới kế thừa `BaseEntity`, quan hệ LAZY, không trả entity trực tiếp và không thêm dependency.
- `AuthorApplicationReview` là append-only ở tầng nghiệp vụ: repository chỉ cần save và query; không thêm API update/delete. `ON DELETE CASCADE` chỉ xóa history khi toàn aggregate profile bị xóa cứng.
- Snapshot phải lấy trước khi `AuthorProfile.review`; reviewer name lấy tại thời điểm review, không join động để thay đổi theo tên admin sau này; note dùng cùng giá trị đã chuẩn hóa cho current profile và history.
- Owner/admin dùng hai DTO riêng để reviewer identity không thể vô tình lọt vào API owner.
- Không sinh query N+1: một query repository history dùng chung cho owner/admin, không hydrate reviewer; admin lấy `reviewedBy` từ FK/proxy và tên từ snapshot. Mỗi detail/profile tối đa một query history bổ sung.

## Xong khi

- [ ] 40 test baseline tiếp tục đạt, khóa nguyên các contract: field apply, rejection note, expectedVersion, concurrency, role/session, suspension/restoration và quyền owner/admin.
- [ ] V8 tạo bảng trống trên DB chạy Flyway từ V1, có FK `author_profile_id ... ON DELETE CASCADE`, CHECK/unique/index đã nêu; không có SQL backfill, cột `legacy` hoặc nullable application version, và migration không sửa V1–V7. `AdminAuthorApplicationIntegrationTest` dùng JDBC chứng minh REJECTED note `NULL`, note `''` và cặp `(profile, version)` trùng bị DB từ chối; cleanup xóa user sau khi có history không lỗi.
- [ ] Review APPROVED/REJECTED thành công tạo đúng một history record với decision, note đã chuẩn hóa, actor + name snapshot, pre-review version, snapshot hồ sơ và cùng timestamp nghiệp vụ; approval vẫn thêm AUTHOR nguyên tử.
- [ ] Validation/self-review/inactive/stale/already-reviewed/missing-role/lỗi flush không để lại history; hai admin review cùng version chỉ có một response thành công và một record.
- [ ] Reject → owner đọc note/history → resubmit → reject/approve lần hai giữ hai record bất biến, đúng snapshot/version và mới nhất trước; current review fields vẫn clear khi PENDING như trước.
- [ ] `GET /author-profiles/me` trả `reviewHistory` rỗng hoặc đầy đủ nhưng không có reviewer ID/name; test serialization chứng minh không rò định danh admin.
- [ ] Admin detail/review/status response trả lịch sử đầy đủ kèm reviewer ID/name snapshot; admin list không chứa history và quyền đọc hiện tại không bị nới.
- [ ] Suspend/restore không tạo review record, không sửa record cũ và các regression JWT cũ/refresh/account lock vẫn đạt.
- [ ] Chỉ các file Backend trong “Đường dẫn thuộc module” thay đổi, không có dependency/frontend ngoài phạm vi; chạy `./gradlew test --tests 'com.techverse.server.author.AuthorProfileIntegrationTest' --tests 'com.techverse.server.admin.AdminAuthorApplicationIntegrationTest'` trong `server/` đạt. Full backend do CI chạy khi mở PR, không chạy `scripts/verify.sh` local.

## Phản hồi vòng 1 (Claude)

Đã xác nhận thiết kế append-only + snapshot là hướng nhỏ nhất; chỉ ra các rủi ro backfill, thứ tự, chuẩn hóa note, query và kiểm thử migration. D-022 loại bỏ backfill/legacy; các điểm còn áp dụng đã được gộp vào thân spec.

## Trả lời vòng 1 (Codex)

Đã chấp nhận thứ tự theo `reviewedAt + applicationVersion`, note chuẩn hóa, một query history chung; bỏ backfill/legacy và test migration dữ liệu cũ theo D-022.

## Phản hồi vòng 2 (Claude)

Đã thống nhất vòng 1; bổ sung FK history `ON DELETE CASCADE`, test JDBC cho CHECK/unique và yêu cầu CHECK chặn rõ cả note `NULL` lẫn rỗng.

## Trả lời vòng 2 (Codex)

Đã chấp nhận toàn bộ: FK cascade theo aggregate, kiểm trực tiếp `NULL`/rỗng/duplicate bằng JDBC, biểu thức CHECK chính xác. Không còn bất đồng kỹ thuật.

## Quyết định của người dùng

- 2026-11-02: Người dùng chọn hướng 1 — bảng lịch sử xét duyệt append-only có snapshot, giữ API hiện tại tương thích; history chỉ gồm APPROVED/REJECTED, suspension/restoration dùng audit riêng.
- D-022: DB dev và Redis đã làm mới; V8 không backfill, history bắt đầu từ dữ liệu mới, không có `legacy` hoặc application version nullable.
- Owner không thấy danh tính admin; admin thấy đầy đủ; history chỉ bị cascade khi toàn profile bị xóa cứng.
- 2026-11-02: Người dùng chốt spec Backend `author-profile`; giao Claude thực hiện.
