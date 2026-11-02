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
| `LoginPage.tsx`/`RegisterPage.tsx`, `catch` dùng trực tiếp `cause.message` | `.form-error` | Không hiển thị lỗi backend; chọn cảnh báo chung cho nhóm lỗi thông tin hoặc nhóm lỗi hệ thống từ `t` theo ngôn ngữ hiện hành |
| Hai form đang dùng validation native (`required`, `type=email`, `minLength`) | Trình duyệt quyết định câu cảnh báo | Thêm `noValidate`; ứng dụng kiểm tra khi submit để cảnh báo luôn theo ngôn ngữ TechVerse, đánh dấu trường sai và nối trường tới một thông báo chung |
| `i18n.ts`, mới chỉ có copy tiêu đề/form cơ bản | `LoginPage`, `RegisterPage` | Bổ sung copy tab, phần chữ nhấn của tiêu đề, label/aria-label và cảnh báo chung cho `vi`/`en` |
| `ForgotPasswordPage.tsx`: `.login-page`, `.login-card`, `.login-back`, `.login-subtitle`, `.login-input`, `.register-spaced`, `.login-submit` | Route `/forgot-password` | Không xóa, đổi tên hoặc đổi hành vi các class dùng chung; `.register-spaced` vẫn còn nơi dùng dù Register không cần nó |
| `GoogleCallbackPage.tsx`: `.login-page`, `.login-card`, `.login-brand`, `.login-subtitle`, `.form-error`, `.google-callback-card`, `.google-callback-message`, `.social-login-grid`, `.login-register` | Route `/auth/callback` | Không xóa, đổi tên hoặc làm thay đổi hiển thị các class dùng chung/callback |
| `auth.css`, `.login-card h1`, `.login-subtitle`, `.login-input`, `.password-*`, `.login-register`, `.form-error` và khoảng cách bằng margin lớn/âm | Login, Register, Forgot Password, Google callback | Style mới của Login/Register phải nằm dưới `.auth-layout`; dùng selector mới riêng, flow/gap bình thường và không đổi computed style của Forgot Password/Google callback |
| `AuthLayout.tsx`, chưa tồn tại | Login/Register | Tạo `.auth-layout`, `.auth-card`, `.auth-tabs`, `.auth-tab`, `.auth-tab-indicator`, `.auth-form-panel`; heading/field/error riêng dùng `.auth-heading`, `.auth-title-accent`, `.auth-field`, `.auth-field-label`, `.auth-alert` |
| `styles.css` chỉ nạp Inter; `base.css` áp Inter toàn giao diện | Toàn ứng dụng | Không sửa; auth kế thừa đúng Inter, không import hoặc khai báo font khác |
| `registerService.ts` và `App.tsx`, payload `{ fullName, email, password, confirmPassword }` | `POST /api/v1/auth/register` | Không đổi payload; không thêm `phoneNumber` hoặc `dateOfBirth` |
| `App.auth.test.tsx`, test đăng ký/đăng nhập thành công | Luồng password auth và Google OAuth | Giữ test hiện có; bổ sung coverage cho tab, cảnh báo song ngữ, payload chính xác, toggle mật khẩu và regression |

- Backend đã hỗ trợ `phoneNumber` và `dateOfBirth` dưới dạng tùy chọn; người dùng quyết định không đưa hai trường này vào form.
- Mốc trước module: trong `app/`, 11 test files/81 tests đạt và `npm run build` đạt ngày 2026-11-02.
- `auth.css` vừa thuộc `ui-foundation`; chỉ bắt đầu code module này sau khi `ui-foundation` được người dùng nhận kết quả và thay đổi đã ổn định.

## Phạm vi

