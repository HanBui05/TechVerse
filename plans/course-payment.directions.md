# Thanh toán khóa học: các hướng làm (tài liệu cho Opus)

Viết 2026-11-13 theo yêu cầu người dùng. Đây **không phải spec** và không thay spec. Mục đích: người dùng chưa có hướng cho phần thanh toán của một đồ án sinh viên; file này đưa các hướng khả thi, một khuyến nghị và khung thiết kế, để (1) người dùng chọn, (2) Codex viết `plans/course-payment.md` theo `_template.md`, (3) Claude phản biện rồi code theo quy trình thường.

## 0. Opus dùng file này thế nào

1. Đọc mục 1–2 để nắm hiện trạng, rồi trình bày cho người dùng **mục 3 (cổng thanh toán) và mục 4 (phạm vi)** dưới dạng ngắn gọn kèm khuyến nghị, và danh sách quyết định ở mục 7. Hỏi bằng văn bản, một lượt.
2. Ghi lựa chọn của người dùng (có ngày) vào mục 8 của chính file này và một dòng ở “Câu hỏi mở” của `PLAN.md`.
3. Trước khi Codex viết spec: xác minh các chi tiết nhà cung cấp ở mục 9 bằng tài liệu chính thức (thông tin trong file này viết từ hiểu biết sẵn có, chưa tra lại tài liệu ngày 2026-11-13) và ghi kết quả vào mục 9.
4. Không tự viết spec, không code trước khi spec chốt. Module này thuộc diện **rủi ro cao** theo `CLAUDE.md` (tiền, xử lý đồng thời, endpoint công khai nhận callback): code bằng Opus, review vòng 1 dùng `adversarial-review`.

## 1. Hiện trạng repo đã đối chiếu (2026-11-13)

Phần này quan trọng vì **schema thanh toán đã có sẵn từ V1** và đã chứa logic bằng trigger; hướng làm tốt nhất là dùng lại nó thay vì thiết kế mới.

| Thứ có sẵn | Chi tiết | Hệ quả cho thiết kế |
|---|---|---|
| `orders` | `order_code` unique, `total_amount`, `status` PENDING/PAID/FAILED/CANCELLED/EXPIRED, `paid_at`, `expires_at`, chỉ VND | Dùng nguyên |
| `order_items` | `course_id`, `course_title_snapshot`, `unit_price_amount`, `commission_policy_id` **NOT NULL**, `commission_rate_bps`, `commission_amount`, `author_net_amount`; unique (order, course) | Phải có ít nhất một dòng `commission_policies` đang active thì mới tạo được đơn |
| Trigger `calculate_order_item_revenue` | Tự tính hoa hồng và phần tác giả nhận từ policy khi insert item | “Đơn hàng snapshot tỷ lệ” có sẵn, không cần code |
| Trigger `enforce_order_total` / `refresh_order_total` | Đơn mới phải có `total_amount = 0`; tổng tự cập nhật khi thêm item | Service tạo order trước (tổng 0) rồi mới insert item; không tự set tổng |
| `payment_transactions` | `provider`, `provider_transaction_id` (unique theo provider), `amount`, `status` PENDING/SUCCEEDED/FAILED/CANCELLED/EXPIRED | Chống xử lý trùng callback ở mức DB |
| Trigger `validate_payment_transaction` | `amount` phải bằng tổng đơn | DB tự chặn sai số tiền |
| Trigger `grant_course_access_after_payment` | Khi transaction chuyển `SUCCEEDED`: đơn thành `PAID` và tự insert `course_enrollments` nguồn `PURCHASE` | **Cấp quyền học đã có sẵn**; service chỉ cần đổi trạng thái transaction trong một transaction DB |
| `course_enrollments` | `source` FREE/ADMIN_GRANT/PURCHASE, unique (user, course) khi chưa revoke | Người đã có enrollment active mà trả tiền lần nữa sẽ làm trigger lỗi unique → phải chặn mua từ trước |
| Trigger `validate_course_enrollment` | FREE chỉ cho khóa `price_amount = 0`; PURCHASE phải khớp order item đã PAID | Khóa trả phí không thể tạo enrollment FREE |
| V12 `ck_courses_free` | `CHECK (price_amount = 0 AND currency = 'VND')` | Migration mới phải thay constraint này |
| `Course` entity | Không map `price_amount`/`currency`; mọi DTO cấm trường tiền (`CourseContractTest` quét) | Thêm giá là đổi hợp đồng có chủ đích; test quét phải sửa cùng |
| `refunds` + 2 trigger | Còn trong schema | Người dùng đã chốt không hoàn tiền (2026-11-06): migration mới xóa |
| Luồng học `course-free` | `POST /courses/{id}/start` tạo FREE enrollment; GET bài thường cũng tạo; bài “Học thử” mở cho Guest | Cần nhánh cho khóa trả phí: chưa mua thì chỉ xem tổng quan + bài học thử |
| Hạ tầng | Redis (rate limit, idempotency receipt đã dùng cho tạo bài/khóa), `SecurityConfiguration` mặc định `denyAll`, không có thư viện cổng thanh toán nào | Callback của cổng phải khai `permitAll` riêng và tự xác thực bằng chữ ký |

