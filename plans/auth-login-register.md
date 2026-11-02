# Auth Login & Register

Trạng thái: xem [`PLAN.md`](PLAN.md). Spec do Codex viết; Claude chỉ ghi vào mục “Phản hồi”.

**Mục tiêu:** Làm mới hai màn đăng nhập/đăng ký trong card auth hiện có: bổ sung tab chuyển màn có hiệu ứng, tăng phân cấp typography nhưng chỉ dùng Inter, hiển thị cảnh báo chung đúng ngôn ngữ và sửa icon mắt đăng ký để chỉ điều khiển ô mật khẩu. Giữ nguyên API, payload và toàn bộ hành vi xác thực hiện có.
**Làn:** Đầy đủ
**Giai đoạn:** Giao diện
**Đổi giao diện:** Có

## Đường dẫn thuộc module

Chỉ được sửa hoặc tạo các đường dẫn sau. Ngoài danh sách là ngoài phạm vi.

- `app/src/App.tsx` — đặt route `/login` và `/register` trong layout auth dùng chung; không đổi route hoặc luồng xác thực khác.
- `app/src/components/auth/AuthLayout.tsx` — layout card dùng chung, tab Đăng nhập/Đăng ký và vùng chuyển tiếp giữa hai form.
- `app/src/pages/Login/LoginPage.tsx` — nội dung form đăng nhập, tiêu đề/subtitle, label nhìn thấy được và cảnh báo chung theo ngôn ngữ.
- `app/src/pages/Register/RegisterPage.tsx` — nội dung form đăng ký, validation giao diện, cảnh báo theo ngôn ngữ và trạng thái hiện mật khẩu độc lập.
- `app/src/data/i18n.ts` — copy Việt/Anh cho tab, label, aria-label và cảnh báo chung của hai form.
- `app/src/styles/pages/auth.css` — bố cục card/tab/form, typography Inter, active/focus/error state, chuyển động và responsive của riêng auth.
- `app/src/App.auth.test.tsx` — kiểm thử tích hợp route, tab, payload, ngôn ngữ cảnh báo, mật khẩu và các luồng auth phải giữ.

## Bản đồ chi tiết

| Hiện ở đâu (file, tên class/hàm/bean) | Dùng bởi (component/trang/lớp gọi) | Đích sau thay đổi |
|---|---|---|
| `App.tsx`, hai route độc lập `/login` và `/register` | `LoginPage`, `RegisterPage` | Hai route dùng `AuthLayout` chung; URL và callback `onLogin`/`onRegister` giữ nguyên |
| `LoginPage.tsx`, toàn bộ `.login-page > .login-card` và phần brand/back link | Route `/login` | Giữ nội dung riêng của login trong layout chung; thêm tab active, heading có chữ nhấn và label nhìn thấy được |
| `RegisterPage.tsx`, toàn bộ `.login-page > .login-card` và phần brand/back link | Route `/register` | Giữ nội dung riêng của register trong layout chung; thêm tab active, heading có chữ nhấn và label nhìn thấy được |
| `RegisterPage.tsx`, state `showPassword` | Cả `register-password` và `register-confirm` | Chỉ `register-password` đổi `password`/`text`; `register-confirm` luôn là `password` và không có toggle |
| `LoginPage.tsx`/`RegisterPage.tsx`, `catch` dùng trực tiếp `cause.message` | `.form-error` | Không hiển thị lỗi backend; chọn cảnh báo chung từ `t` theo màn và ngôn ngữ hiện hành |
| Hai form đang dùng validation native (`required`, `type=email`, `minLength`) | Trình duyệt quyết định câu cảnh báo | Ứng dụng kiểm tra khi submit để cảnh báo luôn theo ngôn ngữ TechVerse; đánh dấu trường không hợp lệ nhưng chỉ hiển thị một thông báo chung |
| `i18n.ts`, mới chỉ có copy tiêu đề/form cơ bản | `LoginPage`, `RegisterPage` | Bổ sung copy tab, phần chữ nhấn của tiêu đề, label/aria-label và cảnh báo chung cho `vi`/`en` |
| `auth.css`, `.login-card h1`, `.login-subtitle`, `.login-register` và khoảng cách bằng margin lớn/âm | Login, Register, Forgot Password, Google callback | Style mới phải scope cho layout Login/Register; dùng flow/gap bình thường, không làm đổi bố cục Forgot Password/Google callback |
| `styles.css` chỉ nạp Inter; `base.css` áp Inter toàn giao diện | Toàn ứng dụng | Không sửa; auth kế thừa đúng Inter, không import hoặc khai báo font khác |
| `registerService.ts` và `App.tsx`, payload `{ fullName, email, password, confirmPassword }` | `POST /api/v1/auth/register` | Không đổi payload; không thêm `phoneNumber` hoặc `dateOfBirth` |
| `App.auth.test.tsx`, test đăng ký/đăng nhập thành công | Luồng password auth và Google OAuth | Giữ test hiện có; bổ sung coverage cho tab, cảnh báo song ngữ, payload chính xác, toggle mật khẩu và regression |

