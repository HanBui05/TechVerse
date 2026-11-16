# PayOS checkout

Trạng thái: xem [`PLAN.md`](PLAN.md). Spec do Claude viết; Codex chỉ ghi vào mục “Phản hồi” (D-030, 2026-11-14). Thay cho “Task 1e — PayOS webhook” (hoãn) trong [`course-payment.md`](course-payment.md); phần đó không còn hiệu lực.

**Mục tiêu:** Học viên trả tiền khóa học qua payOS ngay trên trang đơn (khung thanh toán nhúng); tiền về tài khoản sàn và đơn tự chuyển sang đã trả, cấp quyền học mà Admin không phải dò sao kê. Luồng VietQR + Admin xác nhận tay vẫn giữ làm dự phòng khi không cấu hình payOS.
**Làn:** Đầy đủ · **Rủi ro cao:** tiền, đồng thời, webhook công khai; code bằng Opus, review vòng 1 dùng `adversarial-review`.
**Thứ tự:** làm sau module `author-payout`. 1a → 1b → cổng wireframe → 2. Cổng wireframe (luật “Wireframe” trong `CLAUDE.md`): sau Task 1b, bổ sung vào `plans/course-payment.wireframe.md` trang đơn có khung payOS (desktop + mobile; chờ, đang kiểm tra, đã trả, hết hạn, chưa tạo được link, khung lỗi) và phần đơn payOS trong Sheet Admin; người dùng duyệt rồi mới làm Task 2.
**Nguồn tài liệu đã xác minh:** [`course-payment.directions.md`](course-payment.directions.md) mục 9, đoạn “Xác minh lại 2026-11-16”.

## Đường dẫn thuộc module

Chỉ được sửa các đường dẫn sau. Ngoài danh sách là ngoài phạm vi.

- `server/src/main/resources/db/migration/V18__payos_checkout.sql`, `server/src/main/resources/application*.yaml`, `.env.example`.
- `server/src/main/java/com/techverse/server/{controller,entity,dto,repository,service}/**/*{Order,Payment,Payos}*.java`; `exception/ErrorCode.java`; `configuration/SecurityConfiguration.java`.
- `server/src/test/java/com/techverse/server/course/**` (lớp mới `PayosSignatureTest`, `PayosIntegrationTest`; sửa `OrderServiceTest`, `OrderIntegrationTest`, `PaymentConfirmationIntegrationTest`, `CoursePaymentMigrationTest`, `CourseIntegrationTestBase`); test khẳng định phiên bản Flyway mới nhất.
- `plans/course-payment.wireframe.md` (bổ sung ở cổng wireframe); `docs/RUNBOOK.md` (mục chạy payOS trên máy cá nhân).
- `app/package.json`, `app/package-lock.json` (thêm `@payos/payos-checkout`); `app/src/types/courses.ts`, `app/src/services/courseService{,.test}.ts`, `app/src/data/{courseI18n,courseI18n.test}.ts`.
- `app/src/pages/Payments/**`, `app/src/pages/Admin/Orders/**` và test.

## Ngoài phạm vi

- API chi hộ của payOS (tự chuyển tiền cho tác giả), hoàn tiền, hủy link từ phía sàn, hóa đơn điện tử của payOS.
- Học viên tự chọn cách thanh toán; trang return/cancel riêng; tự động đăng ký webhook từ ứng dụng (làm tay theo `docs/RUNBOOK.md`).
- Tự quét định kỳ các đơn chờ (không scheduler); thông báo/email khi đơn được trả.
- Gọi payOS thật trong test tự động.

## Ràng buộc

