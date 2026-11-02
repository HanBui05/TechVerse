# User Profile

Trạng thái: xem [`PLAN.md`](PLAN.md). Spec do Codex viết; Claude chỉ ghi vào mục “Phản hồi”.

**Mục tiêu:** Thiết kế lại trang hồ sơ thành settings dashboard hai cột có thẩm mỹ và đồng bộ TechVerse; chỉ hiển thị dữ liệu/API thật, tích hợp đổi avatar trực tiếp trên ảnh, cập nhật từng trường, đổi mật khẩu và hai mức đăng xuất trong cùng giao diện.
**Làn:** Đầy đủ
**Giai đoạn:** Giao diện
**Đổi giao diện:** Có

## Backend đã nhận kết quả

- Ngày 2026-11-02, người dùng xác nhận đã nhận kết quả giai đoạn Backend. Chi tiết thực hiện/test nằm tại [`user-profile.log.md`](user-profile.log.md).
- Backend đã có `GET /api/v1/users/me`, Merge Patch `PATCH /api/v1/users/me`, `PATCH /api/v1/users/me/avatar`, `PATCH /api/v1/users/me/password`, logout và logout-all.
- Profile trả `hasLocalPassword`; PATCH phân biệt trường không gửi, giá trị mới và `null`; đổi mật khẩu giữ phiên hiện tại, thu hồi phiên khác và giới hạn sai mật khẩu hiện tại 5 lần trong 15 phút.
- Mốc bàn giao Backend: test task 33/33; full backend 310/310, frontend 165/165 và frontend build đều đạt.

## Đường dẫn thuộc module

Chỉ được sửa các đường dẫn sau. Ngoài danh sách là ngoài phạm vi.

- `app/src/App.tsx` — ghép `/profile` thành một dashboard; truyền hành vi đăng xuất, bỏ `window.confirm`/`window.alert` khỏi logout-all.
- `app/src/pages/Profile/ProfilePage.tsx` — bố cục, điều hướng panel, form thông tin, avatar trực tiếp và hai hành động đăng xuất.
- `app/src/pages/Profile/AvatarUpload.tsx` — giữ xử lý upload nhưng chuyển file input thành điều khiển ẩn được kích hoạt từ avatar/camera.
- `app/src/pages/Profile/ChangePasswordPanel.tsx` — tạo mới; form đổi mật khẩu cho tài khoản có mật khẩu cục bộ.
- `app/src/services/profileService.ts` — bổ sung `hasLocalPassword`, request đổi mật khẩu và kiểu payload tương ứng.
- `app/src/data/profile.ts` — copy VI/EN cho các panel, trạng thái, lỗi chung và dialog xác nhận; xóa copy của trường/mục đã bỏ.
- `app/src/styles/pages/profile.css` — thiết kế lại toàn bộ dashboard, form, avatar, nút nguy hiểm, dialog và responsive.
- `app/src/pages/Profile/ProfilePage.test.tsx` — tạo mới; test dashboard, cập nhật từng trường, avatar, menu và logout-all.
- `app/src/pages/Profile/ChangePasswordPanel.test.tsx` — tạo mới; test validation, toggle, request và phân loại lỗi đổi mật khẩu.
- `app/src/App.auth.test.tsx` — một regression cấp App cho logout-all thành công; không sửa hàng loạt mock profile không gõ kiểu.
- `app/src/components/layout/Sidebar.test.tsx` — cập nhật fixture profile và regression sidebar.

## Bản đồ chi tiết

