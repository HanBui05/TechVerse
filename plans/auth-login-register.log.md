# Nhật ký: Auth Login & Register

## 2026-11-02 — Code (Claude)

| Bước | Kết quả |
|---|---|
| Điều kiện bắt đầu | `ui-foundation` đã commit (`6fad9a2`); người dùng giao code sau khi chốt spec. |
| Test trước | Thêm 63 test vào `App.auth.test.tsx` (tab/layout giữ mount, heading + chữ nhấn VI/EN, label nhìn thấy + `noValidate`, validation cục bộ gồm 25×`ệ` = 75 byte, ma trận cảnh báo Login/Register × {400, 401, 409, mất mạng, 429, 500, 503, 418} × vi/en, Login 401 + refresh thất bại gọi đúng 1 lần, Register 409 không gợi ý email tồn tại, toggle mắt, payload đúng 4 trường, route moderator). Chạy trước khi sửa: 60 đỏ đúng lý do; 3 test mô tả hành vi cũ xanh ngay (payload, route moderator, toggle EN vì label cũ vốn tiếng Anh). |
| Mã | Tạo `components/auth/AuthLayout.tsx`: layout route cha, tab `NavLink` (tự có `aria-current="page"`), indicator trượt bằng `data-active`, `.auth-form-panel` có `key={pathname}`; helper `alertFor` (400/401/409 → cảnh báo thông tin, còn lại → hệ thống), `isEmail` (≤ 254), `fieldState` (`aria-invalid` + `aria-describedby="auth-alert"`). Login/Register chỉ còn nội dung form; state cảnh báo lưu loại (`info`/`system`) nên câu luôn theo `t` hiện hành; không còn dùng `cause.message`. Register: ô xác nhận luôn `type="password"`; thêm `autoComplete` name/email/new-password. `App.tsx`: bọc `/login`, `/register` trong `<Route element={<AuthLayout/>}>`. `i18n.ts`: tách tiêu đề lead/accent, thêm tab, aria-label mắt, 3 câu cảnh báo cho vi/en. |
| CSS | Khối mới cuối `auth.css`, mọi selector dưới `.auth-layout`: card 480px flex/gap, tab + indicator (transform 200ms), panel fade + dịch 8px 200ms, h1 32/28px 700, chữ nhấn `--accent-text`, subtitle 16px/1.6, label, viền `--danger` cho trường sai, alert, focus-visible, nút mắt 44×44, nhánh `prefers-reduced-motion` tắt animation/transition. Các khối chỉ Login/Register dùng và đã mồ côi được đổi tên sang selector mới thay vì nhân bản (`.password-field`→`.auth-password`, `.forgot-link`→`.auth-forgot`, `.login-divider`→`.auth-divider`, `.terms-copy`→`.auth-terms`); xóa `.register-card`, `.register-submit`, `.register-error` (margin âm). Class dùng chung với Forgot/Callback giữ nguyên. `auth.css`: 0 `@import`, 0 `font-family`, 0 literal màu. |
| Test / build | `npm test`: 11 files, **144/144** đạt (mốc 81 + 63 mới). `npm run build`: đạt (cảnh báo chunk > 500 kB có từ trước). |
| Ảnh Forgot/Callback | Build HEAD và build mới, chụp bằng Chrome headless (CDP, reduced-motion, chờ Inter tải, kiểm `data-theme`): `/forgot-password` và `/auth/callback?status=error&code=AUTH_SOCIAL_EMAIL_ALREADY_REGISTERED` × dark/light × 1440×900/390×844: **0 px khác biệt** cả 8 cặp; nhiễu nền (chụp before 2 lần) 0 px. Ảnh tạm: `C:\Users\hanva\AppData\Local\Temp\claude\D--work-Project-TechVerse\635f1f61-9444-4a9f-9354-80c23621b586\scratchpad\shots\` (thư mục tạm, không đưa vào repo). |
| Login/Register | 8 trạng thái (2 trang × dark/light × 1440×900/390×844): không cuộn ngang, card nằm trong khung, h1 32px desktop / 28px mobile, 700, letter-spacing normal, Inter; chữ nhấn `#38bdf8` dark / `#0056d2` light. Tab bằng bàn phím đi qua back → brand → tab Đăng nhập → tab Đăng ký → các trường → nút mắt → quên mật khẩu/submit → Google → link cuối; mọi phần tử có focus ring. Đã xem ảnh dark desktop và light mobile. |
| `scripts/verify.sh` | **Không đạt**: frontend đạt; backend 290 test, 24 lỗi, cả 24 ở `ArticleSeedFixtureTest.java:56` (`startsWith("# title\n")`). Nguyên nhân: `core.autocrlf=true` checkout `server/src/test/resources/seed/articles/*.md` thành CRLF (`git ls-files --eol`: `i/lf w/crlf`). Có từ trước, không liên quan module này (không sửa `server/`). |
| Review vòng 1 | Codex: 1 lỗi P2, regex email cho qua `user@example..com`, `user@.example.com` (trái “Xong khi” dòng 100). Đúng, đã sửa. |

