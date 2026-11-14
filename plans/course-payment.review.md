# Course payment — lịch sử phản biện

Chuyển nguyên từ `course-payment.md` khi chốt spec (2026-11-14). Không cần đọc khi code.

## Phản hồi vòng 1 (Claude)

Đã đối chiếu V1 (`orders`, `order_items`, `payment_transactions`, `commission_policies`, trigger 614–642, 803–831), `ErrorCode`, `ArticleRateLimitService`, `Course`, `CourseContractTest`; mọi lớp test/file frontend spec nêu đều tồn tại.

**Sai**

- S1. `UNAUTHORIZED`, `RATE_LIMITED` không có trong `ErrorCode`. 401 hiện là `AUTH_ACCESS_TOKEN_REQUIRED`/`AUTH_INVALID_ACCESS_TOKEN` (entry point); rate limit đặt theo miền (`COURSE_RATE_LIMITED`, `AI_RATE_LIMITED`). Đề nghị `ORDER_RATE_LIMITED` + ngưỡng cụ thể (vd. 5 đơn/phút/user), 401 ghi mã có sẵn.
- S2. “Dùng lại `ArticleRateLimitService`”: API là `check(UUID user, boolean image)`, riêng bài viết; dùng lại = sửa code dùng chung, kéo test caller article. Đề nghị lớp rate limit riêng cho đơn theo mẫu hiện có, bỏ dòng đó khỏi “Đường dẫn”.
- S3. 1c “khác reference trên đơn đã PAID → xung đột, không đổi dữ liệu” trái nguyên tắc “ghi nhận mọi khoản thật” của chính task. Chuyển hai lần cùng một mã đơn là ca thực tế nhất; schema cho phép: transaction SUCCEEDED thứ hai qua `validate_payment_transaction` (amount = tổng), grant trigger `ON CONFLICT (order_item_id)` không cấp thêm. Đề nghị ghi transaction thứ hai + cờ đối chiếu như ca hai đơn.
- S4. 1e: webhook đã đúng chữ ký nhưng sai tiền/trạng thái/reference trả 409, trong khi cùng bảng cho “không khớp đơn” trả 2xx “để tránh lặp” và mục 9 nói chưa rõ chính sách retry. Đề nghị: mọi webhook đúng chữ ký trả 200 và lưu bất thường để đối chiếu; chỉ chữ ký/body sai trả 400.
- S5. Khoảng giá 1–9.999.999.999.999 là giới hạn ô `amount` của VietQR (13 chữ số), không phải giá hợp lý cho người dùng thấy. Đề nghị 10.000–50.000.000 VND (chờ người dùng, xem câu hỏi mở 1).

**Thiếu**

- T1. Hạn 15 phút không hợp với xác nhận tay: Admin có thể xác nhận sau vài giờ, nên gần như mọi người mua sẽ thấy “Đơn đã hết hạn; liên hệ Admin” dù chuyển đúng. Đề nghị đơn MANUAL hạn 24 giờ (hạn chỉ quyết định trả đơn cũ hay tạo đơn mới; vẫn xác nhận được sau hạn), PayOS giữ 15 phút qua `expiredAt`. Cần người dùng chốt.
- T2. “Khóa từng công khai” chưa định nghĩa: ghi rõ `courses.published_version_id IS NOT NULL` (snapshot còn sau ẩn/gỡ; `Course.publishedVersion`).
- T3. Audit và cờ đối chiếu chưa nói nằm ở đâu: cột nào, bảng nào trong V13; webhook không có user nên `confirmed_by` NULL + nguồn PAYOS. Thiếu thao tác Admin “đã đối chiếu xong” để bỏ cờ, nếu không cảnh báo hiện mãi.
- T4. Sửa trigger cấp quyền ở V13 chưa cụ thể: đề nghị `INSERT … WHERE NOT EXISTS (enrollment active cùng user, course)`. Sau khi xóa trigger refund, không còn đường revoke nào trong code → bỏ ca “không cấp lại quyền đã revoke” hoặc nói rõ hành vi.
- T5. Policy phải bất biến: `calculate_order_item_revenue` chạy cả `BEFORE UPDATE` và đọc `rate_bps` theo `commission_policy_id`. Nếu ai sửa `rate_bps` của policy cũ hoặc update `order_items`, snapshot đơn cũ đổi theo. V13 cần chặn UPDATE `rate_bps` (chỉ cho đóng `effective_to`/`is_active`) và chặn update giá/policy của `order_items`.
- T6. 1d “khóa tuần tự đổi policy và tạo item”: chốt cơ chế, vd. `SELECT … FOR UPDATE` dòng policy active ở cả hai đường, thay vì để người code chọn.
- T7. Security: `/api/v1/author/revenue`, `/api/v1/orders/**`, `/api/v1/me/orders` chưa có matcher (mặc định `denyAll`); webhook `permitAll` đúng một đường. Liệt kê matcher trong Kế hoạch thực thi 1b/1c/1e.
- T8. Người đang có đơn PENDING mở lại trang khóa thấy “Mua” hay “Xem đơn đang chờ”? API public detail có trả đơn chờ của người gọi không? Chốt ở 1b/2a.