| Hiện ở đâu (file, tên class/hàm/bean) | Dùng bởi (component/trang/lớp gọi) | Đích sau thay đổi |
|---|---|---|
| `App.tsx`, route `/profile` đang render nối tiếp `ProfilePage`, `AvatarUpload` và `.logout-all-panel` | Người dùng đã xác thực | Chỉ render một dashboard thống nhất; truyền callback logout/logout-all và cập nhật profile, không còn panel rời phía dưới |
| `App.tsx.logoutAll` dùng `window.confirm` và `window.alert` | Nút logout-all | Callback không catch lỗi: gọi API rồi chỉ khi thành công mới xóa phiên và chuyển `/login`; dialog trong giao diện chịu trách nhiệm xác nhận, pending và lỗi VI/EN |
| `ProfilePage` có năm mục menu, trong đó My Articles/Security/Login History chưa hoạt động | Điều hướng bên trái | Chỉ còn Thông tin cá nhân và Đổi mật khẩu; mục đổi mật khẩu chỉ xuất hiện khi `hasLocalPassword === true` |
| `ProfilePage` hiển thị university/developer profile/portfolio nhưng `UserProfile` không có dữ liệu tương ứng | Form hồ sơ | Chỉ giữ avatar, họ tên, email chỉ đọc, số điện thoại và ngày sinh; dữ liệu tác giả vẫn thuộc Author Profile |
| `saveProfile` luôn gửi cả ba trường | `PATCH /api/v1/users/me` | Validation client khớp Backend; theo dõi dirty theo giá trị chuẩn hóa; chỉ gửi field thay đổi, phone/date rỗng thành `null`; profile mới chỉ đồng bộ vào field còn pristine |
| `AvatarUpload` là một panel file input riêng | Endpoint avatar | Dùng label bọc avatar/camera và input file ẩn trực quan nhưng vẫn focus được; giữ JPEG/PNG/WebP tối đa 5 MiB và cập nhật profile dùng chung sau thành công |
| Chưa có UI gọi `PATCH /api/v1/users/me/password` | Tài khoản local | `ChangePasswordPanel` có current/new/repeat password, toggle độc lập, validation phía client và copy lỗi theo ngôn ngữ |
| `.profile-*`, `.profile-upload-*`, `.logout-all-panel` trong `profile.css` | Trang `/profile` | Dashboard hai cột desktop, một cột + panel selector gọn trên mobile; bỏ selector CSS không còn DOM và dùng token hiện có |
| `profileCopy` còn copy GIF, developer fields và menu chết | Trang hồ sơ | Copy VI/EN chỉ cho chức năng thật; định dạng hỗ trợ avatar phải khớp JPEG/PNG/WebP |
| Fixture được gõ `UserProfile` trong `Sidebar.test.tsx` chưa có `hasLocalPassword` | TypeScript build và regression sidebar | Bổ sung boolean bắt buộc; mock response không gõ kiểu ở test khác chỉ sửa nếu test liên quan yêu cầu |

- `UserAvatar` tiếp tục là component hiển thị avatar dùng chung; không sửa component này.
- Baseline nhận cùng Backend ngày 2026-11-02: frontend 165/165 test và `npm run build` đạt.

## Phạm vi

- Thiết kế trang `/profile` theo hướng settings dashboard hiện đại:
  - Desktop: card trái chứa avatar lớn, tên/email, điều hướng panel và hai hành động đăng xuất; card phải chứa nội dung panel đang chọn.
  - Mobile: một cột; dùng panel selector gọn ở phía trên nội dung khi có đủ hai panel, ẩn selector với Google-only chỉ có Thông tin cá nhân; không giữ menu dọc chiếm chỗ và không cuộn ngang.
- Panel Thông tin cá nhân chỉ có avatar, họ tên, email chỉ đọc, số điện thoại và ngày sinh. Khi profile dùng chung đổi do upload avatar, chỉ field còn pristine được đồng bộ; field người dùng đang sửa phải được giữ. Trong lúc lưu, khóa toàn bộ input của form cùng nút lưu để không làm mất nội dung nhập giữa request; sau thành công lấy response làm baseline mới và đặt form về pristine.
- Trước khi lưu, validation client khớp Backend và hiển thị lỗi VI/EN ngay dưới đúng trường bằng `aria-invalid` + `aria-describedby`; còn lỗi thì không gọi API:
  - Họ tên: sau `trim()` không rỗng và tối đa 150 ký tự; input có `maxLength={150}`.
  - Phone chỉ kiểm khi không rỗng: giá trị thô tối đa 20 ký tự; sau khi bỏ khoảng trắng và `( ) . -` phải khớp `^\+?\d+$` và có 10–20 chữ số. Input có `maxLength={20}`.
  - Ngày sinh chỉ kiểm khi không rỗng: phải trước hôm nay và đủ 6 tuổi; input date có `max` bằng ngày hôm nay trừ 6 năm.