Bẫy kỹ thuật đã thấy trước (đưa vào spec):

- `currency` là `char(3)`: `backend.md` ghi Hibernate `validate` hỏng với `@Column(length)` trên `bpchar`. Entity `Order`/`PaymentTransaction` cần map đúng kiểu (hoặc không map cột này vì DB có default và CHECK).
- Trigger chạy trong DB nên entity JPA trong persistence context sẽ cũ sau khi lưu (`total_amount`, `status`, enrollment mới). Đọc lại sau `flush()` hoặc dùng JDBC cho bước xác nhận.
- `ON CONFLICT (order_item_id)` trong trigger cấp quyền không che được unique (user, course).

## 2. Ràng buộc của đồ án sinh viên

- Không có pháp nhân/giấy phép kinh doanh → không đăng ký được tài khoản merchant thật ở hầu hết cổng.
- Không nên dính tiền thật: khó demo trước hội đồng, khó test lặp lại, có rủi ro.
- Demo chạy trên `localhost`; cổng thật gọi callback từ Internet nên cần tunnel hoặc cách thay thế.
- CI và test tự động không được gọi dịch vụ ngoài (đã là nguyên tắc ở `ai-assist`: test không gọi model thật).
- Giá trị của đồ án nằm ở **luồng nghiệp vụ đúng và an toàn** (đơn hàng, chữ ký, chống trùng, cấp quyền), không ở việc thu được tiền.

## 3. Các hướng cho cổng thanh toán

| Hướng | Cách hoạt động | Hợp đồ án | Điểm yếu |
|---|---|---|---|
| **A. Cổng giả lập nội bộ (mock)** | Backend trả URL tới một trang “cổng thanh toán giả” của chính app, có nút Thành công/Thất bại/Hủy; trang đó gọi callback có chữ ký HMAC như cổng thật | Không phụ thuộc bên ngoài, demo offline, test tự động được, làm nhanh nhất | Không chứng minh được tích hợp thật |
| **B. VNPay sandbox** | Tạo URL thanh toán ký HMAC-SHA512, chuyển người dùng sang trang sandbox, trả bằng thẻ test; VNPay gọi IPN và chuyển trình duyệt về return URL | Cổng Việt Nam quen thuộc với hội đồng, đăng ký sandbox miễn phí không cần pháp nhân, tiền ảo, tài liệu nhiều | IPN cần URL công khai (tunnel) hoặc dựa vào return URL; trang sandbox đôi lúc chậm |
| **C. MoMo / ZaloPay sandbox** | Tương tự B: tạo yêu cầu có chữ ký, quét QR bằng app test hoặc trang test, nhận IPN | Cũng miễn phí và là tên tuổi Việt Nam | Luồng thử cần app bản test hoặc tài khoản test, rườm hơn B khi demo trên máy tính |
| **D. Chuyển khoản VietQR + webhook (PayOS, SePay)** | Hiện mã QR ngân hàng với nội dung chứa mã đơn; dịch vụ theo dõi tài khoản và gọi webhook khi tiền về | Giống cách các trang khóa học Việt Nam nhỏ đang bán thật | **Tiền thật**, cần tài khoản ngân hàng thật và xác minh danh tính; không có sandbox đúng nghĩa |
| **E. Stripe test mode** | Checkout Session + webhook; Stripe CLI chuyển tiếp webhook về localhost | Trải nghiệm dev tốt nhất, test mode đầy đủ, không cần tunnel riêng | Không phải cổng Việt Nam; hội đồng có thể hỏi tính thực tế |
| **F. Chuyển khoản thủ công, Admin xác nhận** | Hiện thông tin chuyển khoản; Admin bấm “đã nhận tiền” | Đơn giản nhất | Không có tích hợp, không có bài toán kỹ thuật đáng nói |

### Khuyến nghị: A + B sau một interface chung

