# PayOS checkout

Trạng thái: xem [`PLAN.md`](PLAN.md). Spec do Claude viết; Codex chỉ ghi vào mục “Phản hồi” (D-030, 2026-11-14). Thay cho “Task 1e — PayOS webhook” (hoãn) trong [`course-payment.md`](course-payment.md); phần đó không còn hiệu lực.

**Mục tiêu:** Học viên trả tiền khóa học qua payOS ngay trên trang đơn (khung thanh toán nhúng); tiền về tài khoản sàn và đơn tự chuyển sang đã trả, cấp quyền học mà Admin không phải dò sao kê. Luồng VietQR + Admin xác nhận tay vẫn giữ làm dự phòng khi không cấu hình payOS.
**Làn:** Đầy đủ · **Rủi ro cao:** tiền, đồng thời, webhook công khai; code bằng Opus, review vòng 1 dùng `adversarial-review`.
**Thứ tự:** làm sau module `author-payout`. 1a → 1b → cổng wireframe → 2. Cổng wireframe (luật “Wireframe” trong `CLAUDE.md`): sau Task 1b, bổ sung vào `plans/course-payment.wireframe.md` trang đơn có khung payOS (desktop + mobile; chờ, đang kiểm tra, đã trả, trả thiếu, hết hạn, chưa tạo được link, khung lỗi) và phần đơn payOS trong Sheet Admin; người dùng duyệt rồi mới làm Task 2.
**Nguồn tài liệu đã xác minh:** [`course-payment.directions.md`](course-payment.directions.md) mục 9, đoạn “Xác minh lại 2026-11-16”.

## Đường dẫn thuộc module

Chỉ được sửa các đường dẫn sau. Ngoài danh sách là ngoài phạm vi.

- `server/src/main/resources/db/migration/V18__payos_checkout.sql`, `server/src/main/resources/application*.yaml`, `.env.example`.
- `server/src/main/java/com/techverse/server/{controller,entity,dto,repository,service}/**/*{Order,Payment,Payos}*.java` (lớp mới chỉ có `PayosClient`, `PayosWebhookController`); `exception/ErrorCode.java`; `configuration/SecurityConfiguration.java`.
- `server/src/test/java/com/techverse/server/course/**` (lớp mới `PayosClientTest`, `PayosIntegrationTest`; sửa `OrderServiceTest`, `OrderIntegrationTest`, `PaymentConfirmationIntegrationTest`, `CoursePaymentMigrationTest`, `CourseIntegrationTestBase`). Test ngoài thư mục này khẳng định phiên bản Flyway mới nhất: kiểm bằng grep đầu Task 1a, file nào thật sự vỡ thì ghi vào log rồi sửa.
- `plans/course-payment.wireframe.md` (bổ sung ở cổng wireframe); `docs/RUNBOOK.md` (mục chạy payOS trên máy cá nhân).
- `app/package.json`, `app/package-lock.json` (thêm `@payos/payos-checkout`); `app/src/types/courses.ts`, `app/src/services/courseService{,.test}.ts`, `app/src/data/{courseI18n,courseI18n.test}.ts`.
- `app/src/pages/Payments/**`, `app/src/pages/Admin/Orders/**` và test.

## Ngoài phạm vi

- API chi hộ của payOS (tự chuyển tiền cho tác giả), hoàn tiền, hủy link từ phía sàn, hóa đơn điện tử của payOS.
- Học viên tự chọn cách thanh toán; trang return/cancel riêng; tự động đăng ký webhook từ ứng dụng (làm tay theo `docs/RUNBOOK.md`).
- Tự quét định kỳ các đơn chờ (không scheduler); thông báo/email khi đơn được trả.
- Xử lý tiền trả thiếu hoặc thừa trong sản phẩm (chỉ hiển thị; Admin xử lý ngoài hệ thống). Gọi payOS thật trong test tự động.

## Ràng buộc

- Được đổi API: Có (thêm trường và endpoint; không đổi trường cũ). Được đổi DB: Có, chỉ V18; không sửa V1–V17.
- Giữ nguyên hành vi đơn MANUAL (VietQR, báo chuyển khoản, Admin xác nhận, đối chiếu, `paymentCount`) và mọi quy tắc cấp quyền/hoa hồng: payOS chỉ là một **nguồn xác nhận** khác, dùng chung trigger `grant_course_access_after_payment`.
- **Chọn nguồn:** payOS bật khi đủ **bốn** cấu hình `payos.client-id`, `payos.api-key`, `payos.checksum-key`, `payos.return-base-url` (URL tuyệt đối http/https); thiếu bất kỳ cái nào coi như tắt. Bật thì mọi đơn **mới** là PAYOS (hạn 15 phút, chốt 2026-11-14); tắt thì MANUAL như hiện tại. Đơn đã tạo giữ nguồn gốc.
- **Một nguồn sự thật:** đơn PAYOS chỉ được coi là đã trả theo kết quả server **tra cứu** `GET /v2/payment-requests/{số đơn}` (qua TLS, bằng khóa của sàn). Webhook có chữ ký hợp lệ chỉ là tín hiệu để server đi tra cứu; dữ liệu trong webhook, sự kiện `onSuccess` của khung nhúng và URL return/cancel không tự cấp quyền. Nhờ vậy webhook lỡ hay bị giả đều không sai tiền.
- **Một dòng thành công cho mỗi đơn PAYOS:** dòng `payment_transactions` của đơn chuyển SUCCEEDED với `provider_transaction_id` = mã link payOS; UNIQUE `(provider, provider_transaction_id)` bảo đảm webhook, tra cứu và request đồng thời chỉ ghi một lần.
- Mỗi lời gọi payOS có timeout 10 giây (kết nối + đọc); một lượt xin link gọi tối đa ba lần (tra cứu, tạo, tra cứu lại) nên luôn kết thúc trong 30 giây.
- **Không lùi trạng thái:** kết quả tra cứu tới muộn không được làm đơn PAID quay lại, không làm `payos_amount_paid` giảm (chỉ ghi giá trị lớn hơn), không ghi đè mã link đã lưu.
- Không giữ khóa DB hay transaction trong lúc gọi payOS. Không log khóa, chữ ký hay toàn bộ payload. Số tiền, mã đơn, URL gửi payOS lấy từ DB/cấu hình, không nhận từ client.
- Số gửi payOS (`orderCode` kiểu số nguyên) là phần 12 chữ số của mã đơn `TV…`; V18 đặt `MAXVALUE 999999999999` cho sequence mã đơn để không bao giờ bị cắt âm thầm. `description` = `TV` + 7 chữ số cuối (≤ 9 ký tự, chỉ để người chuyển nhìn, không dùng đối chiếu). `returnUrl` = `cancelUrl` = `{return-base-url}/me/orders/{orderCode}`. URL thanh toán trả cho client dựng từ mã link: `https://pay.payos.vn/web/{mã link}` (dạng thư viện nhúng yêu cầu).

## Task 1a — Tạo đơn payOS và link thanh toán

**Giai đoạn:** Backend · **Đổi giao diện:** Không

### Phạm vi