- Được đổi API: Có (thêm trường và endpoint; không đổi trường cũ). Được đổi DB: Có, chỉ V18; không sửa V1–V17.
- Giữ nguyên hành vi đơn MANUAL (VietQR, báo chuyển khoản, Admin xác nhận, đối chiếu) và mọi quy tắc cấp quyền/hoa hồng: payOS chỉ là một **nguồn xác nhận** khác, dùng chung trigger `grant_course_access_after_payment` và UNIQUE `(provider, provider_transaction_id)`.
- **Chọn nguồn:** đủ ba khóa `payos.client-id`, `payos.api-key`, `payos.checksum-key` thì mọi đơn **mới** là PAYOS (hạn 15 phút, chốt 2026-11-14); thiếu thì là MANUAL như hiện tại. Đơn đã tạo giữ nguồn gốc.
- **Chỉ server quyết định đã trả:** quyền học chỉ cấp khi (a) webhook có chữ ký hợp lệ, hoặc (b) server tự tra cứu payOS. Sự kiện `onSuccess` của khung nhúng và URL return/cancel không cấp quyền.
- payOS không công bố việc gửi lại webhook: không được dựa vào gửi lại; tra cứu (Task 1b) là đường dự phòng bắt buộc.
- Không giữ khóa DB hay transaction trong lúc gọi payOS. Không log khóa, chữ ký hay toàn bộ payload. Số tiền, mã đơn, URL gửi payOS lấy từ DB/cấu hình, không nhận từ client.
- Số gửi payOS (`orderCode` kiểu số nguyên) là phần 12 chữ số của mã đơn `TV…` (đã duy nhất nhờ sequence V14); `description` = `TV` + 7 chữ số cuối (≤ 9 ký tự); `returnUrl` = `cancelUrl` = trang đơn `/me/orders/{orderCode}` trên địa chỉ frontend cấu hình ở `payos.return-base-url`.

## Task 1a — Tạo đơn payOS và link thanh toán

**Giai đoạn:** Backend · **Đổi giao diện:** Không

### Phạm vi

- V18: `orders.payos_payment_link_id varchar(64)` UNIQUE nullable, `orders.payos_checkout_url varchar(255)` nullable; mở rộng CHECK `confirmation_source` thêm `'LOOKUP'`.
- Tạo đơn (`POST /api/v1/orders`) khi payOS được cấu hình: đơn PENDING hạn 15 phút + một dòng `payment_transactions` PENDING với `provider = 'PAYOS'`, commit; **sau commit** gọi “đảm bảo link”.
- “Đảm bảo link” (dùng khi tạo đơn và khi đọc đơn PAYOS còn PENDING mà chưa có link): tra cứu `GET /v2/payment-requests/{số đơn}`; có thì lưu `id` và dựng URL `https://pay.payos.vn/web/{id}`; chưa có thì `POST /v2/payment-requests` (`amount`, `description`, `orderCode`, `returnUrl`, `cancelUrl`, `expiredAt` = hạn đơn, chữ ký HMAC-SHA256 theo tài liệu) rồi lưu `paymentLinkId`, `checkoutUrl`. Lưu bằng cập nhật có điều kiện “chưa có link” để hai request song song không ghi đè nhau.
- payOS lỗi/timeout: đơn vẫn tồn tại, response trả đơn với `checkoutUrl = null`; lần đọc đơn sau thử lại. Không tạo đơn thứ hai, không tạo link thứ hai cho cùng đơn.
- `OrderResponse` thêm `provider` (`MANUAL`/`PAYOS`) và `checkoutUrl` (chỉ khi PAYOS + PENDING + có link); đơn PAYOS có `vietQr = null`.
- `POST /orders/{orderCode}/transfer-report` trên đơn PAYOS bị từ chối.

### Quy tắc nghiệp vụ và mã lỗi

| Trường / tình huống | Ràng buộc | HTTP / mã lỗi | Copy hiển thị |
|---|---|---|---|
| Quyền, khóa học, đã có quyền, giới hạn tần suất | Như tạo đơn hiện tại | như hiện tại | như hiện tại |
| payOS cấu hình đủ | Đơn mới là PAYOS, hạn 15 phút | 200 | — |
| payOS cấu hình thiếu một phần (1–2 trong 3 khóa, hoặc thiếu `return-base-url`) | Coi như không cấu hình; đi MANUAL nếu VietQR có, không thì như hiện tại | 200 / 503 `PAYMENT_UNAVAILABLE` | Thanh toán tạm thời không khả dụng. |
| Đã có đơn PENDING còn hạn cho khóa đó | Trả đơn cũ (kể cả khác nguồn với cấu hình hiện tại) | 200 | — |
| payOS timeout/từ chối/trả dữ liệu sai khi tạo link | Đơn giữ PENDING, `checkoutUrl = null`; lần sau tra cứu trước khi tạo lại | 200 (đơn) | Chưa tạo được mã thanh toán; hãy thử lại. |
| Đơn hết hạn trước khi có link | Đánh EXPIRED như hiện tại; mua lại tạo đơn mới | 200 | — |
| Báo chuyển khoản trên đơn PAYOS | Không áp dụng | 409 `ORDER_TRANSFER_REPORT_NOT_ALLOWED` | Đơn này không cần báo chuyển khoản. |
| Hai request đọc/tạo cùng đơn song song | Một link duy nhất được lưu | 200 | — |