Làm một interface `PaymentGateway` (tạo URL thanh toán, xác thực và đọc callback) với hai cài đặt, chọn bằng cấu hình:

- `mock` — mặc định cho dev, test tự động và CI; cũng là phương án dự phòng khi demo mất mạng.
- `vnpay` — sandbox, dùng khi demo để cho thấy tích hợp cổng thật.

Lý do: hai cài đặt không phải trừu tượng thừa — test không thể gọi VNPay nên đằng nào cũng cần một cổng giả; đặt nó sau cùng interface thì mọi logic quan trọng (xác thực chữ ký, đối chiếu số tiền, chống trùng, cấp quyền) chạy chung một đường và được test thật. Nếu thiếu thời gian, làm xong A là đã có luồng hoàn chỉnh; B là một lớp thêm vào sau, không đổi nghiệp vụ.

Không khuyến nghị D (tiền thật), F (không có giá trị kỹ thuật). E là lựa chọn thay B nếu người dùng ưu tiên dễ làm hơn là “cổng Việt Nam”.

## 4. Các hướng cho phạm vi nghiệp vụ

Hướng người dùng nêu trước đây (trong “Câu hỏi mở” của `PLAN.md`, 2026-11-06) khá lớn: đăng ký bán có điều khoản theo phiên bản và Admin duyệt, tỷ lệ hoa hồng riêng theo tác giả/khóa có ngày hiệu lực, sổ tiền, đợt chi trả, nhà cung cấp video có token. Với đồ án, đề nghị chia ba mức và chọn một:

| Mức | Gồm | Bỏ |
|---|---|---|
| **S — Lõi mua khóa học (khuyến nghị)** | Tác giả đã duyệt đặt giá cho khóa; trang tổng quan hiện giá + nút mua; một đơn = một khóa; thanh toán qua cổng; cấp quyền tự động; “Đơn hàng của tôi”; Admin xem danh sách đơn (chỉ đọc); một tỷ lệ hoa hồng chung, snapshot vào đơn nhờ trigger sẵn có; ghi rõ “không hoàn tiền” ở trang mua | Đăng ký bán + điều khoản phiên bản; hoa hồng riêng; doanh thu tác giả; chi trả; giỏ hàng; mã giảm giá; video có token |
| **M — S + phía người bán** | Thêm: trang doanh thu của tác giả (đọc từ `order_items`), Admin đổi tỷ lệ hoa hồng chung (policy mới có ngày hiệu lực), “đăng ký bán” rút gọn (tác giả đồng ý điều khoản một lần, không cần Admin duyệt) | Sổ tiền, chi trả, hoa hồng riêng từng tác giả |
| **L — đúng hướng ban đầu** | Thêm: Admin duyệt đăng ký bán, điều khoản nhiều phiên bản, hoa hồng riêng, sổ tiền và đợt chi trả, video qua nhà cung cấp có token | — |

Khuyến nghị **S**, và tách phần thêm của M thành module `course-commission` làm sau nếu còn thời gian. Lý do: S đã là một lát dọc hoàn chỉnh có thể demo (đặt giá → mua → học), chứa toàn bộ phần khó về kỹ thuật; M và L chủ yếu thêm màn quản trị. S cắt bớt hai điều người dùng từng nêu (đăng ký bán có Admin duyệt; Moderator không thấy giá vẫn giữ được) nên phải được người dùng xác nhận.

### Video của khóa trả phí

`PLAN.md` ghi “không dùng YouTube cho khóa trả phí (link lộ trong mã trang)”. Với đồ án, đề nghị xem lại:

- **Giữ YouTube (khuyến nghị cho mức S):** API bài học đã chỉ trả `videoId` cho người có quyền xem bài, nên người chưa mua không lấy được ID. Rủi ro còn lại là người đã mua chia sẻ link — chấp nhận và ghi thành giới hạn đã biết trong báo cáo.
- **Cloudinary video ký URL:** Cloudinary đã tích hợp sẵn cho ảnh; có thể tải video và phát bằng URL có chữ ký hết hạn. Thêm việc: upload lớn, giới hạn gói miễn phí. Làm sau, module riêng.
- **Bunny/Mux/Cloudflare Stream:** đúng hướng sản phẩm thật nhưng tốn phí và công tích hợp, không hợp đồ án.

## 5. Khung thiết kế cho hướng khuyến nghị (S + mock + VNPay)

Đây là đầu vào cho Codex; tên endpoint/mã lỗi chỉ là đề xuất, spec chốt.

### Luồng