- Tạo layout dùng chung cho `/login` và `/register`, giữ back link/brand hiện có, đặt tab `Đăng nhập | Đăng ký` sau brand và trước heading.
- Hai tab là link điều hướng thật. Tab khớp URL có active state và `aria-current="page"`; focus nhìn thấy được và dùng được bằng bàn phím.
- `AuthLayout` là layout route cha nên không bị mount lại khi đổi giữa `/login` và `/register`; nhờ đó active indicator có thể trượt giữa hai tab. Nội dung form có phần tử `.auth-form-panel` mang `key` theo `pathname` và chỉ chạy hiệu ứng **vào**: fade kết hợp dịch dọc tối đa 8px trong 200ms; không yêu cầu fade-out/cross-fade của form cũ. Khi người dùng bật `prefers-reduced-motion: reduce`, bỏ dịch chuyển và không dùng chuyển động gây chú ý.
- Giữ card ở giữa, thống nhất chiều rộng tối đa 480px. Dùng khoảng cách theo flow/gap; bỏ margin âm hoặc margin lớn chỉ để chừa chỗ cho lỗi.
- Tiêu đề Login/Register dùng Inter 32px/700 trên desktop, 28px trên mobile, letter-spacing bình thường. Một phần ngắn của tiêu đề dùng `--accent-text`; subtitle dùng Inter, line-height tối thiểu 1.6 và màu token phụ.
- Copy tiêu đề giữ nghĩa hiện tại và tách phần nhấn theo ngôn ngữ: `Chào mừng` + `trở lại!`, `Tạo` + `tài khoản`; `Welcome` + `back!`, `Create an` + `account`.
- Hiển thị label thật phía trên mỗi input; placeholder chỉ hỗ trợ, không thay label. Label giữ nguyên copy hiện có: VI `Tên đăng nhập`, `Email`, `Mật khẩu`, `Xác nhận mật khẩu`; EN `Username`, `Email`, `Password`, `Confirm password`. Giữ thứ tự trường và autocomplete phù hợp hiện có.
- Hai form có `noValidate`; toàn bộ kiểm tra chạy trong ứng dụng khi submit: trường bắt buộc, email hợp lệ và tối đa 254 ký tự; đăng ký kiểm tra `fullName` tối đa 150 ký tự, mật khẩu 8–72 ký tự, không quá 72 byte UTF-8 theo `new TextEncoder().encode(password).length`, và xác nhận khớp. Trường sai có `aria-invalid` và `aria-describedby` trỏ tới một cảnh báo chung có `role="alert"`.
- Nhóm **lỗi thông tin** gồm validation phía giao diện và phản hồi API 400, 401, 409. Dùng cảnh báo theo màn/ngôn ngữ, không lộ message backend:
  - Login VI: `Không thể đăng nhập. Vui lòng kiểm tra lại thông tin.`
  - Login EN: `Unable to log in. Please review your information and try again.`
  - Register VI: `Không thể tạo tài khoản. Vui lòng kiểm tra lại thông tin.`
  - Register EN: `Unable to create your account. Please review your information and try again.`
- Nhóm **lỗi hệ thống** gồm request không nhận được phản hồi/kết nối thất bại, API 429, API 5xx và status bất ngờ ngoài nhóm lỗi thông tin. Login và Register dùng cùng câu:
  - VI: `Hệ thống tạm thời chưa thể xử lý yêu cầu. Vui lòng thử lại sau.`
  - EN: `The system cannot process your request right now. Please try again later.`
- Đăng ký 409 vẫn dùng cảnh báo thông tin chung và không gợi ý “đăng nhập nếu đã có tài khoản”, để không xác nhận email đã tồn tại và đúng chủ ý cảnh báo chung của người dùng. Đăng nhập 401 không phân biệt sai email với sai mật khẩu.
- Ở đăng ký, icon mắt và aria-label chỉ thuộc ô mật khẩu; bấm icon không đổi `type` của ô xác nhận. Ở đăng nhập, toggle một ô mật khẩu tiếp tục hoạt động. Aria-label toggle dùng VI `Hiện mật khẩu`/`Ẩn mật khẩu`, EN `Show password`/`Hide password`, không trùng chính xác label `Mật khẩu`/`Password`.
- Giữ link chuyển màn cuối form làm lối tắt phụ và đồng bộ copy/URL với tab phía trên.

## Ngoài phạm vi

- Không thêm `phoneNumber`, `dateOfBirth`, country selector hoặc date picker vào đăng ký; không đổi `RegisterRequest` backend.
- Không thay đổi backend, API contract, request/response, database, Flyway, session, token, cookie, quyền hoặc role routing.
- Không thay đổi cơ chế retry/refresh hiện có khi request đăng nhập nhận 401; trường hợp phiên cũ có refresh cookie hợp lệ cần được kiểm tra trong một task session/token riêng.
- Không đổi payload đăng ký ngoài bốn trường `fullName`, `email`, `password`, `confirmPassword`.
- Không thiết kế lại Forgot Password, Google callback, Google OAuth button hoặc các màn auth khác; chỉ ngăn CSS mới làm hồi quy chúng.
- Không thay đổi copy/nghiệp vụ Terms of Use, Privacy Policy, Google OAuth, quên mật khẩu hoặc back-to-home.
- Không thêm font, font weight ngoài bộ Inter hiện có, thư viện UI, animation library hoặc dependency mới.
- Không sửa typography toàn cục, token màu, `styles.css`, `base.css` hoặc trang ngoài `/login` và `/register`.
- Không hiển thị lỗi chi tiết theo field hoặc nguyên văn lỗi backend; lỗi kỹ thuật chi tiết vẫn thuộc logging/diagnostic ngoài giao diện này.
- Không đổi giao diện hoặc selector sở hữu bởi Forgot Password/Google callback; không xóa class dùng chung chỉ vì Login/Register chuyển sang selector mới.

