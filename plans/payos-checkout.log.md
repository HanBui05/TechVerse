# PayOS checkout — nhật ký

## Bắt đầu từ đây (cập nhật 2026-11-16)

- **Task tiếp:** cuối module — nhờ Codex đồng bộ spec (skill `codex-workflow` mục 3) · Giao diện: Không
- Task 1a, 1b đã nhận (2026-11-16), Task 2 đã nhận (2026-11-17); commit cục bộ trên nhánh `feature/payos-checkout` (tách từ `feature/author-payout`).
- payOS thật đã thử (2026-11-16): webhook + thanh toán 10.000 ₫ → PAID tự động. Còn chưa kiểm: payOS có từ chối tạo trùng số đơn không (quyết định 5 của spec; backend đã giành quyền xin link nên rủi ro thấp). Khóa dev `a1cdd5a1…` đã trả giá 350.000.
- Task 2: kiểm thêm 2026-11-17 đạt (Sheet Admin mobile sáng/tối, khung payOS link thật chưa trả, giao dịch 2 không ngrok → PAID qua đồng bộ). Webhook payOS chưa đăng ký lại (lệnh bị chặn quyền); ngrok đã tắt.

## Quyết định người dùng chưa có trong spec

- 2026-11-16: duyệt wireframe payOS (mục 8); hạn 15 phút hiện **đồng hồ đếm ngược theo giây**, về 0 thì ẩn khung và sync một lần (8-1). Nhãn chờ đơn PAYOS “Chờ thanh toán”; ẩn khung sau `onSuccess`; mobile link payOS là nút full width; Admin không lọc nguồn.

## Câu hỏi mở cho người dùng

- (không có)

## Task 1a — Kết quả

- Mới: `V18__payos_checkout.sql`, `PayosClient` (tra cứu/tạo link, ký HMAC, cắt mỗi lời gọi ở 10 giây bằng `sendAsync().get(timeout)` + hủy), `PayosClientTest` (6), `PayosIntegrationTest` (5). Sửa: `CourseOrder` (2 cột + `provider` bằng `@Formula` từ dòng giao dịch), `OrderRepository` (`insertOrder` theo phút, `insertTransaction(provider)`, `claimPayosLink`, `savePayosLink`), `OrderService` (`create`/`detail` bỏ `@Transactional`, dùng `TransactionTemplate`; `withPayosLink`; báo chuyển khoản đơn PAYOS → 409), `OrderResponse` (+`provider`, `checkoutUrl`, `amountPaid`), `application.yaml`, `.env.example`, `CoursePaymentMigrationTest` (+1 ca), `OrderServiceTest` (constructor).
- Kiểm: `./gradlew test --tests PayosClientTest --tests PayosIntegrationTest --tests CoursePaymentMigrationTest --tests OrderServiceTest --tests OrderIntegrationTest --tests PaymentConfirmationIntegrationTest --tests AuthorPayoutIntegrationTest` → 73/73 đạt. Grep đầu task: không test nào khẳng định phiên bản Flyway mới nhất.
- **Lệch khác spec:** (1) ca “payOS bật/tắt theo từng cấu hình thiếu, URL sai dạng” nằm ở `PayosClientTest` (cấu hình thuộc `PayosClient`), không ở `OrderServiceTest`. (2) “lời gọi payOS bị cắt ở 10 giây” kiểm ở `PayosClientTest` (mặc định 10 giây + cắt thật với timeout 50 ms), không chờ 10 giây trong test tích hợp. (3) Tra cứu: HTTP 200 với `code` ≠ `"00"` coi là “chưa có link”; tạo bị từ chối với **mọi** mã lỗi (không chỉ “đơn đã tồn tại”, vì mã chưa xác minh) → tra cứu lại, vẫn không có thì lỗi. (4) `PayosIntegrationTest` có `@MockitoSpyBean PayosClient` riêng → thêm một Spring context (đặt ở lớp cơ sở sẽ tách context khỏi `AuthorArticleIntegrationTest`, ngoài phạm vi). (5) Kiểm chữ ký webhook để Task 1b.
- Bẫy: open-in-view giữ một EntityManager suốt request → hai câu cập nhật native mới phải `clearAutomatically`, nếu không lần đọc lại trả entity cũ (không có link).