1. Người học bấm “Mua khóa học” → `POST /api/v1/orders {courseId}`. Backend kiểm điều kiện, tạo `orders` (PENDING, hết hạn sau 15 phút), `order_items` (giá lấy từ DB, không nhận từ client), `payment_transactions` (PENDING), trả `{orderCode, paymentUrl}`.
2. Trình duyệt chuyển sang `paymentUrl` (trang VNPay sandbox hoặc trang mock).
3. Cổng gọi **IPN** `GET /api/v1/payments/{provider}/ipn` (không cần đăng nhập, xác thực bằng chữ ký) → backend xác nhận.
4. Cổng chuyển trình duyệt về `WEB_URL/payment/return?...` → frontend gửi nguyên query cho `GET /api/v1/payments/{provider}/return` → backend kiểm chữ ký, trả trạng thái đơn → frontend hiện kết quả và nút “Vào học”.
5. `GET /api/v1/me/orders` (danh sách đơn), `GET /api/v1/orders/{orderCode}` (chi tiết, chỉ chủ đơn), `GET /api/v1/admin/orders` (Admin, chỉ đọc).

### Một hàm xác nhận duy nhất

IPN và return URL đều gọi cùng một hàm `confirm(provider, tham số callback)`:

- Xác thực chữ ký trước mọi việc khác; sai thì từ chối, không đụng DB.
- Tìm transaction theo mã đơn, **khóa dòng** (`SELECT … FOR UPDATE`).
- Đã ở trạng thái cuối → trả kết quả cũ (idempotent; cổng có thể gọi IPN nhiều lần và return URL đến cùng lúc).
- Đối chiếu số tiền callback với `payment_transactions.amount`; lệch thì đánh FAILED và ghi lý do.
- Thành công → cập nhật `status = SUCCEEDED` + `provider_transaction_id`; trigger DB lo phần đơn PAID và enrollment. Thất bại/hủy → FAILED/CANCELLED cho cả transaction và đơn.

Trên localhost cổng thật không gọi được IPN nếu không có tunnel, nên cho phép return URL cũng xác nhận (vẫn qua chữ ký). Trong sản phẩm thật chỉ IPN mới được cập nhật; ghi điều này thành `shortcut:` trong code và trong báo cáo. Muốn demo IPN thật: `cloudflared tunnel --url http://localhost:8080` hoặc ngrok rồi khai URL ở trang quản trị sandbox.

### Điều kiện tạo đơn (bảng “Quy tắc nghiệp vụ và mã lỗi” của spec sẽ chi tiết hóa)

- Khóa đang công khai, có giá > 0; người mua không phải chủ khóa; không mang role ADMIN/MODERATOR (cùng luật chặn enrollment của `course-free`).
- Chưa có enrollment active với khóa đó → nếu có thì 409, không tạo đơn.
- Đã có đơn PENDING chưa hết hạn cho cùng khóa → trả lại đơn đó (không tạo đơn thứ hai). Hai request đồng thời phải ra cùng một đơn: dùng khóa (dòng user, advisory lock, hoặc khóa Redis như các receipt hiện có) — Codex chọn và ghi rõ.
- Đơn hết hạn: đánh EXPIRED **khi đọc/khi tạo đơn mới** (lười), không cần scheduler. Callback thành công đến sau khi hết hạn: đề nghị vẫn chấp nhận (người dùng đã trả tiền) và ghi quyết định này vào spec.

### Giá khóa học

- Giá đặt trên `courses` (bản làm việc), không nằm trong snapshot kiểm duyệt: giữ được quyết định “Moderator không thấy giá”. Đổi giá có hiệu lực ngay; đơn đã tạo giữ giá cũ qua `unit_price_amount`.
- Khóa đã từng công khai thì **không đổi qua lại giữa miễn phí và trả phí** (tránh người đang học miễn phí bị khóa ngoài, và tránh trigger FREE lỗi). Muốn đổi thì tạo khóa mới.
- Khoảng giá: 0 hoặc trong một khoảng do spec chốt theo giới hạn của cổng (xác minh ở mục 9).
- API public trả `price` cho trang danh sách/tổng quan; DTO của Moderator vẫn không có trường tiền (`CourseContractTest` đổi theo đúng phạm vi này).

### Quyền xem bài của khóa trả phí

- Chưa mua: xem tổng quan + bài “Học thử”; bài thường trả 403 với mã riêng (ví dụ `COURSE_PURCHASE_REQUIRED`) để frontend hiện lời mời mua; `POST /courses/{id}/start` từ chối với cùng mã.
- Đã mua (enrollment PURCHASE active): như khóa miễn phí. Tiến độ, “Khóa học của tôi” dùng lại nguyên.