### Kế hoạch thực thi

- **File cần đụng:** V18; `CourseOrder` (hai cột mới), `OrderRepository` (`insertOrder` nhận hạn theo phút, dòng giao dịch PAYOS, cập nhật link có điều kiện), `OrderService.create/detail/reportTransfer`, `OrderResponse`; lớp mới `PayosClient` (gọi HTTP + ký/kiểm chữ ký); `application.yaml`, `.env.example`.
- **Phần dùng lại:** toàn bộ kiểm tra và khóa của `OrderService.create`; `expireOverdue`; cách đọc cấu hình bằng `@Value` như `vietqr.*`.
- **Bẫy đã biết:** `create` đang `@Transactional` trọn hàm — phải tách để lời gọi payOS nằm **sau** commit; hai chỗ có chú thích `shortcut: every order is MANUAL` trong `OrderService` phải xử lý; `MANUAL_HOURS` là hằng số giờ; lỗi payOS chỉ có `code`/`desc` (`code = "00"` là thành công); `expiredAt` là Unix giây kiểu Int32; `char(3)` không dùng cho cột mới (Hibernate validate).

### Xong khi

- [ ] `PayosSignatureTest` (unit): chữ ký tạo link đúng chuỗi `amount=…&cancelUrl=…&description=…&orderCode=…&returnUrl=…`; số đơn và `description` dựng đúng từ mã `TV…`.
- [ ] `OrderServiceTest` (unit): chọn nguồn theo cấu hình (đủ, thiếu một phần, không có).
- [ ] `PayosIntegrationTest` (mới, DB/security thật, payOS giả không gọi mạng): tạo đơn PAYOS có link và hạn 15 phút; payOS lỗi → đơn không link, đọc lại thì có link và payOS chỉ nhận một lần tạo; timeout nhưng link đã tồn tại → dùng link tra cứu được; hai lần đọc song song → một link; báo chuyển khoản → 409.
- [ ] `CoursePaymentMigrationTest`: V1→V18 và DB rỗng.
- [ ] Các lớp trên + `OrderIntegrationTest`, `PaymentConfirmationIntegrationTest` (đơn MANUAL không đổi hành vi) đạt; full backend do CI.

## Task 1b — Xác nhận thanh toán: webhook và tra cứu

**Giai đoạn:** Backend · **Đổi giao diện:** Không

### Phạm vi

- Một hàm xác nhận payOS dùng chung, đầu vào (số đơn, số tiền, mã giao dịch ngân hàng, mã link, nguồn `WEBHOOK`/`LOOKUP`): khóa người mua rồi đơn như `confirm`, áp bảng quy tắc dưới, ghi `confirmed_by = null`, `confirmation_source` theo nguồn. Trùng mã giao dịch là không làm gì.
- `POST /api/v1/payments/payos/webhook`: route **duy nhất** `permitAll` thêm vào; đọc JSON, kiểm chữ ký HMAC-SHA256 trên `data` (sắp key, null → rỗng, so sánh thời gian hằng) **trước** mọi xử lý; rồi gọi hàm xác nhận. Trả 2XX khi đã xử lý hoặc không cần xử lý.
- Tra cứu: `POST /api/v1/orders/{orderCode}/sync` (chủ đơn, tính vào giới hạn tần suất đơn hàng) và `POST /api/v1/admin/orders/{orderCode}/sync` (ADMIN). Chỉ cho đơn PAYOS: gọi `GET /v2/payment-requests/{số đơn}` ngoài transaction; `status = PAID` thì với từng phần tử `transactions` gọi hàm xác nhận (nguồn `LOOKUP`). Trả đơn sau cùng.
- `AdminOrderResponse` thêm `provider`; danh sách khoản của đơn hiện cả khoản bất thường (dòng `FAILED` kèm `failure_reason`).
- `docs/RUNBOOK.md`: các bước chạy trên máy cá nhân (ba khóa, `payos.return-base-url`, bật ngrok, đăng ký webhook qua `my.payos.vn` hoặc `POST /confirm-webhook`).

