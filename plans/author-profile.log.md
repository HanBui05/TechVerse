# Author profile — nhật ký

## 2026-11-02 — Backend (Claude)

- Đỏ: `./gradlew test --tests AuthorProfileIntegrationTest --tests AdminAuthorApplicationIntegrationTest` → 43 test, 11 lỗi đúng lý do (thiếu bảng `author_application_reviews`, thiếu `reviewHistory`).
- Xanh: cùng lệnh → `AdminAuthorApplicationIntegrationTest` 29/29 (26 cũ + 3 mới), `AuthorProfileIntegrationTest` 14/14; BUILD SUCCESSFUL 1m52s. Một lần sửa test: so `reviewedAt` lấy cùng từ DB (response ngay sau review giữ nano giây trong bộ nhớ, DB lưu micro giây; hai cột vẫn dùng chung một `Instant`).
- Regression lớp bị ảnh hưởng gián tiếp bởi V8: `DatabaseBootstrapIntegrationTest` 2/2, `AdminUserIntegrationTest` 29/29.
- V8: FK `author_profile_id ON DELETE CASCADE`; CHECK note chặn cả `NULL`; unique `(profile, version)`; không backfill (D-022). Test JDBC chứng minh `NULL`/`''`/`'   '`, decision lạ và trùng version bị từ chối; `users.deleteAll()` sau khi có history không lỗi.
- Không chạy `scripts/verify.sh` (D-021, full backend do CI). Chưa có: review Codex.
- 2026-11-02: Người dùng nhận kết quả Backend; Codex review không có phát hiện thuộc author.