### Migration V13 (dự kiến)

- Thay `ck_courses_free` bằng CHECK khoảng giá hợp lệ.
- Seed một dòng `commission_policies` active (tỷ lệ do người dùng chọn, mục 7).
- Xóa `refunds` + `validate_refund` + `revoke_course_access_after_refund` và trigger (quyết định 2026-11-06), không sửa V1.
- Chỉ thêm cột/index khi spec thật sự cần (ví dụ index `orders(user_id, status)`). Sinh lại `docs/technical/db/final.sql` đến V13.
- Theo D-022: không backfill; DB dev cũ làm mới theo RUNBOOK nếu migration không chạy được.

### Cổng mock

- `paymentUrl` trỏ tới route frontend `/payment/mock?…` hiện mã đơn, số tiền, ba nút. Nút gọi endpoint mock của backend, backend tự ký tham số bằng khóa bí mật rồi đi qua đúng hàm `confirm`.
- Chỉ bật khi cấu hình `provider = mock`; cấu hình khác thì endpoint mock trả 404. Đây là ranh giới bảo mật: nếu mock bật ở môi trường thật thì ai cũng tự “trả tiền” được.

### Bảo mật (đưa thành tiêu chí “Xong khi”)

- Số tiền và giá luôn lấy từ DB; không tin tham số từ client hay từ return URL khi chưa kiểm chữ ký.
- So sánh chữ ký bằng hàm so sánh thời gian hằng (`MessageDigest.isEqual`).
- Khóa bí mật của cổng chỉ ở `.env` phía backend, thêm vào `.env.example` (không giá trị); không log tham số chứa chữ ký/khóa.
- Endpoint callback `permitAll` chỉ đúng hai đường IPN/return; mọi đường khác của đơn hàng cần đăng nhập và kiểm chủ sở hữu (đơn của người khác trả 404).
- Rate limit tạo đơn theo người dùng (dùng cơ chế Redis sẵn có).

### Kiểm thử trong ngân sách

- Unit thuần: dựng và kiểm chữ ký VNPay (dùng vector cố định), ánh xạ mã phản hồi → trạng thái, kiểm điều kiện tạo đơn.
- Tích hợp (Testcontainers, cổng mock): mua thành công → có enrollment PURCHASE; callback trùng hai lần → một enrollment; số tiền lệch → FAILED, không cấp quyền; chữ ký sai → từ chối; đã enroll → 409; chưa mua mở bài thường → 403.
- Đồng thời: ít nhất một ca hai callback song song và một ca hai request tạo đơn song song (`course-free` còn nợ loại test này; ở module tiền thì không nên bỏ).
- Không test nào gọi VNPay thật. Smoke sandbox làm tay một lần, ghi log.

### Tách task gợi ý

| Task | Nội dung | Ghi chú |
|---|---|---|
| 1a | V13, giá khóa (Author đặt giá, API public trả giá), quyền xem bài khóa trả phí | Đổi hợp đồng `course-free` có chủ đích |
| 1b | Order + `PaymentGateway` + mock + hàm `confirm` + “Đơn hàng của tôi” | **Rủi ro cao**: Opus, `adversarial-review` |
| 1c | Cài đặt VNPay sandbox + Admin xem đơn | Có thể hoãn nếu thiếu thời gian |
| Cổng wireframe | Nút mua, trang mock, trang kết quả, danh sách đơn | Như `course-free` |
| 2a | Giao diện giá (form Author, thẻ khóa, trang tổng quan, lời mời mua ở bài bị khóa) | |
| 2b | Trang mock, trang kết quả thanh toán, “Đơn hàng của tôi”, Admin đơn hàng | |

## 6. Rủi ro chính

| Rủi ro | Cách giảm |
|---|---|
| Callback trùng hoặc đến song song làm cấp quyền hai lần / lỗi unique | Khóa dòng transaction, trạng thái cuối là idempotent, test song song |
| Người dùng sửa tham số return URL để tự xác nhận | Kiểm chữ ký phía backend, đối chiếu số tiền với DB |
| Trigger DB và JPA lệch trạng thái | Đọc lại sau flush, hoặc JDBC cho bước xác nhận; test tích hợp kiểm trạng thái từ DB |
| Sandbox VNPay lỗi đúng lúc demo | Cổng mock là phương án dự phòng, đổi bằng một biến cấu hình |
| Phạm vi phình (hoa hồng, chi trả, đăng ký bán) | Chốt mức S, phần còn lại ghi “Ngoài phạm vi” trong spec |
| Cổng mock bị bật ngoài dev | Tắt theo cấu hình + test khẳng định endpoint mock 404 khi provider khác |