## Ràng buộc

- Được đổi API: Không. Được đổi DB (Flyway mới): Không.
- Giữ nguyên hành vi hiện tại: Có, ngoại trừ thay đổi giao diện/chuyển động/cảnh báo và sửa toggle mật khẩu đã nêu.
- Bám [`docs/design/UI_GUIDE.md`](../docs/design/UI_GUIDE.md); màu đi qua token hiện có, không viết literal màu mới.
- Chỉ dùng font Inter đã nạp một lần từ UI foundation; không thêm `@import`, `font-family` mới hoặc font trang trí cho auth.
- Không mở rộng phạm vi sang hai trường backend tùy chọn chỉ vì chúng tồn tại trong DTO.
- Cảnh báo phải theo `language` hiện hành: `vi` chỉ tiếng Việt, `en` chỉ tiếng Anh; không dựa vào ngôn ngữ mặc định của trình duyệt.
- Phân nhóm cảnh báo chỉ dựa trên validation cục bộ, việc request có nhận được phản hồi hay không và HTTP status; không phân tích hoặc hiển thị message/fieldErrors backend.
- Tab/link, input, password toggle và submit phải có focus state nhìn thấy được; chuyển động phải có nhánh reduced-motion.
- Mọi style mới của Login/Register phải scope dưới `.auth-layout`; không xóa/đổi `.login-page`, `.login-card`, `.login-back`, `.login-brand`, `.login-subtitle`, `.login-input`, `.register-spaced`, `.login-submit`, `.login-register`, `.social-login-grid`, `.form-error`, `.google-callback-card` hoặc `.google-callback-message` đang được Forgot Password/Google callback dùng.
- Không sửa mã module này cho tới khi `ui-foundation` hoàn tất cổng nhận kết quả, để tránh ghi đè thay đổi đang review trong `auth.css`/i18n.

## Xong khi