## 2026-11-02 — Sửa sau review vòng 1 (theo ngân sách D-018)

- `isEmail` dùng regex WHATWG của `type="email"`; thêm 11 unit test gọi thẳng hàm (8 ca sai, 3 ca đúng). Trước khi sửa: 5 đỏ đúng lý do.
- `npm test`: 11 files, **155/155** đạt; `npm run build` đạt. Không chạy `verify.sh` (chỉ sửa `app/`).
- Người dùng chọn chỉ sửa frontend; không thêm annotation email ở backend.
- Review vòng 2 (Codex): đạt, không còn lỗi.

## 2026-11-02 — Sửa theo `/code-review` (người dùng chọn điểm 2, 4)

- Điểm 2: form đăng nhập chỉ chặn email rỗng hoặc > 254 ký tự, không kiểm định dạng; regex WHATWG chặn email Unicode mà `@Email` backend chấp nhận. **Lệch “Xong khi” dòng 100 ở phía login, người dùng chấp nhận.** Đăng ký vẫn kiểm định dạng.
- Điểm 4: Quên mật khẩu không hiện câu lỗi gốc; 400/401/409 → `requestFailed`, còn lại → `systemAlert`, theo vi/en.
- Điểm 3: ảnh “0 px” của `/forgot-password` ở trên không còn đúng; trang đã làm lại trong task làn nhẹ “Forgot password UI” (người dùng cho phép). Commit tách riêng.
- Điểm 1, 5–9: ngoài phạm vi (lỗi `/users/me` sau login bị xếp nhóm thông tin; tách helper khỏi `AuthLayout.tsx`; gom markup trùng; xóa `aria-invalid` khi người dùng sửa).
- +5 test (đỏ trước khi sửa), bỏ 1 ca login “invalid email”. `npm test` 161/161, build đạt.
- Codex review working tree (quá giới hạn 2 vòng, người dùng cho sửa): `isEmail` cho qua `user..name@`, `.user@`, phần trước `@` > 64 ký tự. Đã sửa (đoạn ngăn bởi dấu chấm đơn, ≤ 64); +4 ca unit đỏ trước khi sửa. `npm test` 165/165, build đạt. Không chạy thêm vòng review. Codex không chạy lại được test (sandbox chỉ đọc), dựa vào log 155/155.

### Ngoài phạm vi / chưa kiểm

- Lỗi CRLF của `ArticleSeedFixtureTest` cần task riêng (ví dụ `.gitattributes` cho `*.md` seed `eol=lf`, hoặc test chuẩn hóa xuống dòng).
- Chưa chụp trạng thái có cảnh báo/trường sai và hover; chỉ kiểm bằng test DOM.
- `.passkey-button`, `.social-mark`, `.github-mark`, `.linkedin-mark` đã mồ côi từ trước module này; không xóa.
- Login 401 vẫn thử refresh một lần (hành vi có trước, đã ghi trong spec là task session/token riêng).