## 7. Quyết định cần người dùng chốt (kèm khuyến nghị)

1. Cổng thanh toán: **A + B (mock + VNPay sandbox)**; phương án khác: chỉ A, hoặc A + Stripe test.
2. Phạm vi: **mức S**; M/L tách module sau.
3. Bỏ “đăng ký bán + Admin duyệt” ở module này, mọi tác giả đã duyệt đều đặt được giá: **đồng ý bỏ**.
4. Video khóa trả phí: **giữ YouTube, ghi giới hạn** (thay câu “không dùng YouTube cho khóa trả phí” trong `PLAN.md`).
5. Tỷ lệ hoa hồng chung để seed: đề nghị **20%** (2000 bps); ở mức S con số này chỉ được lưu vào đơn, chưa hiển thị cho ai.
6. Khóa đã công khai không đổi giữa miễn phí và trả phí: **đồng ý**.
7. Thanh toán thành công đến sau khi đơn hết hạn vẫn cấp quyền: **đồng ý**.
8. Trên localhost cho phép return URL xác nhận thanh toán (có kiểm chữ ký): **đồng ý**, ghi là giới hạn.
9. Thời hạn đơn 15 phút, giá tối thiểu/tối đa: theo giới hạn cổng sau khi xác minh mục 9.

## 8. Quyết định của người dùng

- **2026-11-14 (người dùng):** muốn thanh toán được bằng **tiền thật, chỉ qua ngân hàng** (chuyển khoản/quét QR; không tiền mặt). Thay hướng “mock + VNPay sandbox” ở mục 3:
  - **Bước 1 (B1):** tạo đơn có mã riêng → trang thanh toán sinh **VietQR động** cho đúng đơn (số tài khoản của nền tảng, số tiền, nội dung = mã đơn) → Admin đối chiếu sao kê và bấm “Đã nhận tiền” → cấp quyền học (trigger sẵn có).
  - **Bước 2:** tích hợp **PayOS** để tự xác nhận qua webhook (task sau, giữ nguyên đơn hàng/hoa hồng). Test tự động dùng cổng giả lập, không gọi PayOS thật.
  - Hoa hồng: người dùng chưa trả lời riêng → theo khuyến nghị: tỷ lệ chung 20% lưu vào đơn, trang doanh thu của tác giả, Admin đổi tỷ lệ; chi trả cho tác giả tách module sau.
  - Mục 9 (xác minh tài liệu) đổi đối tượng: định dạng VietQR/ảnh QR và API + webhook + chữ ký của PayOS, thay cho VNPay. **Có chia hoa hồng cho nền tảng.** Video khóa trả phí: **dùng YouTube** vì là demo (thay hướng cũ “không dùng YouTube cho khóa trả phí”).

## 9. Đã xác minh bằng tài liệu chính thức (2026-11-14, thay phần VNPay cũ)

Nguồn: `payos.vn/docs/api/`, `payos.vn/docs/tich-hop-webhook/kiem-tra-du-lieu-voi-signature/`, `vietqr.io/danh-sach-api/link-tao-ma-nhanh/`.

**VietQR (bước 1, Admin xác nhận tay)**

- Ảnh QR: `https://img.vietqr.io/image/<BANK_ID>-<ACCOUNT_NO>-<TEMPLATE>.png?amount=<số tiền>&addInfo=<nội dung>&accountName=<tên>`. `BANK_ID` là BIN (vd. `970415`) hoặc tên viết tắt; `ACCOUNT_NO` ≤ 19 ký tự; `amount` số dương ≤ 13 chữ số; `addInfo` ≤ 50 ký tự, không ký tự đặc biệt. Tài liệu không nêu cần API key; giới hạn 10 QR / 10 giây / IP.
- Backend chỉ trả các tham số (BIN, số tài khoản, tên, số tiền, nội dung) lấy từ cấu hình `.env` + DB; frontend dựng URL ảnh. Không nhận số tiền/nội dung từ client.
- Không có xác nhận tự động: Admin đối chiếu sao kê theo nội dung = mã đơn rồi bấm “Đã nhận tiền” (có thể nhập mã giao dịch ngân hàng). Đây là ranh giới tin cậy duy nhất ở bước 1.

**PayOS (bước 2, tự xác nhận)**