- V18: `orders.payos_payment_link_id varchar(64)` UNIQUE nullable; `orders.payos_link_requested_at timestamptz` (đánh dấu đang xin link); `orders.payos_amount_paid bigint` nullable (số payOS báo đã nhận, lần tra cứu gần nhất); mở rộng CHECK `confirmation_source` thêm `'PAYOS'`; `MAXVALUE` cho sequence mã đơn.
- Tạo đơn (`POST /api/v1/orders`) khi payOS bật: transaction ngắn tạo đơn PENDING hạn 15 phút + một dòng `payment_transactions` PENDING `provider = 'PAYOS'`, **commit**, rồi mới chạy “đảm bảo link”. Nhánh trả đơn PENDING cũ và `GET /orders/{orderCode}` của đơn PAYOS còn PENDING chưa có link cũng chạy “đảm bảo link” theo cùng quy tắc.
- “Đảm bảo link”: (1) transaction ngắn giành quyền bằng cập nhật có điều kiện (`payos_payment_link_id IS NULL` và `payos_link_requested_at` rỗng hoặc cũ hơn 60 giây — gấp đôi thời gian tối đa của một lượt, nên request cũ chắc chắn đã dừng trước khi request khác giành lại); không giành được thì trả đơn với `checkoutUrl = null`; (2) ngoài transaction: tra cứu `GET /v2/payment-requests/{số đơn}`, có thì dùng `id`; chưa có thì `POST /v2/payment-requests` (`amount`, `description`, `orderCode`, `returnUrl`, `cancelUrl`, `expiredAt` = hạn đơn, chữ ký HMAC-SHA256); payOS báo đơn đã tồn tại thì tra cứu lại; (3) transaction ngắn khóa đơn, đọc lại: chưa có mã link thì lưu; đã có (webhook/đồng bộ vừa lưu) và giống thì thôi; đã có mà khác, hoặc mã đó đã thuộc đơn khác (vỡ UNIQUE), thì không ghi đè, ghi log cảnh báo. Response luôn dựng từ trạng thái đơn đọc lại sau bước này (có thể đã PAID).
- payOS lỗi/timeout: đơn vẫn tồn tại, response trả đơn với `checkoutUrl = null`; sau 60 giây lần đọc đơn kế tiếp thử lại, luôn tra cứu trước khi tạo.
- `OrderResponse` thêm `provider` (`MANUAL`/`PAYOS`), `checkoutUrl` (chỉ khi PAYOS + PENDING + có link) và `amountPaid` (khi payOS đã báo nhận tiền); đơn PAYOS có `vietQr = null`.
- `POST /orders/{orderCode}/transfer-report` trên đơn PAYOS bị từ chối.

### Quy tắc nghiệp vụ và mã lỗi

| Trường / tình huống | Ràng buộc | HTTP / mã lỗi | Copy hiển thị |
|---|---|---|---|
| Quyền, khóa học, đã có quyền, giới hạn tần suất (kể cả Redis lỗi) | Như tạo đơn hiện tại | như hiện tại | như hiện tại |
| payOS bật | Đơn mới là PAYOS, hạn 15 phút | 200 | — |
| payOS tắt (thiếu bất kỳ cấu hình nào, URL sai dạng) | Đi MANUAL nếu VietQR có, không thì như hiện tại | 200 / 503 `PAYMENT_UNAVAILABLE` | Thanh toán tạm thời không khả dụng. |
| Đã có đơn PENDING còn hạn cho khóa đó | Trả đơn cũ (kể cả khác nguồn với cấu hình hiện tại) | 200 | — |
| payOS timeout/từ chối/trả dữ liệu thiếu khi xin link | Đơn giữ PENDING, `checkoutUrl = null` | 200 (đơn) | Chưa tạo được mã thanh toán; hãy thử lại. |
| Hai request cùng xin link cho một đơn | Trong 60 giây chỉ request giành được quyền gọi payOS; request kia nhận `checkoutUrl = null`. Chốt chặn cuối là payOS từ chối tạo trùng số đơn (chưa xác minh — kiểm ở lần thử thật, payOS không chặn thì dừng và báo người dùng) | 200 | — |
| Server chết hoặc payOS timeout giữa lúc xin link (kể cả sau khi payOS đã tạo link) | Sau 60 giây request kế tiếp giành lại, tra cứu trước và dùng link đã có | 200 | — |
| Kết quả xin link về sau khi đơn đã có mã link khác, hoặc mã đã thuộc đơn khác | Không ghi đè, không cấp quyền, log cảnh báo; trả trạng thái đơn hiện tại | 200 | — |
| Đơn hết hạn trước khi có link | Đánh EXPIRED như hiện tại; mua lại tạo đơn mới | 200 | — |
| Báo chuyển khoản trên đơn PAYOS | Không áp dụng | 409 `ORDER_TRANSFER_REPORT_NOT_ALLOWED` | Đơn này không cần báo chuyển khoản. |

### Kế hoạch thực thi

- **File cần đụng:** V18; `CourseOrder` (ba cột mới), `OrderRepository` (`insertOrder` nhận hạn theo phút, dòng giao dịch PAYOS, giành quyền và lưu link có điều kiện), `OrderService.create/detail/reportTransfer`, `OrderResponse`; lớp mới `PayosClient` (gọi HTTP, ký, kiểm chữ ký); `application.yaml`, `.env.example`.
- **Phần dùng lại:** toàn bộ kiểm tra và khóa của `OrderService.create`; `expireOverdue`; cách đọc cấu hình bằng `@Value` như `vietqr.*`.
- **Bẫy đã biết:** `create` và `detail` đang `@Transactional` trọn hàm và `create` giữ khóa người mua + khóa advisory hoa hồng tới commit — phải tách bằng `TransactionTemplate` (gọi hàm `@Transactional` cùng lớp không qua proxy) để lời gọi payOS nằm ngoài mọi transaction; hai chú thích `shortcut: every order is MANUAL` trong `OrderService` phải xử lý; `MANUAL_HOURS` là hằng số giờ; lỗi payOS chỉ có `code`/`desc` (`"00"` là thành công); `expiredAt` là Unix giây kiểu Int32; cột mới không dùng `char` (Hibernate validate). Chưa xác minh với payOS: tính duy nhất theo `orderCode` chỉ dựa vào lỗi “đơn đã tồn tại” ghi trong tài liệu, và khoảng giá trị `orderCode` — ghi kết quả thử thật vào log.

### Xong khi

