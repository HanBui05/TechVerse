# User profile — nhật ký

## 2026-11-02 — Backend (Claude)

- Đỏ: `./gradlew compileTestJava` lỗi thiếu `ChangeMyPasswordRequest`/`PasswordChangeAttemptRepository` (đúng lý do).
- Xanh: `./gradlew test --tests ChangeMyPasswordRequestTest --tests UserServiceImplTest --tests UserProfileIntegrationTest --tests JwtTokenServiceIntegrationTest` → 5 + 6 + 12 + 10 = 33/33 đạt, 1m49s, đạt ngay lần đầu.
- `scripts/verify.sh` (một lần): backend 310/310 đạt, frontend 165/165 đạt, build đạt, exit 0, 9m48s. Regression: `AuthLoginIntegrationTest` 14/14, `UserAvatarIntegrationTest` 3/3, `UserAvatarWithStorageIntegrationTest` 15/15.
- Không đổi `app/`, migration, dependency. `User.updateProfile` cũ giữ nguyên vì `AdminUserIntegrationTest` (ngoài phạm vi) còn dùng.
- Chưa có: review Codex.

## 2026-11-02 — Giao diện (Claude)

- Đỏ: `npx vitest run src/pages/Profile src/App.auth.test.tsx` → 28 test mới lỗi (thiếu label/nhánh), `ChangePasswordPanel` chưa tồn tại (đúng lý do).
- Xanh: `ChangePasswordPanel.test.tsx` 14, `ProfilePage.test.tsx` 27, `App.auth.test.tsx` +1 regression logout-all.
- Cuối: `npm test` 207/207 (165 + 42), `npm run build` đạt. Lần chạy song song với build: 1 test cũ timeout 5s do tải máy (lượt 1 `App.auth` register `user.type` 255 ký tự; lượt 2 `AuthorBlogsPage` cover upload, đạt 11/11 khi chạy riêng); chạy `npm test` riêng đạt toàn bộ.
- Sửa helper `fillRegister` (`App.auth.test.tsx`): chuỗi > 20 ký tự dùng `user.paste` theo luật frontend; ngoài phạm vi spec, cần để suite không chập chờn.
- Kiểm tĩnh: 0 literal màu/gradient trong `pages/Profile`, `profile.css`, `data/profile.ts`; không còn `window.confirm/alert` ở profile, không còn `.logout-all-panel`/`.profile-upload-*`.
- **Chưa kiểm:** 4 ảnh dark/light × 1440/390, focus avatar bằng bàn phím, focus trap dialog thật — repo không có công cụ chụp và `/profile` cần backend + DB chạy để đăng nhập.
- Codex review vòng 1: 1 phát hiện P2 — mốc 6 tuổi ngày 29/02 lăn sang 01/03 (JS `setFullYear`), lệch Java `minusYears`/`Period`. Đã xác minh và sửa (kẹp ngày cuối tháng), +1 test đỏ trước khi sửa. `npm test` 208/208, build đạt.

## Ngoài phạm vi

- `User.updateProfile` giờ chỉ còn test dùng; có thể xóa ở task sau.
- Đổi panel (Thông tin ↔ Đổi mật khẩu) bỏ thay đổi chưa lưu của panel kia (panel unmount).
- Test UI timeout 5s khi máy tải nặng (`AuthorBlogsPage`); cân nhắc tăng `testTimeout` hoặc giảm `user.type` ở task riêng.
