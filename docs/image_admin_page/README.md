# Ảnh tham chiếu trang Admin

Ảnh chụp một trang admin bên ngoài, người dùng đưa vào ngày 2026-11-03 để **tham khảo bố cục và mật độ thông tin** cho Admin TechVerse. Chỉ học cấu trúc; không chép logo, chữ, ảnh hay code (spec `ui-foundation-v2` “Ngoài phạm vi”). Mẫu chung đã rút ra từ trước: [`../design/javabuilder-patterns.md`](../design/javabuilder-patterns.md).

## Khung chung (mọi ảnh)

- Sidebar trái nhóm theo khu vực (nhãn nhóm chữ hoa nhỏ, thu gọn được), mục active có nền nhạt + viền trái màu.
- Topbar: tên trang bên trái; bên phải là chọn ngôn ngữ, đổi theme, chuông thông báo.
- Đầu trang: H1 + mô tả 1 dòng bên trái; nút hành động chính (xanh, icon `+`) và/hoặc chip “Tổng: N” bên phải.
- Hàng thẻ thống kê 3–5 ô: nhãn chữ hoa nhỏ, số lớn (số mang màu theo ý nghĩa: xanh lá = hoạt động, cam = cảnh báo, đỏ = xóa), icon trong ô vuông màu nhạt ở góc phải.
- Thanh lọc trong một card riêng: tiêu đề “Bộ lọc/Tìm kiếm” có icon, ô tìm có icon kính lúp, chip lọc nhanh, nút “Làm mới” bên phải.
- Danh sách trong card có tiêu đề + mô tả + chip đếm ở góc phải; bảng có header chữ hoa nhỏ màu xám, hàng cao ~60px, phân cách mảnh.
- Badge trạng thái dạng pill nền nhạt; hành động trên hàng là nút nhỏ viền (“Sửa”) và nút đỏ nhạt (“Xóa”), hoặc menu `…`.

## Từng ảnh

| Ảnh | Trang | Điểm đáng học |
|---|---|---|
| `admin-dashboard.png` | Trang chủ admin | Lời chào + 5 thẻ số liệu có icon; bảng “Hoạt động gần đây” (avatar, nội dung có badge loại, số tiền, thời gian tương đối, trạng thái); cột phải “Thành viên trực tuyến” (avatar có chấm online, badge trạng thái). |
| `admin-user-management.png` | Quản lý người dùng | **Mẫu chính cho `/admin/users`.** Header + chip tổng + nút tạo; 4 thẻ số (Tổng / Đang hoạt động / Ẩn / Xóa); card tìm kiếm có chip thời gian (Hôm nay, 7 ngày, 30 ngày), ô tìm, từ ngày – đến ngày, nút Làm mới; bảng: Người dùng (avatar + tên), Email, Trạng thái, Vai trò, MFA, Ngày tạo, Thao tác (Sửa/Xóa). |
| `admin-role-management.png` | Quản lý vai trò | Bảng gọn: tên vai trò dạng badge có icon khiên, mô tả cắt dòng, ngày tạo/cập nhật, nút bút sửa; ô tìm full-width phía trên. |
| `admin-login-sessions.png` | Phiên đăng nhập | Bảng: người dùng (avatar chữ cái màu + tên + email 2 dòng), provider dạng badge (Google/Mật khẩu), trạng thái có chấm, browser, thiết bị 2 dòng, IP, hoạt động gần nhất, nút info. |
| `admin-login-analytics.png` | Phân tích đăng nhập | Lưới 2 cột biểu đồ donut (số tổng ở giữa, chú thích có %); biểu đồ cột top 8 trình duyệt. |
| `admin-subscriptions.png` | Subscriptions | Bảng có cột “Còn lại N ngày” tô màu; **phân trang dưới bảng: “Hiển thị 1 đến 10 trong tổng số 46” bên trái, nút số trang 1 2 3 … 5 + mũi tên bên phải.** |
| `admin-payments.png` | Thanh toán | Card lọc 4 ô (mã đơn, trạng thái, từ ngày, đến ngày); bảng có mã đơn đậm, badge loại, số tiền căn phải, badge trạng thái. |
| `admin-course-management.png` | Khóa học | 3 thẻ số; card lọc với chip loại (Tất cả/Video/Văn bản/Hỗn hợp) + select trình độ; danh sách hàng lớn có ảnh bìa, tiêu đề, mô tả 2 dòng, badge + meta icon, menu `…`. |
| `admin-course-actions.png` | Khóa học – menu | Menu `…` thả xuống: các hành động có icon, hành động xóa màu đỏ tách cuối. |
| `admin-create-course.png` | Tạo khóa học | Dialog form: tiêu đề có icon, nhãn có dấu `*` bắt buộc, lưới 2 cột cho trường ngắn, vùng tải ảnh viền nét đứt, footer Hủy + nút chính. |
| `admin-interview-questions.png` | Chủ đề phỏng vấn | **Mẫu cho `/admin/topics`, `/admin/tags`.** 4 thẻ số (tổng, …, đang hoạt động); **lưới 3 cột card**: icon + tên + badge “Hoạt động” góc phải, mô tả 2 dòng, đường kẻ, hàng icon hành động (sửa, mở, xóa đỏ) căn phải. |
| `admin-blog-management.png` | Quản lý bài viết | 4 thẻ số; lưới 4 cột card có ảnh bìa, badge danh mục, tiêu đề, mô tả, tag, số xem/thích/bình luận, 3 nút Xem/Sửa/Xóa. |
| `admin-blog-loading.png` | Bài viết – đang tải | Trạng thái tải: thẻ số về 0, dòng “Đang cập nhật dữ liệu…”, skeleton mờ; banner mất mạng. |
| `admin-qna-management.png` | Q&A | Thẻ số có icon màu; bảng có STT, danh mục dạng badge có icon, tác giả có avatar, trạng thái, thống kê icon, hành động icon (xem/sửa/xóa). |
| `admin-question-contributions.png` | Duyệt đóng góp | Thẻ số theo trạng thái; chip lọc trạng thái kèm số đếm; danh sách card: avatar, badge trạng thái + độ khó, nội dung, nút Xem/Duyệt/Từ chối. Gần với `/admin/author-applications`. |
| `admin-exercise-student-progress.png` | Bài tập – tiến độ | Tab trong trang; card lọc 2 ô + nút Đặt lại/Tìm kiếm; bảng có thanh tiến độ màu theo %. |
| `admin-reports.png` | Báo cáo | Biểu đồ cột/đường; hàng số tổng kết 3 cột dưới biểu đồ. |
| `admin-scheduled-jobs.png` | Tác vụ định kỳ | Dải 6 ô số có chấm màu theo trạng thái trong một card; chip loại; bảng job 2 dòng (tên + mô tả). |
| `admin-compose-email.png` | Soạn email | Lưới mẫu dạng thẻ nhỏ; trình soạn HTML + xem trước trực tiếp bên phải. |
| `admin-compose-push.png` | Soạn push | Tab; chip mẫu nhanh; select đối tượng có mô tả từng lựa chọn; khung xem trước desktop/mobile. |
| `admin-push-recipients.png` | Người nhận push | Tab có số đếm; ô tìm + chip đếm; bảng có nút hành động chính trên từng hàng. |

## Áp dụng cho TechVerse (branch `refactor/admin-ui`)

Chỉ dựng phần có dữ liệu/API thật; không thêm tính năng (tạo/xóa người dùng, MFA, khoảng ngày…) khi backend chưa có.