- [ ] `PayosClientTest` (unit, HTTP giả): chữ ký tạo link đúng chuỗi `amount=…&cancelUrl=…&description=…&orderCode=…&returnUrl=…`; số đơn và `description` dựng đúng từ mã `TV…`; lỗi “đơn đã tồn tại” → tra cứu lại; timeout và dữ liệu thiếu → lỗi có kiểm soát.
- [ ] `OrderServiceTest` (unit): payOS bật/tắt theo từng cấu hình thiếu và URL sai dạng.
- [ ] `PayosIntegrationTest` (mới, DB/security thật, payOS giả): tạo đơn PAYOS có link và hạn 15 phút; payOS lỗi → đơn không link, đọc lại sau thời gian chờ thì có link; timeout nhưng link đã tồn tại ở payOS → dùng link tra cứu được, không gọi tạo lần hai; hai request song song (payOS giả giữ cả hai ở bước tra cứu) → đúng một lần gọi tạo; quyền xin link chỉ giành lại được sau 60 giây (thời gian giả lập) và lời gọi payOS bị cắt ở 10 giây; đồng bộ lưu mã link chen giữa lúc xin link → kết quả về sau không ghi đè, response đúng trạng thái mới; mã link đã thuộc đơn khác → không lưu, không 500; trong lúc payOS giả đang giữ request, không còn transaction/khóa mở trên đơn (đọc và cập nhật đơn từ kết nối khác không bị chờ); báo chuyển khoản → 409.
- [ ] `CoursePaymentMigrationTest`: V1→V18 và DB rỗng; sequence vượt 12 chữ số báo lỗi thay vì cắt.
- [ ] Các lớp trên + `OrderIntegrationTest`, `PaymentConfirmationIntegrationTest` (đơn MANUAL không đổi hành vi) đạt; full backend do CI.

## Task 1b — Xác nhận thanh toán: tra cứu và webhook

**Giai đoạn:** Backend · **Đổi giao diện:** Không

### Phạm vi

- **Đồng bộ đơn** (một hàm dùng chung): ngoài transaction gọi `GET /v2/payment-requests/{số đơn}`; rồi trong một transaction khóa người mua và đơn như `confirm`, áp bảng quy tắc dưới theo `id`, `status`, `amount`, `amountPaid` payOS trả. Đủ tiền thì chuyển dòng PAYOS đang mở (PENDING hoặc EXPIRED) thành SUCCEEDED với `provider_transaction_id` = mã link, `confirmed_by = null`, `confirmation_source = 'PAYOS'`; trigger V15 lo PAID, cấp quyền và cờ đối chiếu.
- Ba nơi gọi đồng bộ: `POST /api/v1/orders/{orderCode}/sync` (chủ đơn; giới hạn tần suất **riêng** 10 lần/phút/người, không dùng chung ngân sách tạo đơn), `POST /api/v1/admin/orders/{orderCode}/sync` (ADMIN), và webhook. Đơn PENDING, EXPIRED, PAID đều đồng bộ được (người trả rồi quay lại sau hạn vẫn được cấp quyền). Sau khi khóa đơn luôn đọc lại trạng thái trước khi ghi, theo luật “không lùi trạng thái”.
- `POST /api/v1/payments/payos/webhook`: route **duy nhất** `permitAll` thêm vào. Đọc JSON; kiểm chữ ký HMAC-SHA256 trên `data` (sắp key theo chữ cái, null → chuỗi rỗng, object/mảng lồng theo tài liệu, so sánh thời gian hằng) **trước** mọi xử lý; chỉ lấy `data.orderCode` để tìm đơn PAYOS rồi gọi đồng bộ. Chống phát lại: body tối đa 16 KB; đơn đã PAID thì trả 200 mà không gọi payOS; đơn chưa PAID thì webhook chỉ được kích hoạt tối đa một lần tra cứu mỗi 3 giây cho mỗi đơn, vượt thì trả 503 (không báo đã xử lý, để tín hiệu không bị coi là xong). Không dùng `success`, `code`, số tiền hay bất kỳ trường nào của webhook để quyết định.
- `AdminOrderResponse` thêm `provider` và `amountPaid`. Hợp đồng `reconcile`/`paymentCount` không đổi.
- `docs/RUNBOOK.md`: các bước chạy trên máy cá nhân (bốn cấu hình, bật ngrok, đăng ký webhook qua `my.payos.vn` hoặc `POST /confirm-webhook`).

### Quy tắc nghiệp vụ và mã lỗi

| Trường / tình huống | Ràng buộc | HTTP / mã lỗi | Copy hiển thị |
|---|---|---|---|
| Webhook: JSON hỏng, thiếu `data`/`signature`/`data.orderCode`, chữ ký sai, payOS tắt | Không đổi DB; không lộ lý do | 400 `PAYMENT_WEBHOOK_INVALID` | — |
| Webhook hợp lệ, số đơn không khớp đơn PAYOS nào (gồm payload mẫu lúc đăng ký) | Không đổi DB, không gọi payOS | 200 | — |
| Webhook hợp lệ, khớp đơn | Chạy đồng bộ; kết quả theo các dòng dưới | 200 | — |
| Webhook: payOS không tra cứu được, hoặc lỗi DB | Rollback; để lần đồng bộ sau xử lý | 503 `PAYMENT_PROVIDER_UNAVAILABLE` / 500 | — |
| Webhook: body quá 16 KB | Từ chối trước khi đọc JSON | 400 `PAYMENT_WEBHOOK_INVALID` | — |
| Webhook hợp lệ gửi lặp cho đơn đã PAID | Không gọi payOS, không đổi DB | 200 | — |
| Webhook hợp lệ gửi dồn cho đơn chưa PAID (quá một lần mỗi 3 giây) | Không gọi payOS | 503 `PAYMENT_PROVIDER_UNAVAILABLE` | — |
| Kết quả tra cứu cũ về sau kết quả mới (trả thiếu về sau trả đủ; số nhận nhỏ hơn số đã lưu) | Không đổi trạng thái, không giảm `amountPaid` | 200 | — |
| payOS trả `status = PAID`, `amountPaid ≥ amount`, `amount` = tổng đơn, `id` khớp mã link đã lưu (hoặc đơn chưa lưu → lưu `id`) | Đơn PENDING/EXPIRED → PAID + cấp quyền một lần; lưu `amountPaid` | 200 | — |
| Như trên nhưng đơn đã PAID (webhook lặp, webhook cùng lúc với tra cứu, bấm lại) | Không ghi thêm gì | 200 | — |
| Như trên nhưng học viên đã có quyền qua đơn khác | Trigger đánh PAID + cờ đối chiếu, không thêm quyền, không nhân doanh thu | 200 | — |
| `0 < amountPaid < amount` (trả thiếu, payOS chưa PAID) | Không cấp quyền; lưu `amountPaid` để hiển thị; link vẫn nhận phần còn thiếu | 200 | payOS đã nhận {paid}, còn thiếu {remaining}. |
| `amountPaid > amount` (trả thừa) | Cấp quyền như đủ tiền; lưu `amountPaid` để Admin thấy | 200 | — |
| `id` khác mã link đã lưu, hoặc `amount` khác tổng đơn, hoặc thiếu trường bắt buộc | Không đổi DB; ghi log cảnh báo (không payload) | 200 (đơn hiện tại) | — |
| payOS báo chưa trả / đã hủy / hết hạn | Không đổi DB | 200 | — |
| Đơn ở trạng thái CANCELLED/FAILED (sản phẩm hiện không tạo ra) | Không cấp quyền; lưu `amountPaid`; ghi log cảnh báo | 200 | — |
| Đồng bộ: đơn MANUAL | Không áp dụng | 409 `PAYMENT_STATE_INVALID` | Đơn này không thanh toán qua payOS. |
| Đồng bộ: không phải chủ đơn / không tồn tại; Admin: không phải ADMIN | — | 404 `ORDER_NOT_FOUND` / 403 `ACCESS_DENIED` | Không tìm thấy đơn hàng. / Bạn không có quyền. |
| Đồng bộ: payOS lỗi/timeout | Không đổi DB | 503 `PAYMENT_PROVIDER_UNAVAILABLE` | Cổng thanh toán tạm thời không phản hồi; hãy thử lại. |
| Đồng bộ của học viên: vượt 10 lần/phút; Redis lỗi | — | 429 `ORDER_RATE_LIMITED` / như hiện tại | Bạn thao tác quá nhanh; hãy thử lại sau. |
| Admin xác nhận tay đơn PAYOS | Vẫn cấm (hiện có) | 409 `PAYMENT_STATE_INVALID` | Đơn payOS không xác nhận tay; hãy bấm kiểm tra với payOS. |