- Backend đã hỗ trợ `phoneNumber` và `dateOfBirth` dưới dạng tùy chọn; người dùng quyết định không đưa hai trường này vào form.
- Mốc trước module: trong `app/`, 11 test files/81 tests đạt và `npm run build` đạt ngày 2026-11-02.
- `auth.css` vừa thuộc `ui-foundation`; chỉ bắt đầu code module này sau khi `ui-foundation` được người dùng nhận kết quả và thay đổi đã ổn định.

## Phạm vi

- Tạo layout dùng chung cho `/login` và `/register`, giữ back link/brand hiện có, đặt tab `Đăng nhập | Đăng ký` sau brand và trước heading.
- Hai tab là link điều hướng thật. Tab khớp URL có active state và `aria-current="page"`; focus nhìn thấy được và dùng được bằng bàn phím.
- Active indicator chuyển giữa hai tab; phần form đổi bằng fade kết hợp dịch dọc tối đa 8px trong 200ms. Khi người dùng bật `prefers-reduced-motion: reduce`, bỏ dịch chuyển và không dùng chuyển động gây chú ý.
- Giữ card ở giữa, thống nhất chiều rộng tối đa 480px. Dùng khoảng cách theo flow/gap; bỏ margin âm hoặc margin lớn chỉ để chừa chỗ cho lỗi.
- Tiêu đề Login/Register dùng Inter 32px/700 trên desktop, 28px trên mobile, letter-spacing bình thường. Một phần ngắn của tiêu đề dùng `--accent-text`; subtitle dùng Inter, line-height tối thiểu 1.6 và màu token phụ.
- Copy tiêu đề giữ nghĩa hiện tại và tách phần nhấn theo ngôn ngữ: `Chào mừng` + `trở lại!`, `Tạo` + `tài khoản`; `Welcome` + `back!`, `Create an` + `account`.
- Hiển thị label thật phía trên mỗi input; placeholder chỉ hỗ trợ, không thay label. Giữ thứ tự trường và autocomplete phù hợp hiện có.
- Form tự kiểm tra khi submit: trường bắt buộc, email hợp lệ, mật khẩu đăng ký 8–72 ký tự và xác nhận khớp. Trường sai có `aria-invalid`; form chỉ hiển thị một cảnh báo chung có `role="alert"`.
- Cảnh báo chung theo ngôn ngữ ứng dụng, không lộ message backend:
  - Login VI: `Không thể đăng nhập. Vui lòng kiểm tra lại thông tin.`
  - Login EN: `Unable to log in. Please review your information and try again.`
  - Register VI: `Không thể tạo tài khoản. Vui lòng kiểm tra lại thông tin.`
  - Register EN: `Unable to create your account. Please review your information and try again.`
- Ở đăng ký, icon mắt và aria-label chỉ thuộc ô mật khẩu; bấm icon không đổi `type` của ô xác nhận. Ở đăng nhập, toggle một ô mật khẩu tiếp tục hoạt động.
- Giữ link chuyển màn cuối form làm lối tắt phụ và đồng bộ copy/URL với tab phía trên.

## Ngoài phạm vi