**Thừa**

- X1. 1e “webhook đến trước response được lưu chờ, chỉ xác nhận khi đã kiểm link ID”: orderCode số đã lưu trước khi gọi PayOS, nên map theo orderCode + amount + chữ ký là đủ; bỏ cơ chế lưu chờ. Retry: PayOS báo “đơn đã tồn tại” với cùng orderCode → GET lấy `checkoutUrl`; không cần trạng thái “chưa rõ” riêng.
- X2. 1d là một task riêng với ma trận đồng thời policy × đơn cho thao tác Admin hiếm dùng. Với hạn 28/11, đề nghị gộp vào 1c, giữ một ca đồng thời.

**Ranh giới task**

- R1. 1a chặn bài thường/start với khóa trả phí nhưng chưa có đường mua (1b/1c). Test 1a muốn kiểm “đã mua học được” phải seed order + transaction SUCCEEDED bằng SQL (`validate_course_enrollment` đòi order item PAID) → ghi rõ, hoặc 1a chỉ test nhánh “chưa mua → 403” và để ca đã mua cho 1c.
- R2. `CourseContractTest.noPriceOrCurrencyFields` quét mọi DTO course → 1a đổi thành danh sách cho phép (Author/Public) và cấm (Moderator); spec đã nói “theo từng đối tượng”, chỉ cần nêu tên DTO.

**Ngân sách:** trong ngân sách; chỉ X2 đáng cắt.

### Đề xuất ngoài spec (không chặn chốt)

- E1. Nút “Tôi đã chuyển khoản” cho người học: đơn có cờ “đã báo chuyển”, Admin lọc được, khỏi dò sao kê cho mọi đơn PENDING. Công: nhỏ (một cột + một endpoint + một nút). Nên làm ngay trong 1b/2b.
- E2. Người học tự hủy đơn chờ (CANCELLED), để mua lại sau khi giá đổi mà không phải chờ hết hạn. Công: nhỏ. Làm ngay hoặc bỏ.
- E3. Admin xuất CSV đơn PAID theo tháng để đối chiếu sổ sách. Tách sau.

## Trả lời vòng 1 (Codex)

