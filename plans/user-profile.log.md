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

## 2026-11-02 — Sửa ô ngày sinh (Claude, người dùng báo lỗi)

- Lỗi: `<input type="date">` gốc xếp ô theo ngôn ngữ trình duyệt (Chrome tiếng Anh: mm/dd/yyyy) và tự nhảy ô, gõ liền 8 số bị sai (VD `20202005`).
- Sửa: ô chữ `dd/mm/yyyy` tự chèn `/` (`03032005` → `03/03/2005`), kiểm ngày có thật (31/02, tháng 20, thiếu số → lỗi định dạng), vẫn kiểm đủ 6 tuổi; gửi API `yyyy-mm-dd`. Lệch spec (spec ghi `type="date"` + `max`) theo yêu cầu người dùng.
- Test: +7 ca (3 ca gõ số, 1 ca payload ISO, 3 ca sai định dạng), đỏ trước khi sửa. `npm test` 218/218 sau khi tắt Gradle daemon (lượt trước 8 test khác timeout 5s do máy tải nặng); `npm run build` đạt.

## 2026-11-02 — Nút Chỉnh sửa + lịch chọn ngày (Claude, người dùng yêu cầu)

- Panel Thông tin cá nhân mở ở chế độ xem (danh sách nhãn/giá trị, trống hiện “Chưa cập nhật”), nút “Chỉnh sửa” góc phải header; khi sửa mới hiện ô nhập + “Hủy”/“Lưu thay đổi”. Hủy khôi phục giá trị đã lưu, không gọi API; lưu xong quay về chế độ xem. Avatar vẫn đổi độc lập.
- Ngày sinh: thêm nút lịch mở picker gốc (`showPicker()`, `max` = mốc 6 tuổi), chọn ngày điền vào ô `dd/mm/yyyy`; vẫn gõ tay được.
- Test: +3 ca (chế độ xem, Hủy, picker), các test sửa form đi qua nút Chỉnh sửa; đỏ trước khi sửa. `npm test` 221/221, `npm run build` đạt. Chưa xem bằng mắt.

## 2026-11-02 — Làm lại giao diện theo javabuilder.online/profile (Claude, người dùng yêu cầu)

- Đo trực tiếp trang mẫu bằng trình duyệt: h1 24/32 700, mô tả 14px; card bo 18px, viền 1px, đệm 20px, cách 24px, card trái 320px; menu 14px cao 40 bo 10; header card 12/20 kèm icon 28px, tiêu đề 14/600, mô tả 12px, nút Chỉnh sửa 12px; nhãn 11px in hoa; ô nhập 14px cao 38 bo 10; lưới 2 cột cách 16; tiêu đề nhóm 12px in hoa màu nhấn; avatar 80px trong card phải, 56px ở card trái.
- Viết lại `profile.css` theo thang trên (chỉ dùng token). Bố cục: card trái = avatar nhỏ + tên/email, menu, đăng xuất; card phải = header (icon, tiêu đề, nút Chỉnh sửa) → hàng ảnh đại diện → “Thông tin cơ bản” → lưới ô. Chế độ xem dùng cùng lưới ô ở dạng chỉ đọc (trống hiện “Chưa cập nhật”) để bật/tắt sửa không xô lệch; bỏ dòng gợi ý email làm lệch hàng.
- Test: sửa 3 ca chế độ xem cho bố cục mới; `npm test` 221/221, `npm run build` đạt. Xem bằng mắt trên server dev riêng (cổng 8081, khóa JWT thử vì `JWT_SECRET_KEY` trong `.env` không phải Base64): dark/light desktop đạt; sửa thêm 2 chỗ lệch (form mật khẩu, nền nút đăng xuất tất cả). Tài khoản thử đã xóa, server/Vite đã tắt.
- **Chưa kiểm:** mobile (cửa sổ không thu nhỏ được). Lệch luật: ô nhập 38px, menu 40px < 44px của `UI_GUIDE.md` để khớp trang mẫu.

## Ngoài phạm vi

- `User.updateProfile` giờ chỉ còn test dùng; có thể xóa ở task sau.
- Đổi panel (Thông tin ↔ Đổi mật khẩu) bỏ thay đổi chưa lưu của panel kia (panel unmount).
- Test UI timeout 5s khi máy tải nặng (`AuthorBlogsPage`); cân nhắc tăng `testTimeout` hoặc giảm `user.type` ở task riêng.