### Kế hoạch thực thi

- **File cần đụng:** `OrderService` (hàm đồng bộ, hai hàm gọi theo vai), `OrderRepository` (chuyển dòng PAYOS đang mở, lưu mã link và `amountPaid`), `OrderController` (hai route đồng bộ), controller webhook mới `PayosWebhookController` (nhóm route công khai, không `@PreAuthorize` của `OrderController`), `PayosClient` (tra cứu, kiểm chữ ký webhook), `AdminOrderResponse`, `ErrorCode`, `SecurityConfiguration`.
- **Phần dùng lại:** `lockOrder` và thứ tự khóa của `confirm`; trigger V15; mẫu chuyển dòng đang mở `confirmOpenPayment` (đổi `provider`, nguồn xác nhận).
- **Bẫy đã biết:** trigger V1 `validate_payment_transaction` bắt mọi dòng giao dịch phải đúng tổng đơn và VND — không ghi dòng “sai tiền” vào `payment_transactions`, chỉ lưu `payos_amount_paid` trên đơn; `expireOverdue` đã đổi dòng PENDING thành EXPIRED nên phải tìm cả hai trạng thái; hai request đồng bộ cùng lúc: request sau khóa xong phải đọc lại đơn (đã PAID thì dừng), không dựa vào bắt lỗi UNIQUE trong transaction đang dùng; chữ ký webhook khác chữ ký tạo link; `SecurityConfiguration` kết thúc bằng `denyAll` và hiện chỉ cho `POST /api/v1/orders` cùng `/orders/*/transfer-report` — phải thêm matcher `permitAll` cho POST webhook **và** matcher đã đăng nhập cho `POST /api/v1/orders/*/sync` (route Admin đã nằm dưới `/api/v1/admin/**`).

### Xong khi

- [ ] `PayosClientTest`: kiểm chữ ký webhook với vector tự dựng (key sắp xếp, giá trị null, object lồng, sai một ký tự, sai khóa).
- [ ] `OrderServiceTest` (unit): bảng quyết định đồng bộ theo từng dòng (đủ, thừa, thiếu, `id` khác, `amount` khác, thiếu trường, chưa trả/hủy/hết hạn).
- [ ] `PayosIntegrationTest`: webhook hợp lệ → PAID + một enrollment + doanh thu một lần, dòng SUCCEEDED mang mã link và nguồn `PAYOS`; chữ ký sai → 400, DB không đổi, payOS giả không bị gọi; payload mẫu → 200; trả thiếu → không quyền, `amountPaid` được lưu, trả nốt → PAID; đơn EXPIRED đã trả → PAID; học viên đã có quyền → cờ đối chiếu; webhook không token được chấp nhận còn route khác vẫn đòi quyền.
- [ ] Ca đồng thời: hai webhook giống nhau song song, và webhook song song với đồng bộ của học viên → đúng một dòng SUCCEEDED, một enrollment, không request nào 500; hai kết quả tra cứu về ngược thứ tự (đủ rồi mới tới thiếu) → đơn vẫn PAID, `amountPaid` không giảm.
- [ ] Chống phát lại: webhook lặp cho đơn PAID không gọi payOS giả; 5 webhook dồn cho đơn chưa PAID chỉ gây một lần tra cứu, các lần khác 503; body 17 KB → 400.
- [ ] Đồng bộ: chủ đơn gọi được, không token → 401; Admin; payOS lỗi → 503; đơn MANUAL → 409; người khác → 404; AUTHOR gọi route Admin → 403; lần thứ 11 trong một phút → 429 mà tạo đơn vẫn dùng được.
- [ ] Các lớp trên + `PaymentConfirmationIntegrationTest`, `OrderIntegrationTest` đạt; full backend do CI.

## Task 2 — Trang đơn với khung payOS và đơn payOS ở Admin (giao diện)

**Giai đoạn:** Giao diện · **Đổi giao diện:** Có (sau khi người dùng duyệt wireframe)

### Phạm vi

- Việc đầu tiên: cài `@payos/payos-checkout`, dựng thử khung nhúng với React của `app/`, ghi kết quả vào log. Không chạy được thì dừng báo người dùng; phương án lùi là chỉ dùng link mở trang payOS ở tab mới.
- `/me/orders/:orderCode`, đơn PAYOS còn PENDING: khung payOS nhúng (`CHECKOUT_URL` = `checkoutUrl` server trả) thay cho ảnh VietQR và nút “Tôi đã chuyển khoản”; luôn có link “Mở trang thanh toán payOS” (tab mới). `onSuccess` → gọi đồng bộ rồi tải lại đơn; nếu đơn chưa PAID thì tự đồng bộ lại tối đa 3 lần (sau 3, 6, 12 giây) rồi dừng, để lại nút “Kiểm tra lại”. Gặp 429 thì dừng tự thử, báo và mở lại nút sau 30 giây.
- Mở trang đơn PAYOS đang PENDING hoặc EXPIRED: gọi đồng bộ một lần. Đơn EXPIRED của PAYOS có nút “Kiểm tra lại” cạnh nút mua lại.
- `checkoutUrl = null`: thông báo chưa tạo được mã thanh toán + nút “Thử lại” (đọc lại đơn). Đơn đã trả/hủy: không dựng khung, hiện trạng thái như đơn MANUAL. Có `amountPaid` nhỏ hơn tổng: hiện số đã nhận và còn thiếu. Đơn MANUAL: không đổi.
- `/admin/orders`: nhãn nguồn (payOS / Chuyển khoản tay) ở danh sách và Sheet; đơn PAYOS không có form xác nhận tay, có nút “Kiểm tra với payOS”; hiện “payOS đã nhận X / Y” khi số nhận khác tổng đơn.

### Quy tắc nghiệp vụ và mã lỗi

Theo bảng Task 1a, 1b. `onSuccess`, `onCancel`, `onExit` chỉ đổi giao diện, không tự coi đơn là đã trả.

### Copy vi/en