### Quy tắc nghiệp vụ và mã lỗi

| Trường / tình huống | Ràng buộc | HTTP / mã lỗi | Copy hiển thị |
|---|---|---|---|
| Webhook: JSON hỏng, thiếu `data`/`signature`, chữ ký sai, payOS chưa cấu hình | Không đổi DB; không lộ lý do | 400 `PAYMENT_WEBHOOK_INVALID` | — |
| Webhook hợp lệ nhưng `success` sai hoặc mã không phải thành công | Không đổi DB | 200 | — |
| Số đơn không khớp đơn PAYOS nào (gồm payload mẫu lúc đăng ký webhook) | Không đổi DB | 200 | — |
| Mã link khác mã đã lưu của đơn | Không đổi DB; ghi log cảnh báo (không payload) | 200 | — |
| Đơn chưa lưu mã link (webhook tới trước khi lưu) | Chữ ký + số đơn + số tiền khớp là đủ; lưu mã link từ webhook | 200 | — |
| Số tiền khác tổng đơn, hoặc tiền tệ khác VND | Không cấp quyền; ghi một dòng giao dịch `FAILED` (số tiền thực, mã giao dịch, lý do) và bật cờ đối chiếu của đơn | 200 | — |
| Đúng tiền, đơn PENDING hoặc EXPIRED | Dòng PAYOS đang mở thành SUCCEEDED → trigger đánh PAID và cấp quyền một lần | 200 | — |
| Đúng tiền, đơn đã PAID, mã giao dịch mới | Ghi thêm dòng SUCCEEDED → trigger bật cờ đối chiếu; không thêm quyền, không nhân doanh thu | 200 | — |
| Học viên đã có quyền qua đơn khác | Như trên: PAID + cờ đối chiếu | 200 | — |
| Cùng mã giao dịch tới lần nữa (webhook lặp, webhook + tra cứu, hai request đồng thời) | Xử lý đúng một lần | 200 | — |
| Lỗi DB khi đang xử lý | Rollback toàn bộ | 500 | — |
| Tra cứu: đơn MANUAL | Không áp dụng | 409 `PAYMENT_STATE_INVALID` | Đơn này không thanh toán qua payOS. |
| Tra cứu: không phải chủ đơn / không tồn tại; Admin: không phải ADMIN | — | 404 `ORDER_NOT_FOUND` / 403 `ACCESS_DENIED` | Không tìm thấy đơn hàng. / Bạn không có quyền. |
| Tra cứu: payOS lỗi/timeout | Không đổi DB | 503 `PAYMENT_PROVIDER_UNAVAILABLE` | Cổng thanh toán tạm thời không phản hồi; hãy thử lại. |
| Tra cứu: payOS báo chưa trả/đã hủy/hết hạn | Không đổi DB; trả đơn hiện tại | 200 | — |
| Tra cứu: vượt giới hạn tần suất | — | 429 `ORDER_RATE_LIMITED` | Bạn thao tác quá nhanh; hãy thử lại sau. |
| Admin xác nhận tay đơn PAYOS | Vẫn cấm (hiện có) | 409 `PAYMENT_STATE_INVALID` | Đơn payOS không xác nhận tay; hãy bấm kiểm tra với payOS. |

### Kế hoạch thực thi