- Payload chỉ gồm field dirty theo giá trị chuẩn hóa: tên so sau `trim()`, phone/date rỗng tương đương `null`; chỉ thêm khoảng trắng cuối tên không bật nút lưu. Phone/date rỗng được gửi `null`. Thành công cập nhật profile dùng chung và baseline; lỗi 400 còn lọt qua dùng câu “Kiểm tra lại thông tin” VI/EN, mạng/5xx dùng lỗi hệ thống, không in raw backend message.
- Chọn avatar bằng label bọc trực tiếp avatar/camera và input file ẩn trực quan nhưng vẫn nằm trong tab order; `:focus-within` làm focus ring hiện trên avatar. Chấp nhận JPEG/PNG/WebP tối đa 5 MiB; lỗi 413/415 dùng câu định dạng/dung lượng, 429 dùng câu thử lại sau, còn lại dùng lỗi hệ thống VI/EN; không hiển thị `error.message` thô.
- Panel Đổi mật khẩu chỉ có khi `profile.hasLocalPassword === true`; Google-only không thấy mục/panel này. Form gồm `currentPassword`, `newPassword`, `confirmPassword`, mỗi trường có nút mắt độc lập và không làm thay đổi trường khác.
- Validation đổi mật khẩu trước request: cả ba trường phải có `value.trim() !== ''`, nhưng payload giữ nguyên giá trị người dùng nhập, không trim mật khẩu; mật khẩu mới 8–72 ký tự, tối đa 72 byte UTF-8, khác mật khẩu hiện tại; xác nhận khớp mật khẩu mới. Thành công xóa cả ba giá trị và thông báo mật khẩu đã đổi, các thiết bị khác đã bị đăng xuất. Sau client validation, 400 hiển thị mật khẩu hiện tại không đúng, 429 yêu cầu thử lại sau 15 phút, 409/mạng/5xx dùng lỗi hệ thống VI/EN; không lộ raw backend message. Không thêm nhánh 401 vì API client đã tự refresh phiên.
- Nút Đăng xuất đặt gần cuối card trái. Nút Đăng xuất khỏi tất cả thiết bị đặt ngay dưới, có phong cách nguy hiểm nổi bật nhưng không dùng màu ngoài token.
- Logout-all dùng phần tử `<dialog>` gốc với `showModal()` thay cho dialog trình duyệt dạng `window.*` hoặc focus trap tự viết. Nội dung nói rõ thiết bị hiện tại cũng bị đăng xuất; có Hủy/Xác nhận, focus ban đầu vào Hủy. Sự kiện `cancel` do Escape đóng dialog khi chưa pending nhưng phải `preventDefault()` khi pending; mọi đường đóng đều gọi `opener.focus()` tường minh. Callback từ App phải reject nguyên lỗi; khi pending không gửi lặp, lỗi giữ dialog mở và báo chung VI/EN, thành công mới xóa phiên và chuyển `/login`.
- Hoàn thiện typography, khoảng cách, trạng thái hover/focus/disabled/loading/success/error cho cả dark/light để trang không còn cảm giác form mặc định và đồng bộ với Login/Register cùng UI foundation.

## Ngoài phạm vi