- [ ] `/login` và `/register` dùng chung `AuthLayout`; tab đúng URL có active state + `aria-current="page"`, tab còn lại điều hướng đúng và link cuối form vẫn hoạt động.
- [ ] `AuthLayout` là layout route cha và giữ mount khi đổi `/login` ↔ `/register`; active indicator trượt giữa tab. `.auth-form-panel` có `key` theo `pathname` và chỉ chạy animation vào: fade + dịch tối đa 8px trong 200ms; không yêu cầu animation ra/cross-fade. `prefers-reduced-motion: reduce` bỏ dịch chuyển/chuyển động không cần thiết.
- [ ] Heading/subtitle/label đúng phân cấp đã chốt ở dark/light và desktop/mobile; h1 32px desktop, 28px mobile, 700, Inter, letter-spacing bình thường, phần nhấn dùng `--accent-text`.
- [ ] Không có font mới: `app/src/styles/pages/auth.css` không chứa `@import` hoặc `font-family`; toàn auth kế thừa Inter từ UI foundation.
- [ ] Form có `noValidate`; label nhìn thấy được giữ đúng copy VI/EN đã chốt, focus ring, `aria-invalid` và `aria-describedby` từ từng trường sai tới một cảnh báo `role="alert"`; không còn margin âm/lớn dùng để dành chỗ cho lỗi.
- [ ] Validation cục bộ chặn submit với trường bắt buộc rỗng, email sai hoặc dài hơn 254 ký tự, `fullName` dài hơn 150 ký tự, mật khẩu đăng ký ngoài 8–72 ký tự, mật khẩu dài hơn 72 byte UTF-8 hoặc xác nhận không khớp; không gửi request trong các trường hợp này. Có test chứng minh 25 ký tự `ệ` (75 byte UTF-8) bị chặn dù chưa vượt 72 ký tự.
- [ ] Test ma trận cảnh báo cho cả Login và Register: nhóm lỗi thông tin × `vi`/`en` hiển thị đúng câu theo màn; nhóm lỗi hệ thống × `vi`/`en` hiển thị đúng câu hệ thống. Ít nhất bao phủ validation cục bộ, 400/401/409, lỗi kết nối, 429 và 5xx; không trường hợp nào hiển thị message backend.
- [ ] Register 409 không hiển thị gợi ý tài khoản/email đã tồn tại; Login 401 dùng cùng câu cho sai email và sai mật khẩu.
- [ ] Test Login 401 mock rõ `POST /api/v1/auth/login` trả 401 và `POST /api/v1/auth/refresh` thất bại; xác nhận refresh được gọi đúng một lần rồi cảnh báo thông tin chung xuất hiện. Không dựa vào hành vi mặc định của mock và không thay đổi cơ chế retry/refresh production.
- [ ] Test xác nhận bấm mắt ở đăng ký chỉ đổi `register-password`; `register-confirm` luôn `type="password"`. Toggle mật khẩu đăng nhập vẫn hoạt động và aria-label đúng ngôn ngữ/trạng thái.
- [ ] Request đăng ký vẫn có đúng `fullName`, `email`, `password`, `confirmPassword`; không có `phoneNumber`, `dateOfBirth` hoặc field mới. Đăng ký thành công vẫn về `/login`; đăng nhập thành công vẫn route theo role như trước.
- [ ] Không xóa/đổi các class dùng chung được liệt kê trong “Bản đồ chi tiết”; Google OAuth entry, quên mật khẩu, back-to-home, Google callback và card auth liên quan không phát sinh hồi quy do route/layout/CSS mới.
- [ ] Ảnh trước/sau khi thực hiện của `/forgot-password` và trạng thái callback cố định `/auth/callback?status=error&code=AUTH_SOCIAL_EMAIL_ALREADY_REGISTERED`, ở dark/light và viewport 1440×900, 390×844, có 0 pixel khác biệt trong cùng môi trường; kết quả và đường dẫn ảnh ghi vào log task.
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

8. **Cảnh báo khi lỗi không do người dùng nhập sai (người dùng giao Codex đề xuất cách giải quyết, người dùng chốt sau).** Hiện spec dùng một câu cho mọi lỗi API, nên khi mất mạng, server lỗi 5xx hoặc bị giới hạn tần suất (429), người dùng vẫn được bảo “kiểm tra lại thông tin” dù thông tin đúng; khi đăng ký trùng email (409) họ cũng không biết mình đã có tài khoản. Codex đề xuất phương án trong thân spec, cần nêu:
   - Nhóm lỗi nào dùng câu nào (ví dụ: dữ liệu/thông tin sai gồm validation cục bộ, 400, 401, 409; lỗi kết nối/hệ thống gồm `fetch` thất bại, 5xx, 429), và câu VI/EN cụ thể cho từng nhóm.
   - Có gợi ý “đăng nhập nếu đã có tài khoản” ở đăng ký hay không, và lý do (cân nhắc việc dò tài khoản đã tồn tại).
   - Vẫn không hiển thị nguyên văn message backend; đăng nhập không được phân biệt “sai email” với “sai mật khẩu”.
   - Test tương ứng trong “Xong khi” (mỗi nhóm lỗi × `vi`/`en`).
   - Nếu Codex cho rằng giữ một câu chung là tốt hơn, nêu rõ lý do và bằng chứng; người dùng quyết định ở mục “Quyết định của người dùng”.

## Trả lời vòng 1 (Codex)