## Task 1b — Kết quả

- Mới: `PayosWebhookController` (đọc tối đa 16 KB + 1 byte, kiểm chữ ký trước mọi việc). Sửa: `PayosClient` (`lookup` → `Payment`, `find` dùng lại `lookup`, `webhookOrderNo` kiểm chữ ký), `OrderService` (`sync`/`adminSync`/`webhook`, `decide` = bảng quy tắc, `applyPayos` khóa người mua → đơn như `confirm`, đọc lại sau khóa), `OrderRepository` (`findPayosOrder` scalar, `recordPayosAmountPaid` chỉ tăng, `confirmPayosPayment`), `OrderController` (2 route sync), `AdminOrderResponse` (+`provider`, `amountPaid`), `ErrorCode` (+`PAYMENT_WEBHOOK_INVALID`, `PAYMENT_PROVIDER_UNAVAILABLE`), `SecurityConfiguration`, `docs/RUNBOOK.md` (mục payOS).
- Kiểm (TDD): đỏ = lỗi biên dịch API mới; `PayosClientTest` 8/8, `OrderServiceTest` 9/9, `PayosIntegrationTest` 11/11 (một lần đỏ do dữ liệu test: ADMIN_GRANT phải do ADMIN cấp). Lượt cuối `./gradlew test --tests PayosClientTest --tests PayosIntegrationTest --tests OrderServiceTest --tests OrderIntegrationTest --tests PaymentConfirmationIntegrationTest --tests AuthorPayoutIntegrationTest --tests CoursePaymentMigrationTest` → 82/82 đạt. payOS thật (2026-11-16): đăng ký webhook qua ngrok → payload mẫu của payOS nhận 200 (chữ ký thật khớp). Thanh toán thật đơn `TV000000000002` 10.000 ₫ (khóa dev hạ giá tạm): payOS nhận tạo link với `orderCode` = 2, 10.000 ₫ (mức tối thiểu của sàn); webhook → tra cứu → PAID sau vài giây không cần sync; tra cứu có `amountPaid` = 10000; dòng SUCCEEDED mang mã link, nguồn PAYOS, 1 enrollment. Chưa kiểm: payOS có chặn tạo trùng số đơn không.
- **Lệch khác spec:** (1) Chặn dồn webhook 3 giây bằng Redis `SET NX`; Redis lỗi → 503. (2) Đồng bộ khi payOS đã tắt cấu hình, hoặc tra cứu trả `code` ≠ `"00"` (gồm cả “không biết đơn”, vì mã not-found chưa xác minh) → 503 `PAYMENT_PROVIDER_UNAVAILABLE`, không đổi DB. (3) Cấp quyền cần cả `status = PAID` lẫn `amountPaid ≥ amount` (trả thừa cũng vậy). (4) `amountPaid` thiếu trong kết quả tra cứu → coi là thiếu trường (bỏ qua, log). (5) Mã link trong tra cứu đang thuộc đơn khác → không đổi DB, log. (6) Ca “hai kết quả về ngược thứ tự” kiểm tuần tự (đủ rồi thiếu); ca hai webhook song song: webhook thứ hai bị chặn 503 trừ khi tới sau khi đơn PAID.

## Task 2 — Kết quả