- Không thêm `phoneNumber`, `dateOfBirth`, country selector hoặc date picker vào đăng ký; không đổi `RegisterRequest` backend.
- Không thay đổi backend, API contract, request/response, database, Flyway, session, token, cookie, quyền hoặc role routing.
- Không đổi payload đăng ký ngoài bốn trường `fullName`, `email`, `password`, `confirmPassword`.
- Không thiết kế lại Forgot Password, Google callback, Google OAuth button hoặc các màn auth khác; chỉ ngăn CSS mới làm hồi quy chúng.
- Không thay đổi copy/nghiệp vụ Terms of Use, Privacy Policy, Google OAuth, quên mật khẩu hoặc back-to-home.
- Không thêm font, font weight ngoài bộ Inter hiện có, thư viện UI, animation library hoặc dependency mới.
- Không sửa typography toàn cục, token màu, `styles.css`, `base.css` hoặc trang ngoài `/login` và `/register`.
- Không hiển thị lỗi chi tiết theo field hoặc nguyên văn lỗi backend; lỗi kỹ thuật chi tiết vẫn thuộc logging/diagnostic ngoài giao diện này.

## Ràng buộc

- Được đổi API: Không. Được đổi DB (Flyway mới): Không.
- Giữ nguyên hành vi hiện tại: Có, ngoại trừ thay đổi giao diện/chuyển động/cảnh báo và sửa toggle mật khẩu đã nêu.
- Bám [`docs/UI_GUIDE.md`](../docs/UI_GUIDE.md); màu đi qua token hiện có, không viết literal màu mới.
- Chỉ dùng font Inter đã nạp một lần từ UI foundation; không thêm `@import`, `font-family` mới hoặc font trang trí cho auth.
- Không mở rộng phạm vi sang hai trường backend tùy chọn chỉ vì chúng tồn tại trong DTO.
- Cảnh báo phải theo `language` hiện hành: `vi` chỉ tiếng Việt, `en` chỉ tiếng Anh; không dựa vào ngôn ngữ mặc định của trình duyệt.
- Tab/link, input, password toggle và submit phải có focus state nhìn thấy được; chuyển động phải có nhánh reduced-motion.
- Không sửa mã module này cho tới khi `ui-foundation` hoàn tất cổng nhận kết quả, để tránh ghi đè thay đổi đang review trong `auth.css`/i18n.

## Xong khi

- [ ] `/login` và `/register` dùng chung `AuthLayout`; tab đúng URL có active state + `aria-current="page"`, tab còn lại điều hướng đúng và link cuối form vẫn hoạt động.
- [ ] Chuyển Login/Register có active indicator và form fade + dịch tối đa 8px trong 200ms; `prefers-reduced-motion: reduce` bỏ dịch chuyển/chuyển động không cần thiết.
- [ ] Heading/subtitle/label đúng phân cấp đã chốt ở dark/light và desktop/mobile; h1 32px desktop, 28px mobile, 700, Inter, letter-spacing bình thường, phần nhấn dùng `--accent-text`.
- [ ] Không có font mới: `app/src/styles/pages/auth.css` không chứa `@import` hoặc `font-family`; toàn auth kế thừa Inter từ UI foundation.
- [ ] Form có label nhìn thấy được, focus ring, `aria-invalid` cho trường sai và một cảnh báo `role="alert"`; không còn margin âm/lớn dùng để dành chỗ cho lỗi.
- [ ] Validation phía giao diện và mọi lỗi API của Login/Register chỉ hiển thị đúng câu cảnh báo chung VI/EN đã chốt; message chi tiết do backend trả về không xuất hiện trên giao diện.
- [ ] Test xác nhận khi ngôn ngữ `vi` cảnh báo chỉ là tiếng Việt và khi `en` cảnh báo chỉ là tiếng Anh, cho cả validation cục bộ lẫn API thất bại.
- [ ] Test xác nhận bấm mắt ở đăng ký chỉ đổi `register-password`; `register-confirm` luôn `type="password"`. Toggle mật khẩu đăng nhập vẫn hoạt động và aria-label đúng ngôn ngữ/trạng thái.
- [ ] Request đăng ký vẫn có đúng `fullName`, `email`, `password`, `confirmPassword`; không có `phoneNumber`, `dateOfBirth` hoặc field mới. Đăng ký thành công vẫn về `/login`; đăng nhập thành công vẫn route theo role như trước.
- [ ] Google OAuth entry, quên mật khẩu, back-to-home, Google callback và card auth liên quan không phát sinh hồi quy do route/layout/CSS mới.
- [ ] `/login` và `/register` được kiểm tra ở dark/light, viewport desktop 1440×900 và mobile 390×844; không cuộn ngang, không cắt nội dung, tab/form dùng được bằng bàn phím.
- [ ] Trong `app/`, `npm test` đạt toàn bộ mốc 11 files/81 tests hiện có cùng test mới và `npm run build` đạt.
- [ ] `scripts/verify.sh` đạt (backend integration cần Docker).