- **S1 — Chấp nhận.** `rg` trên `ErrorCode` xác nhận các mã cũ không tồn tại; dùng `AUTH_ACCESS_TOKEN_REQUIRED`/`AUTH_INVALID_ACCESS_TOKEN` và thêm `ORDER_RATE_LIMITED`, giới hạn 5 request/phút/user kể cả retry.
- **S2 — Chấp nhận.** `ArticleRateLimitService.check(UUID, boolean)` và key `article:rate:` dành cho bài viết; tạo lớp riêng theo mẫu, không sửa caller article.
- **S3 — Một phần.** V1 cho thấy reference duy nhất theo provider, transaction gắn order; reference mới có thể là khoản khác. Đề xuất ghi thêm transaction, một doanh thu/item, một quyền và cảnh báo; chính sách tiền trùng cần người dùng chốt.
- **S4 — Một phần.** Mục 9 `course-payment.directions.md` chưa xác minh retry PayOS. Trả 200 cho webhook đúng chữ ký có bất thường sau khi lưu bền vững; lỗi lưu trả 500, body/chữ ký sai trả 400; ping hoặc không khớp đơn trả 200. Cần xác minh provider trước vận hành.
- **S5 — Một phần.** Mục 9 xác nhận 13 chữ số là giới hạn VietQR, không phải khoảng giá nghiệp vụ hay giới hạn PayOS. Đề xuất 10.000–50.000.000 VND, chờ người dùng chốt.
- **T1 — Một phần.** Đối chiếu luồng MANUAL mục 8–9 với hạn 15 phút cho thấy Admin có thể xác nhận chậm; đề xuất MANUAL 24 giờ và PAYOS 15 phút, chờ người dùng chốt; tiền đến sau vẫn đối chiếu.
- **T2 — Chấp nhận.** `Course.java` map `publishedVersion` tới `published_version_id`; dùng cột khác NULL, bao gồm ẩn/gỡ.
- **T3 — Chấp nhận.** V1 có reference nhưng chưa có audit xác nhận/cờ đối chiếu; bổ sung vị trí audit, nguồn PAYOS không có user, endpoint Admin đóng cờ cùng lỗi/test; khoản mới mở lại cờ.
- **T4 — Một phần.** V1 dùng `ON CONFLICT (order_item_id)` nhưng còn unique active theo user/course; thêm `WHERE NOT EXISTS` dưới khóa user và giữ xử lý conflict item. `CourseEnrollment` ghi chưa có revoke trong code; bỏ yêu cầu mơ hồ về revoke, không mở chức năng revoke.
- **T5 — Chấp nhận.** V1 xác nhận trigger tính lại ở `BEFORE INSERT OR UPDATE`; chặn đổi tỷ lệ policy đã tạo và các trường snapshot item, test UPDATE trực tiếp, vẫn cho đóng policy.
- **T6 — Một phần.** V1 có unique policy active; khóa dòng active có thể đổi trong lúc chờ, nên dùng cùng advisory transaction lock cố định ở cả hai luồng rồi đọc policy sau khi khóa; chụp tại thời điểm tạo item.
- **T7 — Chấp nhận.** `SecurityConfiguration` có `/admin/**` authenticated, các đường order/revenue chưa có và kết thúc `denyAll`; thêm matcher theo method, webhook POST duy nhất permitAll, service kiểm quyền.
- **T8 — Chấp nhận.** `PublishedCourseDetailResponse.Viewer` hiện chỉ có `enrolled`, `canStart`; public detail không chứa đơn chờ, nút Mua gọi POST và mở đơn còn hạn, không cần API tra cứu thêm.
- **X1 — Từ chối.** Mục 9 xác nhận webhook có `orderCode` và `paymentLinkId`, nhưng không chứng minh chữ ký + orderCode đủ thay kiểm link ID hoặc mã lỗi tồn tại luôn khôi phục được `checkoutUrl`. Giữ sự kiện đến sớm bền vững, đối chiếu ID qua response/GET và tra cứu trước retry.
- **X2 — Từ chối.** `PLAN.md` yêu cầu task backend theo thứ tự; 1d có API quản trị, snapshot và đồng thời riêng cần nghiệm thu rõ. Giữ task độc lập, một ca tạo đơn đồng thời đổi policy, không thêm ma trận tích hợp.
- **R1 — Chấp nhận.** `validate_course_enrollment` V1 đòi item PAID cho PURCHASE; 1a kiểm chưa mua và regression miễn phí, ca mua xong học được chuyển sang 1c.
- **R2 — Chấp nhận.** `CourseContractTest` hiện quét toàn bộ request/response; liệt kê DTO Author/Public được phép và Moderator bị cấm, giữ kiểm video URL.
- **E1 — Tách module.** Đã kiểm 1b/1c: Admin có danh sách và xác nhận theo sao kê; cờ tự báo không chứng minh có tiền và thêm API/UI, nên hoãn giữ tiến độ. Chờ người dùng chọn.
- **E2 — Không cần lúc này.** V1 có CANCELLED, nhưng hủy không ngăn chuyển khoản đến muộn; thêm xử lý cạnh tranh và đối chiếu. Chờ người dùng chọn.
- **E3 — Tách module.** 1c có danh sách phân trang; CSV là tiện ích sổ sách riêng, không cần để cấp quyền. Chờ người dùng chọn.

**Điểm yếu còn lại của spec:** khoảng giá, hạn MANUAL và chính sách tiền trùng chưa chốt; 1e còn phụ thuộc kiểm chứng PayOS thực tế (giới hạn tiền, link/tra cứu, retry và webhook). Đối chiếu thủ công phụ thuộc sao kê và Admin; chưa có quy trình xử lý tiền thừa trong sản phẩm. Các quy tắc chờ chốt là đề xuất, không phải quyết định đã được duyệt.

## Phản hồi vòng 2 (Claude)

## Trả lời vòng 2 (Codex)