- Tạo link: `POST https://api-merchant.payos.vn/v2/payment-requests`, header `x-client-id`, `x-api-key`. Body: `orderCode` (**số nguyên**), `amount` (số nguyên), `description` (**≤ 9 ký tự** với tài khoản không liên kết qua payOS), `returnUrl`, `cancelUrl`, `expiredAt` (Unix giây, Int32, tùy chọn), `signature`. Trả `checkoutUrl`, `qrCode`, `paymentLinkId`, `status`; `code = "00"` là thành công, lỗi chỉ có `code`/`desc` (vd. đơn đã tồn tại, sai chữ ký, kênh tạm dừng).
- Chữ ký tạo link: HMAC-SHA256 (checksum key) trên `amount=..&cancelUrl=..&description=..&orderCode=..&returnUrl=..` (đúng 5 trường, theo thứ tự chữ cái), hex.
- Tra cứu: `GET /v2/payment-requests/{orderCode|paymentLinkId}` (`status`, `amountPaid`, `transactions`). Hủy: `POST /v2/payment-requests/{id}/cancel`.
- Webhook: body `{code, desc, success, data{orderCode, amount, description, accountNumber, reference, transactionDateTime, currency, paymentLinkId, code, desc, counterAccount*, virtualAccount*}, signature}`. Kiểm chữ ký: sắp key của `data` theo chữ cái, giá trị null/undefined → `""`, mảng/object → JSON (key con sắp xếp), nối `key=value` bằng `&`, HMAC-SHA256 hex bằng checksum key, so bằng hàm thời gian hằng.
- **Xác minh lại 2026-11-16** (`payos.vn/docs/api/`, `payos.vn/docs/du-lieu-tra-ve/webhook/`, `payos.vn/webhook-la-gi/`, `payos.vn/docs/sdks/back-end/java/`, registry npm `@payos/payos-checkout`):
  - Webhook phải trả **HTTP 2XX** để xác nhận đã nhận. Đăng ký URL bằng `POST /confirm-webhook` body `{webhookUrl}` (header client id + api key) hoặc trang `my.payos.vn`; khi đăng ký payOS gửi **một payload mẫu có chữ ký** tới URL, endpoint phải trả 2XX cho payload không khớp đơn nào. URL phải https và truy cập được từ ngoài.
  - **Chính sách gửi lại và timeout không được công bố** (trang hướng dẫn của payOS ghi “cần kiểm tra tại thời điểm triển khai”) → không được dựa vào gửi lại; đường dự phòng là `GET /v2/payment-requests/{orderCode}` (`status`, `amountPaid`, `transactions`).
  - `returnUrl`, `cancelUrl` là **bắt buộc** khi tạo link, kể cả khi nhúng. Response tạo link có `bin`, `accountNumber`, `accountName`, `amount`, `description`, `checkoutUrl`, `qrCode`. Không công bố số tiền tối thiểu/tối đa, khoảng `orderCode`, rate limit (chỉ có 429).
  - Embedded: `@payos/payos-checkout` 1.0.9 (phát hành 2026-11-12), không khai peer dependency; `usePayOS({RETURN_URL, ELEMENT_ID, CHECKOUT_URL, embedded: true, onSuccess, onCancel, onExit})`, `open()`/`exit()`; `CHECKOUT_URL` phải dạng `https://pay.payos.vn/web/<id>`; event chỉ có `status`; `onSuccess` chỉ là tín hiệu giao diện. Chưa chạy thử với React của `app/` (`"react": "latest"`).
  - SDK Java chính thức `vn.payos:payos-java` (trang ghi 2.0.1 và 2.1.0, chưa rõ bản nào mới nhất; chưa kiểm với Spring Boot 4.1.1/Java 21): `paymentRequests().create`, `webhooks().verify`.
  - payOS có API chi hộ `POST /v1/payouts` (cần số dư tài khoản chi, idempotency key, chữ ký): không dùng, người dùng chốt chi tay.
  - Tài khoản cá nhân/hộ kinh doanh dùng được; gói miễn phí theo lô giao dịch (các trang của payOS ghi khác nhau: 100, 1000 hoặc không giới hạn tùy ngân hàng) — xem trong `my.payos.vn` khi đăng ký.
- **Chưa tìm thấy trong tài liệu:** mã HTTP/JSON webhook phải trả, chính sách gửi lại, cách đăng ký URL (có API `confirm-webhook` và trang quản trị). Spec phải: trả 2xx khi đã xử lý hoặc đã xử lý trước đó (idempotent); webhook không khớp đơn (vd. ping kiểm tra) vẫn trả 2xx nhưng không đổi dữ liệu; nguồn sự thật cuối cùng có thể đối chiếu bằng API tra cứu.