## Phản hồi vòng 1 (Claude)

Đã đối chiếu với `App.tsx`, `LoginPage.tsx`, `RegisterPage.tsx`, `ForgotPasswordPage.tsx`, `GoogleCallbackPage.tsx`, `auth.css`, `App.auth.test.tsx`, `StaffPreferences.test.tsx` và `RegisterRequest`/`LoginRequest` của backend.

**Đúng (đã xác minh)**
- `RegisterPage` dùng chung một state `showPassword` cho cả hai ô (`type={showPassword ? 'text' : 'password'}` xuất hiện 2 lần): lỗi icon mắt là thật.
- Cả hai trang `catch` rồi hiển thị nguyên `cause.message`; form đang dựa vào `required`/`minLength={8}` native.
- Card: `.login-card` 480px, `.register-card` 432px, nên “thống nhất 480px” là đúng hiện trạng.
- Backend: mật khẩu `@Size(min = 8, max = 72)` khớp spec; payload 4 trường đúng.
- Test hiện có **không** kiểm tra nội dung lỗi backend, nên đổi sang cảnh báo chung không làm vỡ test. Tab dạng link điều hướng + `aria-current="page"` (không dùng `role="tab"`) là đúng ngữ nghĩa.

**Thiếu**
1. **Class dùng chung với Forgot Password và Google callback chưa được liệt kê.** `ForgotPasswordPage` dùng `.login-page`, `.login-card`, `.login-back`, `.login-brand`, `.login-subtitle`, `.login-input`, `.register-spaced`, `.login-submit`, `.login-register`, `.social-login-grid`; `GoogleCallbackPage` dùng `.login-card`, `.google-callback-card`, `.login-subtitle`, `.form-error`. Bản đồ chỉ nhắc `.login-card h1`, `.login-subtitle`, `.login-register`. Cần ghi rõ: không xóa/đổi các class này; style mới đặt dưới class riêng của `AuthLayout`. Đặc biệt `.register-spaced` không phải class mồ côi dù Register bỏ nó.
2. **Không có cách kiểm chứng “không hồi quy Forgot/Callback”.** Hai màn này không đổi giao diện, nên tiêu chí kiểm được là ảnh trước/sau của `/forgot-password` (và `/auth/callback` nếu dựng được trạng thái) ở dark/light, desktop/mobile phải giống nhau, ghi kết quả vào log.
3. **`noValidate` phải được nêu rõ.** Nếu giữ `required`/`type="email"`/`minLength` mà không có `noValidate`, trình duyệt chặn submit và hiện bong bóng theo ngôn ngữ của trình duyệt trước khi validation của ứng dụng chạy, trái với ràng buộc “không dựa vào ngôn ngữ trình duyệt”.
4. **Validation thiếu giới hạn backend.** Backend còn `fullName` tối đa 150 và `email` tối đa 254. Nên kiểm luôn ở giao diện để không gửi request chắc chắn bị từ chối.
5. **Chuyển động: chỉ làm hiệu ứng vào, không làm hiệu ứng ra.** Với `Outlet`, form cũ bị gỡ ngay khi URL đổi; làm fade-out/cross-fade cần giữ outlet cũ, phức tạp. Đề xuất ghi rõ: bọc nội dung bằng phần tử có `key` theo `pathname` để chạy animation vào (fade + dịch ≤ 8px, 200ms); indicator tab chỉ trượt được nếu `AuthLayout` là layout route cha nên không bị mount lại.
6. **Giữ nguyên chữ của label.** Test hiện có tìm trường bằng `getByLabelText('Tên đăng nhập' | 'Email' | 'Mật khẩu' (exact) | 'Xác nhận mật khẩu')`. Khi đổi label `sr-only` thành label nhìn thấy, chữ phải giữ nguyên và aria-label của nút mắt không được trùng chính xác `Mật khẩu`, nếu không test hoặc trình đọc màn hình sẽ khớp hai phần tử.
7. **Trường sai nên trỏ tới cảnh báo.** Chỉ có `aria-invalid` thì người dùng trình đọc màn hình không biết vì sao sai; thêm `aria-describedby` từ trường sai tới phần tử `role="alert"`.