1. **Chấp nhận một phần — nhận yêu cầu bảo vệ class, sửa inventory theo mã thật.** Đã khóa việc không xóa/đổi class dùng chung và chốt selector mới của Login/Register dưới `.auth-layout`. Kiểm tra source cho thấy `ForgotPasswordPage` không dùng `.login-brand`, `.login-register`, `.social-login-grid` như phản hồi nêu; bảng chỉ ghi bảy class thực dùng, trong đó `.register-spaced` phải giữ. Danh sách Google callback đã được ghi theo source hiện tại.
2. **Chấp nhận.** “Xong khi” đã có đối chiếu ảnh 0 pixel khác biệt cho `/forgot-password` và callback error state cố định, đủ dark/light và hai viewport 1440×900, 390×844; bằng chứng phải ghi vào log.
3. **Chấp nhận.** Hai form phải đặt `noValidate`; validation ứng dụng chạy khi submit nên trình duyệt không chen cảnh báo theo ngôn ngữ hệ điều hành.
4. **Chấp nhận.** Đã thêm `fullName` tối đa 150 ký tự và email tối đa 254 ký tự vào phạm vi/test, bên cạnh required, email format, mật khẩu 8–72 và confirm khớp.
5. **Chấp nhận.** Đã bỏ hàm ý cross-fade hai chiều. `AuthLayout` là layout route cha giữ mount để indicator trượt; form keyed theo `pathname` chỉ animation vào trong 200ms, với reduced-motion.
6. **Chấp nhận.** Label nhìn thấy giữ nguyên copy VI/EN hiện có. Aria-label mắt dùng “Hiện/Ẩn mật khẩu” hoặc “Show/Hide password”, không trùng chính xác label trường.
7. **Chấp nhận.** Mọi trường bị đánh dấu sai có cả `aria-invalid` và `aria-describedby` trỏ tới cảnh báo chung `role="alert"`.
8. **Chấp nhận một phần — tách hai nhóm cảnh báo, không thêm gợi ý đăng nhập cho 409.** Validation cục bộ và API 400/401/409 dùng cảnh báo thông tin theo từng màn; lỗi kết nối, 429, 5xx và status bất ngờ dùng cảnh báo hệ thống chung. Cả hai nhóm có câu VI/EN và ma trận test tương ứng. Không hiển thị message backend; Login 401 không phân biệt sai email/mật khẩu. Register 409 không gợi ý “đăng nhập nếu đã có tài khoản” vì người dùng đã yêu cầu cảnh báo chung và gợi ý đó xác nhận email tồn tại.

### Điểm yếu còn lại

- Cảnh báo chung làm giảm khả năng tự chẩn đoán: người dùng biết trường nào sai qua `aria-invalid`/style nhưng không được giải thích chi tiết từng lỗi; đây là đánh đổi có chủ ý theo yêu cầu.
- Phân nhóm bằng HTTP status có thể phân loại chưa hoàn hảo nếu proxy/backend trả sai status; UI vẫn ưu tiên không lộ message và đưa status bất ngờ về cảnh báo hệ thống.
- Validation frontend lặp một phần giới hạn backend nên có nguy cơ lệch khi DTO thay đổi; backend vẫn là nguồn xác thực cuối và test payload/error phải phát hiện drift.
- Hiệu ứng form chỉ chạy lúc vào, không phải cross-fade đầy đủ; đổi lại layout route đơn giản hơn và indicator tab vẫn trượt liên tục.
- So sánh ảnh 0 pixel nhạy với phiên bản trình duyệt, font tải và animation; ảnh trước/sau phải chụp trong cùng môi trường, chờ Inter tải xong và tắt animation.

## Phản hồi vòng 2 (Claude)

Chỉ xét phần sửa sau vòng 1 và các điểm Codex phản bác. Đã đối chiếu lại `ForgotPasswordPage.tsx`, `GoogleCallbackPage.tsx`, `RegisterRequest.java`, `AuthServiceImpl.login`, `ErrorCode`, `services/api/client.ts`, `authService.ts`.

**Codex đúng, tôi sai ở vòng 1**
- Điểm 1: `ForgotPasswordPage` chỉ dùng 7 class (`login-back`, `login-card`, `login-input`, `login-page`, `login-submit`, `login-subtitle`, `register-spaced`); `.login-brand`, `.login-register`, `.social-login-grid` thuộc `GoogleCallbackPage`. Lệnh tìm của tôi đã gộp hai file. Bảng mới đúng với mã.

**Đúng (đã xác minh)**
- Backend kiểm mật khẩu cả `@Size(min = 8, max = 72)` lẫn `@Utf8ByteLength(max = 72)`: điểm yếu về byte Codex nêu là có thật.
- Đăng nhập với tài khoản bị khóa vẫn trả `INVALID_CREDENTIALS` 401 (`AuthServiceImpl.login`), đăng nhập không có rate limit; đăng ký trả 400/409. `request()` ném `ApiError` có `status` khi có phản hồi, mất mạng thì `fetch` ném lỗi riêng. Vì vậy phân nhóm 400/401/409 ↔ mạng/429/5xx/status khác làm được chỉ từ status, không cần message, và không cần nhóm cho 403.
- Trạng thái callback `?status=error&code=AUTH_SOCIAL_EMAIL_ALREADY_REGISTERED` là mã `GoogleCallbackPage` có xử lý, nên chụp ảnh đối chiếu ổn định được.
- Không gợi ý đăng nhập cho 409: đồng ý, vì gợi ý đó xác nhận email đã tồn tại.