**Hệ quả cho thiết kế (đưa vào spec)**

- `orders.order_code` là `varchar(50)`; PayOS cần `orderCode` số nguyên và `description` ≤ 9 ký tự → spec chốt cách sinh: mã đơn hiển thị ngắn (vd. `TV` + 6 ký tự) dùng làm nội dung chuyển khoản, kèm một số nguyên duy nhất cho PayOS (cột mới hoặc sequence).
- Bước 1 và bước 2 dùng chung một hàm xác nhận (khóa dòng, idempotent, đối chiếu số tiền với DB, trigger cấp quyền); chỉ khác nguồn xác nhận (Admin / webhook đã kiểm chữ ký).
- Khóa PayOS (`PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY`) và thông tin tài khoản nhận chỉ ở `.env` backend, thêm vào `.env.example` không giá trị; không log.
- Test không gọi PayOS/VietQR thật: unit test chữ ký bằng vector tự dựng theo công thức trên; tích hợp dùng cổng giả lập.

## 10. Hướng người dùng đã nêu trước đây (chuyển từ `PLAN.md` ngày 2026-11-14; quyết định gốc 2026-11-06)

Mục 7 có thể thu hẹp các hướng dưới đây; khi lệch, quyết định mới ở mục 8 thắng.

- Thứ tự module: `course-free` → `course-payment` (đăng ký bán + đồng ý điều khoản/tỷ lệ hoa hồng, Admin duyệt; đặt giá; đơn hàng, cổng thanh toán, webhook, cấp quyền; đơn hàng snapshot tỷ lệ) → `course-commission` (tính tiền tác giả theo snapshot, sổ tiền, chi trả). Module bài tập độc lập, có thể chen giữa.
- **Không hoàn tiền** (người dùng chốt 2026-11-06, quá phức tạp): mua rồi không hoàn; migration mới xóa bảng `refunds` + `validate_refund`/`revoke_course_access_after_refund` và trigger, bỏ `refunds` khỏi danh sách bảng audit trong V1 (không sửa V1). Điều khoản bán và trang mua phải ghi rõ “không hoàn tiền”.
- Ba cấp quyền: tác giả đã duyệt tạo được khóa **miễn phí** không cần điều khoản mới; muốn bán phải “đăng ký bán khóa học” một lần (đồng ý điều khoản bán hàng có phiên bản + tỷ lệ hoa hồng, khai thông tin nhận tiền, Admin duyệt); khóa trả phí hiện tỷ lệ đang áp dụng khi gửi duyệt. Đổi điều khoản thì phải đồng ý bản mới trước khi đặt giá/gửi duyệt khóa mới.
- Tỷ lệ hoa hồng mặc định + riêng từng tác giả/khóa có ngày hiệu lực; mỗi đơn lưu snapshot tỷ lệ/số tiền lúc mua; sổ ghi tiền và đợt chi trả.
- Chia vai: **Admin** duyệt đăng ký bán, tỷ lệ hoa hồng, điều khoản, chi trả, trần giá chung (nếu cần); **Moderator** chỉ duyệt/ẩn/gỡ nội dung khóa và bài học, không thấy giá/doanh thu/thông tin ngân hàng. Tác giả tự đặt giá.
- Video: `course-free` dùng YouTube (Không công khai, nhúng `youtube-nocookie`). Hướng cũ: không dùng YouTube cho khóa trả phí (link lộ trong mã trang); `course-payment` chốt nhà cung cấp có token xem (Bunny Stream/Cloudflare/Mux…), trình duyệt tải thẳng lên bằng URL/chữ ký backend cấp, webhook báo trạng thái, không truyền video qua backend.
- **Thời lượng ước tính của khóa** (hoãn 2026-11-06): cộng reading time thì bài chỉ video bị tính sai; cần nguồn thời lượng video nên làm cùng/sau `course-payment`.
- **Trợ lý AI của khóa** (chỉ trả lời trong kiến thức khóa): sau `course-free`, hai bước — (1) “Hỏi AI về bài này”: đưa nội dung bài đang xem vào ngữ cảnh, không cần vector DB; (2) hỏi trên cả khóa: RAG (cần pgvector + embedding, Postgres hiện chưa có) — gộp với module RAG đã hoãn từ `ai-assist`.
- Để sau (module riêng): lưu/yêu thích khóa, đánh giá sao, bình luận, ghi chú.