- Không sửa `server/`, API contract, DB, Flyway, xác thực hoặc semantics session đã bàn giao ở Backend.
- Không thêm university, specialty, experience, headline, bio, skills, GitHub, LinkedIn, website/portfolio hoặc bất kỳ field user mới nào. Không chuyển dữ liệu Author Profile sang User Profile.
- Không triển khai My Articles, Security, Login History hoặc placeholder cho các mục này; chỉ thêm lại khi có chức năng/backend thật.
- Không thêm liên kết tài khoản local/Google, tạo mật khẩu cho Google-only, forgot/reset password, lịch sử mật khẩu hay đánh giá độ mạnh mới.
- Không đổi route ngoài `/profile`, shell/sidebar toàn ứng dụng, luồng logout hiện tại hoặc giao diện Login/Register.
- Không thêm ảnh trang trí, gradient, quầng sáng, font, icon package, UI framework hay dependency mới.

## Ràng buộc

- Được đổi API: Không. Được đổi DB (Flyway mới): Không.
- Giữ nguyên hành vi hiện tại: Có; chỉ thay cách trình bày và nối các API profile/password/avatar/logout đã có vào cùng giao diện.
- Bám [`docs/design/UI_GUIDE.md`](../docs/design/UI_GUIDE.md): Inter duy nhất, CSS thường, Lucide hiện có, token hiện có, primary xanh đặc, card slate/light, border/shadow nhẹ; dark là mặc định và light vẫn đầy đủ.
- Không viết literal màu/hex trong TSX hoặc `profile.css`; không tạo hệ token riêng. Không dùng gradient, emoji làm icon hoặc ảnh giả.
- Mọi copy/trạng thái/lỗi mới có cả VI/EN và đổi theo ngôn ngữ hiện tại. Không hiển thị raw backend message hoặc chi tiết nội bộ.
- Điều khiển tương tác tối thiểu 44×44 px, có focus ring nhìn thấy, tương phản chữ tối thiểu 4.5:1, không chỉ dựa vào màu/hover để truyền đạt trạng thái.
- `UserProfile.hasLocalPassword` là boolean bắt buộc vì backend luôn trả field này; mọi fixture trực tiếp của kiểu phải khai báo rõ `true` hoặc `false`.
- Tái dùng `Eye`/`EyeOff` và `.password-toggle` của Login/Register mà không sửa CSS auth; kiểm 72 byte bằng cùng cách `TextEncoder` hiện có. Dialog dùng `<dialog>` gốc, không thêm thư viện hay focus-trap tùy biến.

## Xong khi