- **File cần đụng:** `OrderService` (hàm xác nhận payOS, hai hàm tra cứu), `OrderRepository` (chuyển dòng PAYOS đang mở, chèn dòng thêm, chèn dòng bất thường, lưu mã link), `OrderController` (hai route tra cứu), controller webhook mới (`PayosWebhookController`, nhóm route mới), `PayosClient` (tra cứu, kiểm chữ ký webhook), `AdminOrderResponse`, `ErrorCode`, `SecurityConfiguration`.
- **Phần dùng lại:** `lockOrder` và thứ tự khóa của `confirm`; trigger V15 lo PAID/cấp quyền/cờ đối chiếu; cách bắt `uq_payment_transactions_provider_reference` trong `confirm`.
- **Bẫy đã biết:** webhook và tra cứu có thể tới cùng lúc → dựa vào UNIQUE `(provider, provider_transaction_id)` + khóa đơn, không dựa vào kiểm trước; `findPayments` chỉ lấy `SUCCEEDED`, đếm của `reconcile` phải giữ nguyên nghĩa (khoản bất thường không tính vào `paymentCount`, nhưng cờ vẫn đóng được); chữ ký webhook khác chữ ký tạo link; `SecurityConfiguration` có `denyAll` cuối — route webhook phải khai trước; route công khai không được nhận token làm điều kiện.

### Xong khi

- [ ] `PayosSignatureTest`: kiểm chữ ký webhook với vector tự dựng (key sắp xếp, giá trị null, sai một ký tự, sai khóa).
- [ ] `PayosIntegrationTest`: webhook hợp lệ → PAID + một enrollment + doanh thu một lần; từng dòng bảng (chữ ký sai 400 và DB không đổi; payload mẫu; sai tiền → dòng `FAILED` + cờ; đơn EXPIRED vẫn trả; đơn đã PAID + mã mới → cờ; webhook tới trước khi lưu link).
- [ ] Ca đồng thời: cùng một webhook gửi hai lần song song, và webhook song song với tra cứu → đúng một dòng SUCCEEDED, một enrollment.
- [ ] Tra cứu: chủ đơn và Admin; payOS giả trả PAID → đơn PAID nguồn `LOOKUP`; chưa trả → không đổi; payOS lỗi → 503; đơn MANUAL → 409; người khác → 404.
- [ ] Webhook gọi không token được chấp nhận; mọi route khác vẫn đòi quyền như cũ.
- [ ] Các lớp trên + `PaymentConfirmationIntegrationTest`, `OrderIntegrationTest` đạt; full backend do CI.

## Task 2 — Trang đơn với khung payOS và đơn payOS ở Admin (giao diện)

**Giai đoạn:** Giao diện · **Đổi giao diện:** Có (sau khi người dùng duyệt wireframe)

### Phạm vi

- Việc đầu tiên: cài `@payos/payos-checkout`, dựng thử khung nhúng với React của `app/`, ghi kết quả vào log. Không chạy được thì dừng báo người dùng; phương án lùi là chỉ dùng link mở trang payOS ở tab mới.
- `/me/orders/:orderCode`, đơn PAYOS còn PENDING: khung payOS nhúng (`CHECKOUT_URL` = `checkoutUrl` server trả) thay cho ảnh VietQR và nút “Tôi đã chuyển khoản”; luôn có link “Mở trang thanh toán payOS” (tab mới). `onSuccess` → gọi tra cứu rồi tải lại đơn; nếu đơn chưa PAID thì tự tra cứu lại vài lần cách quãng rồi dừng, để lại nút “Kiểm tra lại”. Mở trang đơn PAYOS đang PENDING cũng gọi tra cứu một lần.
- `checkoutUrl = null`: thông báo chưa tạo được mã thanh toán + nút “Thử lại” (đọc lại đơn). Đơn hết hạn/đã trả/hủy: không dựng khung, hiện trạng thái như đơn MANUAL. Đơn MANUAL: không đổi.
- `/admin/orders`: nhãn nguồn (payOS / Chuyển khoản tay) ở danh sách và Sheet; đơn PAYOS không có form xác nhận tay, có nút “Kiểm tra với payOS”; khoản bất thường hiện kèm lý do.

### Quy tắc nghiệp vụ và mã lỗi

Theo bảng Task 1a, 1b. `onSuccess`, `onCancel`, `onExit` chỉ đổi giao diện, không tự coi đơn là đã trả.

### Copy vi/en