**Rủi ro cần người dùng xác nhận (không phải lỗi spec)**
8. **Một câu cảnh báo cho mọi lỗi API** là chủ ý (không lộ chi tiết, chống dò tài khoản ở đăng nhập). Nhưng khi mất mạng, server lỗi 5xx hoặc bị giới hạn tần suất, câu “Vui lòng kiểm tra lại thông tin” sẽ khiến người dùng sửa thông tin vốn đúng. Đề xuất thêm câu thứ hai cho lỗi hệ thống/kết nối (ví dụ “Không thể kết nối. Vui lòng thử lại sau.”), vẫn không lộ message backend. Đăng ký trùng email (409) hiện cũng chỉ ra câu chung; có thể thêm gợi ý “đăng nhập nếu đã có tài khoản” vào câu đăng ký. Người dùng chốt.

**Thừa:** không thấy.

**Ghi chú quy trình:** `ui-foundation` vẫn đang ở working tree, chưa commit; đồng ý với ràng buộc dòng 80 là chỉ code khi `ui-foundation` đã được nhận và commit.

### Danh sách chốt cần Codex sửa (người dùng xác nhận ngày 2026-11-02)

Người dùng đồng ý các điểm 1–7 ở trên. Codex sửa thân spec theo từng mục, rồi trả lời ở mục dưới với Chấp nhận/Từ chối/Một phần kèm lý do:

1. Thêm vào “Bản đồ chi tiết” danh sách class dùng chung với `ForgotPasswordPage`/`GoogleCallbackPage` (mục 1 ở trên) và ràng buộc: không xóa/đổi các class này; style mới của Login/Register nằm dưới class riêng của `AuthLayout`.
2. Thêm tiêu chí “Xong khi”: ảnh trước/sau của `/forgot-password` (và `/auth/callback` nếu dựng được trạng thái) ở dark/light, 1440×900 và 390×844 không đổi; kết quả ghi vào log.
3. Ghi rõ hai form dùng `noValidate`; toàn bộ kiểm tra do ứng dụng làm khi submit.
4. Bổ sung kiểm tra giao diện theo giới hạn backend: `fullName` ≤ 150 ký tự, `email` ≤ 254 ký tự (cùng các kiểm tra đã có).
5. Chuyển động chỉ có hiệu ứng vào: phần nội dung form có `key` theo `pathname`, fade + dịch ≤ 8px trong 200ms; `AuthLayout` là layout route cha để indicator tab trượt mà không bị mount lại; nhánh `prefers-reduced-motion` giữ nguyên.
6. Label nhìn thấy giữ đúng chữ hiện tại (`Tên đăng nhập`, `Email`, `Mật khẩu`, `Xác nhận mật khẩu` và bản EN tương ứng); aria-label nút mắt không trùng chính xác chữ của label.
7. Trường không hợp lệ có `aria-describedby` trỏ tới phần tử cảnh báo `role="alert"`.

**Chưa chốt — chờ người dùng:** điểm 8 (thêm câu cảnh báo thứ hai cho lỗi kết nối/hệ thống và gợi ý khi đăng ký trùng email). Cho tới khi người dùng trả lời, Codex giữ một câu cảnh báo chung như spec hiện tại và ghi điểm này ở “Điểm yếu còn lại”.

## Trả lời vòng 1 (Codex)

## Phản hồi vòng 2 (Claude)

## Trả lời vòng 2 (Codex)

## Quyết định của người dùng

Chốt theo: ...