- [ ] `/profile` chỉ còn Thông tin cá nhân và Đổi mật khẩu có điều kiện; `ProfilePage.test.tsx` chứng minh local thấy hai panel, Google-only không thấy đổi mật khẩu và không có mobile selector; không còn menu/field/panel rời/copy/CSS mồ côi đã nêu.
- [ ] Form chỉ hiển thị avatar, họ tên, email chỉ đọc, phone và date; `ProfilePage.test.tsx` chứng minh: tên rỗng/151 ký tự, phone 9 chữ số/chứa chữ/21 ký tự, ngày sinh hôm nay/5 tuổi đều báo lỗi đúng trường và không gọi API; phone có dấu cách hợp lệ và ngày sinh đủ 6 tuổi được nhận; input khóa khi pending; PATCH chỉ có field dirty chuẩn hóa, khoảng trắng cuối tên không tạo dirty, phone/date rỗng thành `null`, avatar không ghi đè field đang sửa, thành công tạo baseline mới, 400 dùng câu kiểm tra thông tin và lỗi hệ thống không lộ raw message.
- [ ] `ProfilePage.test.tsx` dùng label/file input và `user.upload` để chứng minh chỉ JPEG/PNG/WebP ≤ 5 MiB được gửi, chọn sai không gọi API, pending chống gửi lặp, thành công cập nhật avatar; kiểm focus/keyboard mở file picker bằng trình duyệt trong lượt kiểm giao diện, không tuyên bố jsdom mở được hộp chọn file gốc.
- [ ] `ChangePasswordPanel.test.tsx` bao phủ ba toggle độc lập; required gồm giá trị toàn khoảng trắng, 8–72 ký tự, 72 byte UTF-8, khác current và confirm khớp; payload giữ nguyên password hợp lệ; thành công xóa form và báo các phiên khác đã thoát; 400/429/409/lỗi hệ thống dùng copy VI/EN đã chốt.
- [ ] Logout nằm trên logout-all; test `<dialog>` với cùng hành vi stub `showModal`/`close` cục bộ trong hai file chứng minh focus đầu ở Hủy, sự kiện `cancel` đóng khi rảnh nhưng bị chặn lúc pending, Hủy đóng, pending khóa gửi lặp, lỗi giữ mở/trả lỗi chung và mọi đường đóng gọi trả focus; một regression `App.auth.test.tsx` chứng minh xác nhận thành công mới xóa phiên/chuyển `/login`.
- [ ] Tạo một lượt bốn ảnh dark/light tại desktop 1440×900 và mobile giả lập 390×844, đọc tối đa hai ảnh đại diện là dark desktop + light mobile; kiểm đủ bốn trạng thái không cuộn ngang và điều khiển ≥44×44 px, kiểm focus avatar bằng bàn phím trong trình duyệt. Chỉ đo tương phản ≥4.5:1 cho cặp token mới được ghép; cặp đã chốt ở `ui-foundation` không đo lại. Thiếu môi trường mobile thì ghi “chưa kiểm”, không đánh dấu đạt.
- [ ] Không có dependency/font/route/backend mới; không có gradient, ảnh trang trí hoặc literal màu trong phạm vi (`rg -n '#[0-9A-Fa-f]{3,8}\b|linear-gradient|radial-gradient' app/src/pages/Profile app/src/styles/pages/profile.css app/src/data/profile.ts` không có kết quả).
- [ ] `UserProfile` và fixture được gõ kiểu trong `Sidebar.test.tsx` có `hasLocalPassword`; không sửa mock response không gõ kiểu chỉ để thêm field. Regression App logout-all và sidebar tiếp tục đạt.
- [ ] Trong `app/`, toàn bộ `npm test` đạt với mốc ít nhất 165 test cũ cộng test mới của profile và `npm run build` đạt.

## Phản hồi vòng 1 (Claude)

Đã nêu 10 điểm về dirty sync, khả năng kiểm thử jsdom, gating local/Google-only, phân loại lỗi, logout-all, fixture và ngân sách ảnh; đồng thời yêu cầu tái dùng toggle/password validation hiện có.

## Trả lời vòng 1 (Codex)

Đã gộp toàn bộ điểm đúng vào thân spec; chỉ giữ `App.auth.test.tsx` cho một regression logout-all cấp App và bỏ hai fixture test không cần thiết khỏi phạm vi.

## Phản hồi vòng 2 (Claude)

Đồng ý toàn bộ; làm rõ `@NotBlank`, sự kiện `cancel` khi dialog pending và trả focus tường minh. Bổ sung sau vòng 2 chỉ ra validation hồ sơ, khóa input khi pending và dirty chuẩn hóa còn thiếu.

## Trả lời vòng 2 (Codex)

Đã đối chiếu trực tiếp `UpdateMyProfileRequest`, `PhoneNumberValidator` và `MinimumAgeValidator`; chấp nhận toàn bộ, gộp vào Phạm vi/“Xong khi”. Không còn bất đồng kỹ thuật hoặc điểm yếu chưa có cách kiểm chứng trong phạm vi đã chốt.

## Quyết định của người dùng

- 2026-11-02: Người dùng xác nhận đã nhận kết quả Backend và chốt spec Giao diện sau khi Codex chấp nhận phần bổ sung cuối của Claude; giao Claude thực hiện.
- Giữ dashboard hai cột; chỉ dùng field/backend thật; avatar chỉ chọn trực tiếp trên ảnh, bỏ hẳn panel/preview upload rời; bỏ menu chưa có chức năng; logout-all nằm dưới logout và dùng dialog xác nhận riêng.
- Validation hồ sơ phía client phải khớp Backend, khóa input khi pending và tính dirty theo giá trị chuẩn hóa; không đổi API, `ApiError`, DB hoặc dependency.