| Khóa / trạng thái | vi | en |
|---|---|---|
| Hướng dẫn | Quét mã bằng ứng dụng ngân hàng để thanh toán. Đơn tự cập nhật sau khi nhận tiền. | Scan the code with your banking app. The order updates once the payment arrives. |
| Link dự phòng | Mở trang thanh toán payOS | Open the payOS payment page |
| Đang kiểm tra | Đang kiểm tra thanh toán… | Checking your payment… |
| Chưa thấy tiền | Chưa ghi nhận thanh toán. Nếu bạn đã chuyển, hãy bấm Kiểm tra lại sau ít phút. | No payment found yet. If you have paid, check again in a few minutes. |
| Trả thiếu | payOS đã nhận {paid}, còn thiếu {remaining}. Hãy chuyển nốt qua mã này. | payOS received {paid}; {remaining} is still due. Pay the rest with this code. |
| Nút | Kiểm tra lại / Thử lại | Check again / Try again |
| Chưa có link | Chưa tạo được mã thanh toán; hãy thử lại. | Could not create the payment code; please try again. |
| Khung lỗi | Không tải được khung thanh toán. Hãy mở trang thanh toán payOS. | The payment frame failed to load. Open the payOS payment page instead. |
| `PAYMENT_PROVIDER_UNAVAILABLE` | Cổng thanh toán tạm thời không phản hồi; hãy thử lại. | The payment gateway is not responding; please try again. |
| Quá nhanh | Bạn thao tác quá nhanh; hãy thử lại sau. | Too many attempts; please try again later. |
| Admin: nguồn | payOS / Chuyển khoản tay | payOS / Manual transfer |
| Admin: nút | Kiểm tra với payOS | Check with payOS |
| Admin: không xác nhận tay | Đơn payOS không xác nhận tay; hãy bấm kiểm tra với payOS. | payOS orders cannot be confirmed manually; check with payOS instead. |
| Admin: số nhận lệch | payOS đã nhận {paid} / {total} | payOS received {paid} of {total} |

### UI

- Theo wireframe đã duyệt và `docs/design/UI_GUIDE.md`. Khung payOS do payOS vẽ: đặt trong vùng nền trắng cố định như ảnh QR hiện tại để dùng được ở dark mode; không cuộn ngang ở 390px; nút ≥ 44px.

### Xong khi

- [ ] `Payments.test.tsx` (thư viện payOS được giả lập): đơn PAYOS dựng khung với đúng `checkoutUrl` và có link dự phòng, không có nút báo chuyển khoản; `onSuccess` → gọi đồng bộ → hiện đã trả; chưa thấy tiền → thử lại đúng 3 lần rồi hiện nút; 429 → dừng tự thử; trả thiếu hiện số còn thiếu; `checkoutUrl = null` → Thử lại; đơn EXPIRED của PAYOS gọi đồng bộ một lần; đơn MANUAL như cũ; đổi sang đơn khác không giữ khung của đơn cũ.
- [ ] `AdminOrders.test.tsx`: nhãn nguồn; đơn PAYOS không có form xác nhận, nút kiểm tra gọi đúng API và cập nhật Sheet; hiện số nhận lệch; đơn MANUAL như cũ.
- [ ] `courseService.test.ts`, `courseI18n.test.ts`: API và mã lỗi mới.
- [ ] Các file test trên + `npm run build` trong `app/` đạt. Kiểm mắt trang đơn PAYOS và Sheet Admin dark/light × desktop + mobile một lượt (khung payOS thật nếu đã có khóa; chưa có thì ghi “chưa kiểm” kèm lý do).
- [ ] Thử thật, chỉ khi người dùng đã có tài khoản payOS và đồng ý chi tiền: giao dịch 1 có ngrok (webhook tới, đơn PAID); giao dịch 2 tắt ngrok trước khi trả (đồng bộ cập nhật đơn). Số tiền thử là giá thấp nhất payOS chấp nhận, xác định ở giao dịch 1. Ghi kết quả vào log; không đủ điều kiện thì ghi “chưa kiểm”.

## Câu hỏi mở cho người dùng (có mặc định; không trả lời thì dùng mặc định)

1. **Chọn cách thanh toán:** mặc định học viên không chọn; payOS bật thì mọi đơn mới đi payOS, tắt thì đi VietQR tay.
2. **Trả thiếu hoặc thừa:** mặc định trả thiếu thì chưa cấp quyền, trang đơn báo còn thiếu bao nhiêu và trả nốt là được; trả thừa vẫn cấp quyền; phần chênh Admin xử lý ngoài hệ thống.
3. **Thư viện nhúng không chạy được:** mặc định lùi về mở trang payOS ở tab mới, báo người dùng trước khi đổi.

## Phản hồi vòng 1 (Codex)

Đúng / Sai / Thiếu / Thừa:

1. **Đúng — hướng và ranh giới đã chốt.** `plans/course-payment.log.md` ngày 2026-11-16 ghi embedded, link dự phòng, wireframe, làm sau `author-payout` và người dùng đã đồng ý tra cứu dự phòng khi lỡ webhook; dòng cũ chỉ dùng webhook ở cùng log đã bị quyết định tra cứu mới hơn thay thế. Tra cứu từ server là nguồn xác nhận bổ sung đã được chấp thuận, không coi `onSuccess` là bằng chứng thanh toán. `OrderController` đặt `@PreAuthorize("isAuthenticated()")` ở lớp, còn `SecurityConfiguration` kết thúc bằng `denyAll`: controller webhook riêng và matcher POST công khai là phù hợp. V15 chỉ cấp quyền khi giao dịch chuyển sang `SUCCEEDED`, đồng thời đánh cờ khi đã PAID hoặc đã có quyền.

2. **Thiếu — tạo link không đảm bảo duy nhất ở payOS.** `OrderService.create` và `detail` hiện đều `@Transactional`; `create` còn giữ khóa người mua và khóa advisory hoa hồng đến commit. Tách phải có ranh giới transaction thực sự qua bean/proxy hoặc cơ chế tương đương: commit đơn và dòng PENDING trước HTTP, snapshot dữ liệu trong transaction ngắn, gọi HTTP không transaction, sau đó lưu/đọc lại trong transaction mới; cả nhánh trả đơn PENDING cũ và `detail` phải theo cùng quy tắc. Hai request cùng GET thấy chưa có vẫn có thể cùng POST; UPDATE có điều kiện chỉ ngăn ghi đè DB, không ngăn tạo hai link phía ngoài. Mục 9 tài liệu chỉ ghi có lỗi đơn đã tồn tại, không cam kết tính duy nhất/idempotency hoặc kết quả tra cứu tức thời: cần xác minh bảo đảm của payOS hoặc cơ chế điều phối bền vững có phục hồi sau crash/timeout, quy định xử lý POST trùng và GET chưa thấy; khi chưa chứng minh được không khẳng định tuyệt đối một link. Kiểm thử phải điều khiển hai GET cùng trả chưa có, hai request cạnh tranh POST, timeout sau khi payOS tạo link, và kiểm transaction/khóa không còn khi HTTP chạy; chỉ đếm link được lưu chưa đủ.