| Khóa / trạng thái | vi | en |
|---|---|---|
| Hướng dẫn | Quét mã bằng ứng dụng ngân hàng để thanh toán. Đơn tự cập nhật sau khi nhận tiền. | Scan the code with your banking app. The order updates once the payment arrives. |
| Link dự phòng | Mở trang thanh toán payOS | Open the payOS payment page |
| Đang kiểm tra | Đang kiểm tra thanh toán… | Checking your payment… |
| Chưa thấy tiền | Chưa ghi nhận thanh toán. Nếu bạn đã chuyển, hãy bấm Kiểm tra lại sau ít phút. | No payment found yet. If you have paid, check again in a few minutes. |
| Nút | Kiểm tra lại / Thử lại | Check again / Try again |
| Chưa có link | Chưa tạo được mã thanh toán; hãy thử lại. | Could not create the payment code; please try again. |
| Khung lỗi | Không tải được khung thanh toán. Hãy mở trang thanh toán payOS. | The payment frame failed to load. Open the payOS payment page instead. |
| `PAYMENT_PROVIDER_UNAVAILABLE` | Cổng thanh toán tạm thời không phản hồi; hãy thử lại. | The payment gateway is not responding; please try again. |
| Admin: nguồn | payOS / Chuyển khoản tay | payOS / Manual transfer |
| Admin: nút | Kiểm tra với payOS | Check with payOS |
| Admin: không xác nhận tay | Đơn payOS không xác nhận tay; hãy bấm kiểm tra với payOS. | payOS orders cannot be confirmed manually; check with payOS instead. |
| Admin: bất thường | Số tiền nhận được không khớp đơn | Amount received does not match the order |

### UI

- Theo wireframe đã duyệt và `docs/design/UI_GUIDE.md`. Khung payOS do payOS vẽ: đặt trong vùng nền trắng cố định như ảnh QR hiện tại để dùng được ở dark mode; không cuộn ngang ở 390px; nút ≥ 44px.

### Xong khi

- [ ] `Payments.test.tsx` (thư viện payOS được giả lập): đơn PAYOS dựng khung với đúng `checkoutUrl` và có link dự phòng, không có nút báo chuyển khoản; `onSuccess` → gọi tra cứu → hiện đã trả; tra cứu chưa thấy → thông báo + nút Kiểm tra lại; `checkoutUrl = null` → Thử lại; đơn MANUAL vẫn như cũ; đổi sang đơn khác không giữ khung của đơn cũ.
- [ ] `AdminOrders.test.tsx`: nhãn nguồn; đơn PAYOS không có form xác nhận, nút kiểm tra gọi đúng API và cập nhật Sheet; khoản bất thường hiện lý do.
- [ ] `courseService.test.ts`, `courseI18n.test.ts`: API và mã lỗi mới.
- [ ] Các file test trên + `npm run build` trong `app/` đạt. Kiểm mắt trang đơn PAYOS và Sheet Admin dark/light × desktop + mobile một lượt (khung payOS thật nếu đã có khóa; chưa có thì ghi “chưa kiểm” kèm lý do).
- [ ] Thử thật một giao dịch 10.000 đồng qua ngrok khi người dùng đã có tài khoản payOS: ghi kết quả vào log (webhook tới, đơn PAID; tắt ngrok rồi trả → tra cứu cập nhật). Chưa có tài khoản thì ghi “chưa kiểm”.

## Câu hỏi mở cho người dùng (có mặc định; không trả lời thì dùng mặc định)

1. **Chọn cách thanh toán:** mặc định học viên không chọn; cấu hình payOS đủ thì mọi đơn mới đi payOS, thiếu thì đi VietQR tay.
2. **Sai số tiền:** mặc định không cấp quyền, bật cờ đối chiếu, Admin xử lý ngoài hệ thống.
3. **Thư viện nhúng không chạy được:** mặc định lùi về mở trang payOS ở tab mới, báo người dùng trước khi đổi.

## Phản hồi vòng 1 (Codex)

Đúng / Sai / Thiếu / Thừa:

### Đề xuất ngoài spec (không chặn chốt)

## Trả lời vòng 1 (Claude)

## Phản hồi vòng 2 (Codex)

## Trả lời vòng 2 (Claude)

## Quyết định của người dùng

- (2026-11-16) Mở lại payOS; khung thanh toán nhúng (embedded) trên trang đơn; webhook qua ngrok khi chạy máy cá nhân; thêm tra cứu payOS làm dự phòng khi webhook lỡ; có cổng wireframe trước giao diện; làm sau `author-payout`.