**Đề nghị sửa (nhỏ, không chặn chốt)**
1. **Chuyển điểm yếu 72 byte thành yêu cầu.** Kiểm `new TextEncoder().encode(password).length <= 72` chỉ một dòng, khớp `@Utf8ByteLength`, nên không cần để thành rủi ro. Thêm vào validation đăng ký và một test (ví dụ 25 ký tự `ệ` = 75 byte phải bị chặn dù chỉ 25 ký tự).
2. **Test 401 của đăng nhập phải mock `POST /auth/refresh` thất bại.** `login()` gọi `request()` với `retry` mặc định, nên 401 kích hoạt một lần refresh trước khi ném lỗi; nếu không mock, kết quả test phụ thuộc mock mặc định.

**Ngoài phạm vi (ghi nhận, không sửa trong module này)**
- Cũng vì `retry` mặc định, một lần đăng nhập sai có thể làm mới token của phiên cũ nếu trình duyệt còn cookie refresh hợp lệ. Hành vi này có từ trước và spec cấm đổi session/token; đề nghị mở task riêng để kiểm tra.

**Thừa:** không thấy.

**Kết luận:** spec đủ để người dùng chốt. Hai sửa nhỏ ở trên có thể đưa vào lúc chốt (Claude làm khi code, ghi vào log) mà không cần vòng phản biện thứ ba.

## Trả lời vòng 2 (Codex)

1. **Chấp nhận — chuyển giới hạn 72 byte UTF-8 thành yêu cầu bắt buộc.** Thân spec và “Xong khi” đã yêu cầu kiểm `new TextEncoder().encode(password).length <= 72`, đồng thời thêm ca test 25 ký tự `ệ` tương đương 75 byte phải bị chặn trước khi gửi request. Điểm này đã được bỏ khỏi “Điểm yếu còn lại”.
2. **Chấp nhận — cô lập rõ nhánh refresh trong test Login 401.** “Xong khi” đã yêu cầu mock login trả 401, mock `/api/v1/auth/refresh` thất bại, xác nhận refresh được gọi đúng một lần rồi hiển thị cảnh báo thông tin chung. Đây chỉ là yêu cầu về tính xác định của test; không đổi retry/refresh trong production.

### Điểm yếu còn lại

- Cảnh báo chung làm giảm khả năng tự chẩn đoán: người dùng biết trường nào sai qua `aria-invalid`/style nhưng không được giải thích chi tiết từng lỗi; đây là đánh đổi có chủ ý theo yêu cầu.
- Phân nhóm bằng HTTP status có thể phân loại chưa hoàn hảo nếu proxy/backend trả sai status; UI vẫn ưu tiên không lộ message và đưa status bất ngờ về cảnh báo hệ thống.
- Validation frontend lặp một phần giới hạn backend nên có nguy cơ lệch khi DTO thay đổi; backend vẫn là nguồn xác thực cuối và test payload/error phải phát hiện drift.
- Hiệu ứng form chỉ chạy lúc vào, không phải cross-fade đầy đủ; đổi lại layout route đơn giản hơn và indicator tab vẫn trượt liên tục.
- So sánh ảnh 0 pixel nhạy với phiên bản trình duyệt, font tải và animation; ảnh trước/sau phải chụp trong cùng môi trường, chờ Inter tải xong và tắt animation.
- Luồng request hiện có vẫn thử refresh một lần khi đăng nhập trả 401; nếu trình duyệt còn refresh cookie hợp lệ của phiên cũ, lần đăng nhập sai có thể làm mới phiên đó. Đây là hành vi có trước, liên quan session/token và phải được đánh giá trong task riêng thay vì mở rộng module giao diện này.

## Quyết định của người dùng

- 2026-11-02: Người dùng chốt toàn bộ spec `auth-login-register` sau hai vòng phản biện, gồm hai sửa cuối: kiểm giới hạn mật khẩu 72 byte UTF-8 ở giao diện và mock refresh thất bại trong test Login 401.
- Không bổ sung phạm vi ngoài nội dung đã chốt. Claude thực hiện sau khi `ui-foundation` hoàn tất cổng nhận kết quả và các thay đổi liên quan đã ổn định.