- Thư viện: `@payos/payos-checkout` 1.0.9 (CJS, `usePayOS` không phải hook thật, chỉ dựng iframe + nghe `postMessage` từ `pay.payos.vn`) → gọi trong `useLayoutEffect` (cleanup chạy khi phần tử còn trong DOM, `exit()` cần vậy). Dựng thử với React của `app/` **chạy được**: link thật của đơn đã trả `TV…002` → payOS gửi PAID → `onSuccess` → trang chuyển “Đang kiểm tra thanh toán…”.
- Sửa: `types/courses.ts` (+`provider`, `checkoutUrl`, `amountPaid`), `courseService` (`orders.sync`, `adminOrders.sync`, `payosSrc`), `courseI18n` (+`PAYMENT_PROVIDER_UNAVAILABLE`, copy mục 8), `OrdersPage` (`statusKey`, nút “Thanh toán ›”), `OrderDetailPage` (`PayosFrame`, đồng bộ khi mở, tự thử 3/6/12 giây, 429 khóa 30 giây, đếm ngược theo giây, về 0 ẩn khung + sync), `AdminOrdersPage` (badge nguồn, “payOS đã nhận”, Sheet chỉ xem + “Kiểm tra với payOS”, giữ Sheet khi đơn rời bộ lọc).
- Kiểm: TDD đỏ 21 ca (thiếu tính năng), 2 lỗi test tự sửa (bắt `<li>` skeleton; stub trả sai đơn cho `…/124/sync`). Cuối: `npx vitest run Payments.test.tsx AdminOrders.test.tsx courseService.test.ts courseI18n.test.ts` → 181/181 đạt; `npm run build` đạt.
- Kiểm mắt (Playwright MCP): Sheet Admin desktop dark với backend thật (sync đơn PAID → “Đã ghi nhận thanh toán.”); trang đơn (API giả qua `page.route`) desktop dark khung 478×520 nền trắng, mobile 390 cảm ứng dark khung 331×520, hai nút 333×44 không tràn, không cuộn ngang; light đo JS: card `#f9fafb`, khung trắng. Chưa kiểm: Sheet Admin mobile/light, `/me/orders` bằng mắt.
- **Lệch khác spec/wireframe:** (1) Link payOS là nút viền (outline) ở cả desktop, không phải link chữ. (2) Bấm “Kiểm tra lại” giữ khung, chỉ hiện “Đang kiểm tra thanh toán…” cạnh nút (không thay khung để khỏi tải lại iframe). (3) Lỗi 503/khác trong chuỗi tự thử sau `onSuccess` vẫn tính là “chưa thấy tiền” và thử tiếp; chỉ 429 dừng. (4) Sheet Admin không thêm nút [Đóng] riêng (đã có ✕). (5) `ORDER_RATE_LIMITED`/`ORDER_NOT_FOUND` giữ câu cũ (khác dấu câu với bảng spec) để không đổi màn khác. (6) Khung cao cố định 520 px.

## Nhật ký phiên
### 2026-11-17 — Task 2 đã nhận
- Người dùng nhận Task 2 (2026-11-17); commit cục bộ.
### 2026-11-17 — Task 2 kiểm thêm + giao dịch thật 2
- Ngrok `mule-outpost-calibrate.ngrok-free.dev` → `localhost:8080`, POST `{}` qua ngrok → 400 đúng. Đăng ký lại webhook bằng script bị Cloudflare 1010 rồi bị chặn quyền → chưa làm.
- Sheet Admin mobile 390 cảm ứng sáng + tối (backend thật): toàn màn hình, không cuộn ngang, nút 44 px, badge đúng tone.
- Đơn thật `TV000000000003` (`lan.author`, giá khóa hạ tạm 10.000 rồi trả 350.000 ngay): khung payOS thật hiện QR + tab Chuyển khoản trên nền trắng (dark). Sync tự động lúc mở trang → 503 (có lẽ payOS chưa tra được link vừa tạo; im lặng đúng thiết kế); bấm Kiểm tra lại → 200.
- Giao dịch 2: người dùng tắt ngrok rồi trả 10.000 ₫ → đơn PAID 13:42:44, dòng SUCCEEDED mã link `5b29dd1e…`, nguồn PAYOS, 1 enrollment; không có webhook nên cập nhật là qua sync. Không xác định được trang kiểm thử có nhận `onSuccess` không (trình duyệt Playwright bị đặt lại).
### 2026-11-16 — Task 2 Codex vòng 2
- Vòng 2: 1 medium — bấm “Kiểm tra lại” giữa hai lượt tự thử mà nhận 429 thì timer bị hủy nhưng `afterPay` kẹt ở `checking`. Đúng trên code. Người dùng cho sửa (2026-11-17): 429 chuyển `checking` → `unseen`; thêm 1 ca, đỏ rồi xanh. Lượt lại 4 file test → 184/184 đạt; build đạt.
### 2026-11-16 — Task 2 Codex vòng 1 + sửa
- Vòng 1 (`adversarial-review`): 2 high (sync chồng nhau → 429 không chặn lượt hẹn sau; PAID bị bỏ khi request mới hơn lỗi), 1 medium (thư viện gọi `onExit` cả khi iframe báo lỗi → dựng lại vô hạn). Cả ba đúng. Sửa `OrderDetailPage`: sync xếp hàng (`queue`), cờ `limited` chặn sync tự động/lượt hẹn trong 30 giây; khung dựng lại tối đa 3 lần rồi coi là lỗi. Thêm 2 ca, thấy đỏ rồi xanh.
- Lượt lại: 4 file test → 183/183 đạt; `npm run build` đạt.
### 2026-11-16 — Task 2 code xong
- Code + test + build Task 2 (xem “Task 2 — Kết quả”); chưa commit; chờ Codex review.
### 2026-11-16 — Cổng wireframe payOS
- Thêm mục 8 vào `plans/course-payment.wireframe.md`: trang đơn PAYOS desktop/mobile, bảng 13 trạng thái (gồm 429/503/khung lỗi), `/me/orders`, hàng + Sheet Admin, copy bổ sung, 5 câu chốt. Chỉ tài liệu, kiểm tĩnh. Người dùng duyệt cùng ngày, câu 2 đổi sang đếm ngược.
### 2026-11-16 — Task 1b đã nhận
- Người dùng nhận Task 1b (2026-11-16) sau khi thử thanh toán thật đạt; commit cục bộ. Khóa dev đã trả giá 350.000.