3. **Thiếu — webhook đến trước link và race ghi link.** Với hai cột link, webhook sớm chỉ có `paymentLinkId` còn `checkoutUrl` chưa có; update “chưa có link” có thể bỏ luôn URL do POST vừa trả. Đồng thời webhook có thể làm đơn PAID trước khi response tạo link được lưu, hoặc GET/POST trả ID khác ID webhook. Cần quy định lưu/hoàn thiện hai trường độc lập, so khớp ID dưới khóa đơn, không ghi đè hay trả URL sai, đọc lại trạng thái sau HTTP và thứ tự xử lý khi ID khác; không cấp quyền cho thông điệp thiếu/sai ID theo chính sách đã định. Kiểm thử webhook chen giữa POST và lưu kết quả, kể cả ID khớp và khác, và xác nhận response cuối cùng đúng trạng thái.

4. **Thiếu — hợp đồng xác thực và idempotency webhook/tra cứu.** Mục 9 nói chữ ký chỉ bao `data`, kể cả null và object/mảng lồng nhau; `success`/`code` ngoài `data` không được chữ ký bảo vệ. Cần quy định kiểm `data.code`, các trường bắt buộc, kiểu/giới hạn và tham chiếu giao dịch không rỗng trước khi ghi, canonicalization đầy đủ, so sánh thời gian hằng; không dùng riêng trường ngoài chữ ký làm căn cứ cấp quyền. Payload mẫu hợp lệ phải trả 2xx sau kiểm chữ ký, chữ ký sai không đổi DB. `uq_payment_transactions_provider_reference` ở V1 là unique một phần, cho phép nhiều NULL và bao cả FAILED; `OrderService.confirm` phân biệt reference cùng đơn với reference thuộc đơn khác. Spec “trùng mã không làm gì” chưa phân biệt cùng đơn/cùng dữ liệu với xung đột khác đơn hoặc khác số tiền; cần quy định không cấp quyền và cách ghi nhận xung đột, xử lý unique violation qua transaction rollback an toàn, không tiếp tục dùng transaction PostgreSQL đã lỗi. Thêm ca webhook thiếu reference, trùng khác đơn/khác dữ liệu và webhook + lookup cùng reference; không chỉ kiểm số enrollment.

5. **Sai — dòng FAILED sai tiền/tiền tệ không ghi được theo schema hiện tại.** V1 `validate_payment_transaction()` so `NEW.amount` và `NEW.currency` với đơn cho *mọi* status; CHECK `ck_payment_transactions_currency` chỉ cho VND. Vì vậy chèn FAILED với số tiền thực lệch hoặc ngoại tệ sẽ bị rollback; V18 hiện chỉ thêm cột link và đổi CHECK nguồn. Cần thiết kế migration V18 cho dữ liệu bất thường mà vẫn bảo vệ mọi dòng SUCCEEDED, giữ giá trị thực và tiền tệ thực, không làm suy yếu MANUAL; chốt cả xử lý số âm/giá trị không hợp lệ theo ràng buộc V1. Test migration và webhook cho sai tiền, sai tiền tệ, và kiểm không thể cấp quyền bằng giao dịch SUCCEEDED sai tiền/tệ.

6. **Sai/Thiếu — đối chiếu khoản FAILED chưa giữ được chống đóng cờ cũ.** `OrderRepository.findPayments` chỉ lấy SUCCEEDED; `OrderService.reconcile` so số dòng đó với `paymentCount`; `OrderController.reconcile` còn yêu cầu count ≥ 1. `AdminOrderResponse.Payment` hiện không có status/lý do, còn `AdminOrdersPage` gửi `order.payments.length`. Nếu thêm FAILED vào danh sách thì frontend gửi sai count; nếu giữ count SUCCEEDED, cờ chỉ có FAILED không thể đóng (count 0), và một FAILED mới đến sau lúc Admin xem không làm count đổi nên request cũ có thể đóng mất cờ mới. Cần hợp đồng phiên bản/snapshot đối chiếu bao gồm mọi bất thường đã xem, hoặc giải pháp tương đương; làm rõ thay đổi API, cách trả khoản FAILED và giữ tương thích MANUAL, trạng thái PENDING/EXPIRED có cờ cũng phải mở được Sheet và đóng cờ. Test đóng cờ chỉ có FAILED và ca FAILED mới đến giữa xem và đóng, cùng regression MANUAL.

7. **Thiếu — tra cứu nhiều khoản và mất webhook.** Mục 9 chỉ xác nhận lookup có `status`, `amountPaid`, `transactions`, chưa xác minh mỗi phần tử cung cấp đủ currency, link ID và reference theo cùng nghĩa webhook. Quy tắc `status = PAID` mới duyệt từng transaction, nhưng lại so *từng khoản* với tổng đơn: nhiều khoản cộng lại đủ có thể bị coi toàn bộ là sai tiền; nếu status chưa PAID, khoản sai/thiếu tiền bị bỏ qua dù bảng nói phải ghi cờ. Task 2 chỉ tự sync khi PENDING, trong khi `detail` gọi `expireOverdue`: người đã trả nhưng webhook lỡ, trở lại sau hạn có thể chỉ thấy EXPIRED và nút mua lại, không kích hoạt dự phòng. Cần xác minh cấu trúc/ý nghĩa dữ liệu lookup, chốt chính sách khoản lẻ, tổng đã trả, ID và dữ liệu thiếu, đối chiếu cùng một khoản giữa hai nguồn, và đường học viên kiểm tra đơn EXPIRED khi webhook lỡ. Test các ca tương ứng bằng dữ liệu hợp đồng đã xác minh; không suy ra khả năng API từ status PAID.

8. **Sai/Thiếu — 12 chữ số chưa chứng minh an toàn cho payOS.** V14 chỉ tạo sequence mặc định; `OrderRepository.insertOrder` dùng `lpad(nextval(...)::text, 12, '0')`, PostgreSQL cắt chuỗi dài hơn 12 ký tự, nên sequence không bảo đảm mã mãi duy nhất sau giới hạn 12 chữ số. Mục 9 còn ghi payOS chưa công bố khoảng `orderCode`: 12 chữ số không chứng minh nhà cung cấp chấp nhận, dù nằm trong `long` Java và vùng số nguyên chính xác của JavaScript. Cần xác minh giới hạn thực tế trước khi chốt, ràng buộc/kiểm tra tràn rõ ràng, không cắt âm thầm và xử lý lỗi; test biên cùng ánh xạ một-một. `description` chỉ lấy 7 số cuối nên không duy nhất; không dùng nó làm khóa đối chiếu.

9. **Thiếu — trạng thái, lỗi và cấu hình.** Ràng buộc nói đủ ba khóa là PAYOS, nhưng bảng 1a yêu cầu thêm `return-base-url`; cần một quy tắc thống nhất và validation URL. `OrderRepository.expireOverdue` đổi cả dòng PENDING thành EXPIRED, nên xác nhận muộn phải tìm được dòng EXPIRED như `confirmOpenPayment` hiện tại. Bảng 1b chưa chốt xử lý CANCELLED/FAILED, dữ liệu lookup thiếu/sai hoặc nhiều transaction, ID đã gắn đơn khác, và lỗi Redis của `checkRate` (`PAYMENT_UNAVAILABLE`); cần mã HTTP và test phù hợp. UI tự sync vài lần dùng chung ngân sách mặc định 5 request/phút với tạo đơn/báo chuyển khoản (`OrderService.checkRate`): chốt số lần/khoảng cách và cách hiển thị 429 để không tự khóa nút của người dùng.