### 2026-11-16 — Người dùng thử webhook qua ngrok: 500
- Không phải lỗi code/payOS/ngrok: ở backend IntelliJ (8080, devtools) **mọi** route `OrderController` (kể cả `GET /admin/commission-policy` cũ) và webhook (body rỗng, sai chữ ký, chữ ký đúng) → 500 như route không tồn tại; `GET /users/me` → 200. `.env` có đủ bốn `PAYOS_*` (lần đầu Claude đọc nhầm là trống). Nguyên nhân khả dĩ: `./gradlew test` của Claude ghi lại `OrderController`/`OrderService`/`PayosClient` lúc 22:09:58–59, devtools khởi động lại giữa chừng → context thiếu các bean đó. Đã ghi vào `docs/RUNBOOK.md`. Người dùng chạy lại backend (22:40:59) → webhook `{}` 400, payload mẫu tự ký 200 qua ngrok; 502 trước đó là lúc backend đang khởi động lại. Người dùng đăng ký webhook trên payOS: payload mẫu 200.
### 2026-11-16 — Task 1b code xong + Codex vòng 1
- Code + test Task 1b (xem “Task 1b — Kết quả”); chưa commit.
- Vòng 1 (`adversarial-review`): 1 high — tra cứu trả `code` ≠ `"00"` bị coi là xong, webhook trả 200 dù chưa tra cứu được. Đúng; `syncPayos` trả 503 khi tra cứu rỗng (`find` của 1a giữ nguyên). Thêm ca trong `syncRoutes…` (sync + webhook → 503). Thấy đỏ (200) rồi xanh; lượt lại 7 lớp → 82/82 đạt. Vòng 2 (chỉ phần sửa): approve, không phát hiện.
### 2026-11-16 — Task 1a đã nhận
- Người dùng nhận Task 1a (2026-11-16); tách nhánh `feature/payos-checkout`, commit cục bộ.

### 2026-11-16 — Task 1a Codex vòng 1 + sửa
- Vòng 1 (`adversarial-review`): 1 phát hiện high — tra cứu nhận link dù `amount` khác tổng đơn. Đúng; sửa `PayosClient.find(orderNo, amount)` đối chiếu số tiền, thêm 2 ca (`amount` khác, thiếu `amount`) vào `PayosClientTest`.
- Kiểm lại: `PayosClientTest` 6/6, `PayosIntegrationTest` 5/5. Vòng 2 (chỉ phần sửa): approve, không phát hiện.
### 2026-11-16 — Task 1a code xong
- Đổi `PLAN.md` sang module này; viết test trước (đỏ vì thiếu `PayosClient`), code tới xanh; chi tiết ở “Task 1a — Kết quả”.