10. **Thiếu — đường dẫn và kiểm chứng.** Danh sách chỉ cho `server/src/test/.../course/**` nhưng lại yêu cầu sửa mọi test khẳng định Flyway mới nhất mà không liệt kê đường dẫn cụ thể ngoài thư mục đó; `plans/author-payout.md` đã nêu `article/ArticlePublicationMigrationTest` có thể liên quan. Bản hiện tại của test article chỉ kiểm ≥ 11 nên chưa chứng minh cần sửa; cần kiểm lại sau V17 và liệt kê chính xác file thực sự phải sửa, không mở rộng suy đoán. Nếu tách transaction/client/DTO mới có tên không chứa `Order`, `Payment` hay `Payos`, glob Java hiện tại cũng không cho phép; chốt tên hoặc bổ sung đường dẫn. Các test Task 1b còn thiếu ca sai tiền tệ, sai mã link, Admin không phải ADMIN, 429, lỗi DB, cấu hình thiếu và trạng thái không cho phép trong bảng; thêm đúng các ca bắt lỗi cụ thể, ưu tiên unit/@WebMvcTest, giữ test DB thật cho các race/trigger, không nhân ma trận tích hợp.

11. **Thừa/mâu thuẫn — smoke test thực tế.** Task 2 yêu cầu “một giao dịch 10.000 đồng” nhưng lại đòi vừa webhook tới vừa tắt ngrok rồi trả để lookup cập nhật: đó là hai tình huống thanh toán riêng, không thể chứng minh cả hai bằng cùng một lần trả nếu không chủ động chặn webhook trước khi giao dịch. Tài liệu mục 9 chưa công bố giới hạn số tiền; 10.000 đồng cũng chưa được xác minh là hợp lệ. Chốt một kịch bản thật khả thi hoặc ghi rõ cần hai giao dịch sau khi xác minh giới hạn; không mặc định tiêu tiền khi chưa có tài khoản/điều kiện.

### Đề xuất ngoài spec (không chặn chốt)

- Không có đề xuất ngoài spec; các điểm trên phục vụ yêu cầu và quyết định đã có.

## Trả lời vòng 1 (Claude)

Đã viết lại thân spec theo các ý chấp nhận (2026-11-16). Thay đổi lớn nhất: **tra cứu là nguồn sự thật duy nhất**, webhook chỉ là tín hiệu có chữ ký để server đi tra cứu; một dòng SUCCEEDED cho mỗi đơn, khóa bằng mã link. Thiết kế này gỡ cùng lúc các ý 3–7.

1. **Đúng — ghi nhận.**
2. **Chấp nhận.** Tách transaction bằng `TransactionTemplate`, áp cho cả `create`, nhánh đơn cũ và `detail`; thêm `payos_link_requested_at` để một request giành quyền xin link, quá 30 giây thì request khác giành lại và luôn tra cứu trước khi tạo; lỗi “đơn đã tồn tại” → tra cứu lại. Không còn khẳng định tuyệt đối: ghi rõ tính duy nhất theo `orderCode` của payOS chưa xác minh. Test điều khiển hai request ở bước tra cứu và kiểm không còn khóa khi HTTP chạy.
3. **Chấp nhận.** Bỏ cột `checkoutUrl`: chỉ lưu mã link, URL dựng từ mã link (dạng thư viện nhúng yêu cầu), nên không còn hai trường lệch nhau. Mã link đến từ tra cứu, so với mã đã lưu dưới khóa đơn; khác thì không đổi DB.
4. **Chấp nhận, đổi thiết kế.** Webhook chỉ dùng `data.orderCode` sau khi chữ ký đúng; `success`/`code`/số tiền không dùng để quyết định. Khóa idempotent là mã link nên không còn ca “trùng reference khác đơn”; request sau khóa xong đọc lại đơn thay vì bắt lỗi UNIQUE trong transaction đang dùng.
5. **Chấp nhận** (đã kiểm `validate_payment_transaction` ở V1: so `amount`/`currency` với đơn cho mọi status). Không ghi dòng FAILED nữa; số payOS báo đã nhận lưu ở `orders.payos_amount_paid`, chỉ để hiển thị.
6. **Chấp nhận bằng cách bỏ nguyên nhân.** Trả thiếu/thừa không bật cờ đối chiếu nên `findPayments`, `reconcile`, `paymentCount` và `AdminOrdersPage` giữ nguyên hợp đồng. Cờ chỉ bật qua trigger V15 như hiện tại (đã có quyền qua đơn khác).
7. **Chấp nhận.** Quyết định theo `status` + `amountPaid` + `amount` + `id` của tra cứu (các trường tài liệu có ghi), không so từng khoản; trả thiếu được lưu và hiển thị, trả nốt thì PAID. Đơn EXPIRED của PAYOS đồng bộ được và trang đơn tự gọi một lần. Cấu trúc `transactions` không còn được dùng.
8. **Một phần.** Chấp nhận: V18 đặt `MAXVALUE` cho sequence, có test tràn; `description` không dùng để đối chiếu. Chưa làm được: giới hạn `orderCode` của payOS không có trong tài liệu — ghi là chưa xác minh, kiểm ở giao dịch thật.
9. **Chấp nhận.** Một quy tắc bật payOS (bốn cấu hình, URL hợp lệ); dòng EXPIRED được tìm như `confirmOpenPayment`; có dòng cho CANCELLED/FAILED; đồng bộ của học viên có giới hạn riêng 10 lần/phút, giao diện tự thử tối đa 3 lần và dừng khi 429.
10. **Một phần.** Chấp nhận: nêu tên hai lớp mới, bổ sung ca còn thiếu ở mức unit. Từ chối liệt kê trước file test Flyway ngoài `course/**`: chỉ biết sau V17, nên quy định grep đầu Task 1a rồi ghi log.
11. **Chấp nhận.** Thử thật thành hai giao dịch, chỉ khi có tài khoản và người dùng đồng ý; số tiền theo mức payOS chấp nhận.

**Điểm yếu còn lại của spec:** (1) mọi xác nhận phụ thuộc API tra cứu của payOS — payOS chậm thì đơn chậm cập nhật dù webhook đã tới; (2) tính duy nhất theo `orderCode`, khoảng `orderCode`, số tiền tối thiểu và việc link còn nhận phần thiếu sau khi trả một phần đều chưa xác minh với payOS thật; (3) không kiểm chữ ký của response tra cứu, tin vào TLS và khóa API; (4) URL thanh toán dựng theo mẫu của thư viện nhúng, payOS đổi mẫu thì hỏng; (5) trả thiếu rồi bỏ: tiền nằm ở tài khoản sàn, hệ thống chỉ hiển thị, Admin xử lý ngoài; (6) thư viện nhúng chưa chạy thử với React của dự án.

## Phản hồi vòng 2 (Codex)

1. **Sai — route đồng bộ của học viên bị `denyAll`.** `SecurityConfiguration` hiện chỉ cho POST `/api/v1/orders` và `/api/v1/orders/*/transfer-report`, sau đó kết thúc bằng `anyRequest().denyAll()`. Task 1b nói matcher POST webhook phải khai nhưng không yêu cầu thêm matcher đã đăng nhập cho POST `/api/v1/orders/*/sync`; route này vì thế không thể hoạt động nếu chỉ làm theo kế hoạch. Cần chỉ rõ matcher đó và kiểm chủ đơn gọi được, người chưa đăng nhập bị chặn; route Admin đã nằm dưới `/api/v1/admin/**` và vẫn cần kiểm role.

2. **Sai — quyền xin link hết hạn sau 30 giây không bảo đảm chỉ một request gọi payOS.** Request A giành quyền rồi bị chậm ở GET hoặc POST quá 30 giây; B giành lại, GET chưa thấy link và POST; sau đó A tiếp tục POST. Bảng 1a vẫn khẳng định chỉ một request gọi payOS, còn test chỉ giữ hai request trong khoảng quyền chưa hết hạn. Điều này có thể tạo hai link nhận tiền khi tính duy nhất/idempotency và độ nhất quán tra cứu của payOS chưa được xác minh. Cần chốt bảo đảm từ payOS hoặc cơ chế bảo vệ thực sự cả request cũ còn chạy và phục hồi sau timeout/crash; không coi timestamp hết hạn là hủy request cũ. Test phải điều khiển A qua mốc 30 giây, B tiếp quản khi GET chưa thấy và A tiếp tục, kể cả timeout sau POST.

3. **Thiếu — ghi mã link và xử lý xung đột giữa các đơn chưa an toàn.** Task 1a chỉ lưu kết quả xin link nếu cột còn NULL; trong lúc HTTP đang chạy, webhook/sync có thể đã lưu ID khác và xác nhận đơn. Không có quy tắc kiểm ID dưới khóa và đọc lại trạng thái trước khi trả response, nên kết quả tạo link bất đồng có thể bị bỏ qua mà người mua vẫn nhận link khác. Ngoài ra `orders.payos_payment_link_id` UNIQUE và index V1 `uq_payment_transactions_provider_reference` đều có thể xung đột khi ID tra cứu đã thuộc đơn khác; khóa người mua và đơn chỉ tuần tự hóa cùng một đơn/người mua, không giải quyết hai đơn khác người. Cần quy định đối chiếu kết quả HTTP với ID hiện tại và quyền sở hữu ID, không ghi đè/không cấp quyền khi xung đột, xử lý race UNIQUE sau rollback an toàn; test webhook chen giữa POST và lưu với ID khớp/khác, và hai đơn khác người cùng nhận một ID.

4. **Thiếu — phản hồi tra cứu cũ có thể ghi đè số tiền mới.** Các lần GET chạy ngoài transaction và có thể hoàn tất ngược thứ tự; khóa đơn chỉ tuần tự hóa lúc ghi. Ví dụ lookup A thấy trả thiếu rồi chậm, lookup B thấy trả nốt và ghi PAID cùng `amountPaid` đủ; A đến sau vẫn khớp dòng trả thiếu, trong khi quy tắc dừng khi PAID chỉ nói cho kết quả đủ tiền. Tương tự hai kết quả trả thiếu có thể làm số đã nhận giảm. Cần chốt cách loại kết quả cũ hoặc quy tắc cập nhật không làm lùi số đã nhận/trạng thái, kiểm lại trạng thái sau khóa, và test trả kết quả theo thứ tự ngược. Không thay đổi chính sách không bật cờ đối chiếu cho thiếu/thừa.

5. **Thiếu — webhook công khai cho phép phát lại vô hạn để gọi API payOS.** Chữ ký chứng minh payload đã được ký, không chứng minh request là mới: bản webhook hợp lệ bị lộ hoặc gửi lặp có thể được phát lại liên tục, mỗi lần đều gọi tra cứu; giới hạn 10 lần/phút chỉ áp dụng cho học viên. Với endpoint `permitAll`, điều này có thể làm cạn tài nguyên/rate limit payOS và khiến các đơn thật chậm hoặc kẹt. Cần giới hạn kích thước/độ phức tạp payload trước xử lý và cơ chế giới hạn hoặc gộp các lần tra cứu webhook theo đơn, có phục hồi khi tra cứu lỗi và không làm mất tín hiệu thanh toán; test phát lại đồng thời và trường hợp lỗi rồi thử lại.

Đã kiểm riêng: nguồn xác nhận qua tra cứu; webhook chỉ kích hoạt tra cứu; dòng PAYOS PENDING/EXPIRED chuyển SUCCEEDED theo V1/V15; lưu thiếu/thừa ở đơn không thêm dòng sai tiền hay đổi hợp đồng đối chiếu; ngân sách đồng bộ học viên tách khỏi `OrderService.checkRate`; đối chiếu `OrderRepository` và `SecurityConfiguration`. Các điểm trên còn chặn chốt.

## Trả lời vòng 2 (Claude)

Đã sửa thân spec (2026-11-16). Hết hai vòng; người dùng quyết.

1. **Chấp nhận.** Đã kiểm `SecurityConfiguration`: chỉ có `POST /orders` và `/orders/*/transfer-report`. Thêm matcher cho `POST /orders/*/sync` vào bẫy và ca test (chủ đơn gọi được, không token → 401).
2. **Chấp nhận.** Bỏ câu khẳng định “chỉ một request gọi payOS”. Mỗi lời gọi payOS timeout 10 giây, một lượt tối đa ba lời gọi (30 giây), quyền xin link chỉ giành lại được sau 60 giây nên request cũ đã dừng. Chốt chặn cuối là payOS từ chối trùng số đơn — vẫn chưa xác minh, ghi rõ phải kiểm ở lần thử thật và dừng nếu payOS không chặn.
3. **Chấp nhận.** Lưu mã link dưới khóa đơn sau khi đọc lại; khác mã đã lưu hoặc mã thuộc đơn khác thì không ghi đè, không cấp quyền; response dựng từ trạng thái đọc lại. Thêm ca test chen giữa và ca trùng mã giữa hai đơn.
4. **Chấp nhận.** Luật “không lùi trạng thái” ở Ràng buộc: PAID không quay lại, `amountPaid` chỉ tăng, mã link không bị ghi đè; test kết quả về ngược thứ tự.
5. **Chấp nhận.** Body tối đa 16 KB; đơn đã PAID không gọi payOS; đơn chưa PAID tối đa một lần tra cứu mỗi 3 giây qua webhook, vượt thì 503 để không báo sai là đã xử lý; đồng bộ của học viên và Admin vẫn là đường phục hồi.

**Điểm yếu còn lại của spec:** như vòng 1, cộng: (7) giới hạn webhook theo đơn dùng bộ giới hạn tần suất hiện có (Redis) — Redis lỗi thì webhook trả lỗi và đơn chờ đồng bộ tay; (8) nếu payOS thật không từ chối trùng số đơn thì phải thiết kế lại bước xin link trước khi bật.

## Quyết định của người dùng

- (2026-11-16) Mở lại payOS; khung thanh toán nhúng (embedded) trên trang đơn; webhook qua ngrok khi chạy máy cá nhân; thêm tra cứu payOS làm dự phòng khi webhook lỡ; có cổng wireframe trước giao diện; làm sau `author-payout`.
