# Câu hỏi cho các chức năng còn lại của TechVerse

Viết 2026-11-13. Mục đích: người dùng trả lời **một lần** để có hướng cho mọi module chưa làm; từ câu trả lời, Claude viết file hướng cho từng module, Codex viết spec, quy trình giữ như cũ.

## Cách trả lời

- Mỗi câu có sẵn lựa chọn; lựa chọn **in đậm** là khuyến nghị. Trả lời kiểu `T1 A, B3 C, còn lại theo khuyến nghị` là đủ. Câu không trả lời = lấy khuyến nghị.
- Muốn khác các lựa chọn thì viết tự do sau mã câu.
- File chỉ hỏi **nghiệp vụ và thứ người dùng nhìn thấy** (ai làm được gì, có/không có chức năng, mức độ). Không hỏi kỹ thuật backend (bảng, API, transaction, test): phần đó Claude/Codex tự chọn theo code hiện có và ghi trong spec. Chi tiết giao diện (bố cục từng màn) không hỏi ở đây: mỗi module có cổng wireframe để bạn duyệt trước khi code giao diện.

## Đã có, không hỏi lại

- **Học khóa miễn phí:** không có bước đăng ký; đăng nhập rồi bấm học là được ghi nhận, có “Khóa học của tôi” và tiến độ. Moderator duyệt/ẩn/gỡ khóa. Admin và Moderator không học.
- **Mẫu duyệt nội dung:** tác giả soạn → gửi duyệt → Moderator duyệt hoặc yêu cầu sửa → công khai; Moderator ẩn/gỡ sau đó. Các module dưới dùng lại mẫu này khi cần duyệt.
- **AI:** tạo nội dung theo dàn ý + stream, có giới hạn lượt mỗi ngày, test không gọi model thật.
- **Thanh toán:** không hoàn tiền; Moderator không thấy giá/doanh thu.

---

## T. Tổng quan

**T1. Hạn nộp/bảo vệ đồ án là khi nào?** (trả lời bằng ngày; dùng để quyết cắt gì)

**T2. Thứ tự làm.**
- **A. Thanh toán → Bài tập + AI → Ôn phỏng vấn → Diễn đàn/bình luận/báo cáo → Nhắn tin**
- B. Bài tập + AI → Ôn phỏng vấn → Diễn đàn → Thanh toán → Nhắn tin (ưu tiên phần học, thanh toán sau)
- C. Thứ tự khác (ghi ra)

**T3. Nếu thiếu thời gian, cắt chức năng nào trước?**
- **A. Nhắn tin** (tốn công nhất, ít liên quan việc học)
- B. Diễn đàn
- C. Thanh toán
- D. Không cắt gì

**T4. Schema còn sẵn bảng “Tài liệu” (tác giả đăng PDF hoặc link Notion, Moderator duyệt, người dùng lưu). Có làm không?**
- **A. Không làm** (bạn không nhắc tới; bài viết và khóa học đã phủ nhu cầu)
- B. Có, làm sau cùng
- C. Có, làm sớm

**T5. Thông báo (chuông trên web khi bài được duyệt, có người trả lời, mua khóa thành công…).**
- **A. Chưa làm; mỗi màn tự hiện trạng thái**
- B. Làm một module thông báo đơn giản (chuông + danh sách, không email) sau Diễn đàn
- C. Có cả email

**T6. Trang tổng quan Admin/Moderator hiện là khung trống. Có cần số liệu thật (số người dùng, bài chờ duyệt, doanh thu) không?**
- **A. Có, làm gọn ở cuối dự án, chỉ các con số đếm**
- B. Không cần
- C. Cần cả biểu đồ theo thời gian

---

## P. Thanh toán khóa học

Chi tiết các hướng ở [`course-payment.directions.md`](course-payment.directions.md). Trả lời ở đây là đủ.

**P1. Cổng thanh toán.**
- **A. Cổng giả lập trong app + VNPay sandbox** (tiền ảo, demo được cả khi mất mạng)
- B. Chỉ cổng giả lập
- C. Cổng giả lập + Stripe test
- D. Chuyển khoản QR tiền thật (PayOS/SePay)

**P2. Phạm vi.**
- **A. Lõi:** tác giả đặt giá, người học mua từng khóa, tự được vào học, “Đơn hàng của tôi”, Admin xem danh sách đơn
- B. Lõi + trang doanh thu của tác giả + Admin đổi tỷ lệ hoa hồng
- C. Đầy đủ như dự định cũ: thêm đăng ký bán có Admin duyệt, điều khoản nhiều phiên bản, sổ tiền, đợt chi trả

**P3. Ai được đặt giá cho khóa?**
- **A. Mọi tác giả đã được duyệt** (bỏ bước “đăng ký bán”)
- B. Tác giả phải đồng ý điều khoản bán hàng một lần (không cần Admin duyệt)
- C. Phải đăng ký bán và Admin duyệt

**P4. Learner mua thế nào?**
- **A. Mua từng khóa, bấm “Mua” là sang trang thanh toán**
- B. Có giỏ hàng, mua nhiều khóa một đơn

**P5. Chưa mua thì xem được gì của khóa trả phí?**
- **A. Trang tổng quan + các bài tác giả bật “Học thử”**
- B. Chỉ trang tổng quan

**P6. Video của khóa trả phí.**
- **A. Vẫn dùng YouTube không công khai, chấp nhận người đã mua có thể chia sẻ link** (ghi là giới hạn của đồ án)
- B. Tải video lên Cloudinary, phát bằng link có hạn
- C. Khóa trả phí chưa cho phép video

**P7. Khóa đã công khai có được đổi giữa miễn phí và trả phí không?**
- **A. Không; đổi giá thì được, đổi loại thì tạo khóa mới**
- B. Được; người đã học miễn phí giữ quyền

**P8. Tỷ lệ nền tảng giữ lại trên mỗi đơn (lưu vào đơn, chưa hiển thị ở phạm vi Lõi).** **20%** / số khác.

**P9. Admin làm gì với đơn hàng?**
- **A. Chỉ xem và lọc**
- B. Xem + cấp quyền học miễn phí cho một người (tặng khóa)
- C. Thêm hủy đơn/thu hồi quyền học

**P10. Mã giảm giá.** **A. Không** / B. Có, Admin tạo mã chung / C. Tác giả tự tạo mã cho khóa mình.

---

## B. Bài tập cho người dùng, kết hợp AI

Nền có sẵn trong schema: bộ bài tập (chủ đề, độ khó, giới hạn thời gian, trạng thái duyệt) gồm nhiều câu; bốn loại đã định sẵn là **trắc nghiệm, flashcard, tìm lỗi trong code, tình huống debug**; lưu từng lượt làm (số đúng/tổng, thời gian).

**B1. Làm những loại bài nào?**
- **A. Trắc nghiệm + flashcard** (chấm tự động, không cần AI để chấm)
- B. Thêm “tìm lỗi trong code” (người học viết câu trả lời, AI nhận xét)
- C. Cả bốn loại

**B2. Ai tạo bộ bài tập?**
- **A. Tác giả đã duyệt** (như bài viết)
- B. Tác giả và Moderator
- C. Mọi người dùng

**B3. Bộ bài tập có cần Moderator duyệt trước khi công khai?**
- **A. Có, dùng lại mẫu duyệt bài viết**
- B. Không, tác giả tự công khai; Moderator chỉ ẩn/gỡ khi có vấn đề

**B4. AI làm gì? (chọn nhiều)**
- **A. Giúp tác giả sinh câu hỏi + đáp án + giải thích từ chủ đề hoặc từ nội dung dán vào; tác giả sửa rồi mới lưu**
- **B. Giải thích cho người học sau khi làm sai (“vì sao đáp án này sai”)**
- C. Chấm và nhận xét câu trả lời tự luận/code (cần khi B1 chọn B hoặc C)
- D. Sinh bài tập riêng cho từng người học theo yêu cầu (không qua tác giả, không duyệt)

**B5. Bài tập đứng ở đâu?**
- **A. Khu “Luyện tập” riêng, lọc theo chủ đề/độ khó**
- B. Gắn vào cuối bài học của khóa
- C. Cả hai (làm A trước, B sau)

**B6. Người học thấy gì sau khi làm?**
- **A. Điểm, đáp án đúng, giải thích từng câu; lịch sử các lần làm của mình**
- B. Thêm thống kê theo chủ đề (điểm mạnh/yếu)
- C. Thêm bảng xếp hạng

**B7. Có được làm lại không, có tính giờ không?**
- **A. Làm lại không giới hạn; tính giờ chỉ khi bộ bài có đặt giới hạn, hết giờ tự nộp**
- B. Không tính giờ
- C. Giới hạn số lần làm

**B8. Khách chưa đăng nhập.** **A. Xem danh sách, phải đăng nhập mới làm** / B. Làm được nhưng không lưu kết quả / C. Phải đăng nhập mới thấy.

**B9. Giới hạn lượt AI cho người học mỗi ngày (B4-B, C, D).** **A. Có, một con số chung cho mọi người** (đề nghị 20 lượt/ngày) / B. Không giới hạn.

---

## I. Ôn tập phỏng vấn

Nền có sẵn: câu hỏi phỏng vấn theo chủ đề và mức (dễ/vừa/khó), có đáp án mẫu, gợi ý, trạng thái duyệt.

**I1. Mức độ chức năng.**
- A. Ngân hàng câu hỏi: xem câu hỏi, bấm hiện gợi ý/đáp án mẫu, lọc theo chủ đề và mức
- **B. A + luyện trả lời: người học gõ câu trả lời, AI nhận xét so với đáp án mẫu**
- C. B + phỏng vấn thử: AI hỏi lần lượt một bộ 5–10 câu theo chủ đề, cuối buổi có tổng kết

**I2. Ai tạo câu hỏi?**
- **A. Tác giả đã duyệt, Moderator duyệt trước khi công khai**
- B. Moderator/Admin tự nhập, không qua duyệt
- C. Mọi người dùng đóng góp, Moderator duyệt

**I3. Tác giả có được dùng AI sinh câu hỏi + đáp án mẫu không?** **A. Có, sửa rồi mới gửi duyệt** / B. Không.

**I4. Người học lưu gì?**
- **A. Đánh dấu “đã ôn” và “lưu lại để xem sau” từng câu**
- B. Thêm lịch sử các câu trả lời đã gõ và nhận xét của AI
- C. Không lưu gì

**I5. Có nhóm câu hỏi theo vị trí tuyển dụng (ví dụ “Java Backend Intern”) không?**
- **A. Không, chỉ theo chủ đề + mức** (schema hiện tại đủ)
- B. Có, Admin tạo các bộ theo vị trí

**I6. Khách chưa đăng nhập.** **A. Xem được câu hỏi, đăng nhập mới xem đáp án/luyện** / B. Xem được tất cả, đăng nhập mới dùng AI / C. Phải đăng nhập.

---

## F. Diễn đàn, bình luận, báo cáo vi phạm

Nền có sẵn: diễn đàn dạng **hỏi–đáp** (bài hỏi có tiêu đề, câu trả lời một cấp); bình luận gắn vào bài viết/khóa học (có trả lời bình luận); báo cáo vi phạm cho bài viết, khóa học, bình luận, bài diễn đàn với 5 lý do; Moderator xử lý báo cáo.

**F1. Làm những phần nào?**
- **A. Diễn đàn hỏi–đáp + báo cáo vi phạm**; bình luận dưới bài viết/khóa học làm sau
- B. Cả ba cùng lúc
- C. Chỉ bình luận dưới bài viết/khóa học + báo cáo, không có diễn đàn riêng

**F2. Ai được đăng bài hỏi và trả lời?**
- **A. Mọi tài khoản đã đăng nhập (trừ tài khoản bị khóa)**; khách chỉ đọc
- B. Phải đăng nhập mới đọc được

**F3. Bài đăng có cần duyệt trước không?**
- **A. Không; hiện ngay, Moderator ẩn sau khi có báo cáo hoặc tự thấy**
- B. Bài hỏi phải duyệt, câu trả lời thì không

**F4. Phân loại bài hỏi.**
- **A. Gắn chủ đề (dùng chung danh sách chủ đề hiện có) + tìm theo từ khóa** (cần thêm cột, schema hiện chưa có)
- B. Không phân loại, chỉ tìm kiếm
- C. Chủ đề + thẻ

**F5. Tương tác.**
- **A. Người hỏi đánh dấu một câu trả lời là “đã giải quyết”**
- B. Thêm bình chọn lên/xuống cho bài hỏi và câu trả lời
- C. Không có gì ngoài trả lời

**F6. Nội dung bài đăng.** **A. Markdown như bài viết, có khối code; chưa cho ảnh** / B. Có cả ảnh / C. Chữ thường.

**F7. Người đăng sửa/xóa bài của mình.**
- **A. Sửa được; xóa thì bài hiện “đã xóa” nếu đã có trả lời**
- B. Không cho sửa sau khi có trả lời

**F8. Moderator làm gì?**
- **A. Hàng đợi báo cáo: xem nội dung bị báo cáo, chọn “ẩn nội dung” hoặc “bỏ qua” kèm ghi chú; ẩn/hiện trực tiếp bài bất kỳ**
- B. Thêm: khóa bài hỏi (không cho trả lời tiếp), ghim bài
- C. Thêm: cấm một người đăng bài trong thời gian nhất định

**F9. Admin làm gì thêm so với Moderator?**
- **A. Không gì thêm ở diễn đàn** (khóa tài khoản đã có ở quản lý người dùng)
- B. Xem thống kê báo cáo theo người dùng

**F10. AI trong diễn đàn.** **A. Không** / B. Nút “AI gợi ý câu trả lời” cho bài hỏi chưa ai trả lời (ghi nhãn rõ là AI).

---

## M. Nhắn tin

Chưa có gì trong schema và code; đây là phần mới hoàn toàn và tốn công nhất.

**M1. Có làm không?**
- **A. Làm cuối cùng, nếu còn thời gian** (xem T3)
- B. Chắc chắn làm
- C. Bỏ

**M2. Ai nhắn cho ai?**
- **A. Người học nhắn riêng với tác giả của khóa mình đang học (hỏi bài)**
- B. Hai tài khoản bất kỳ nhắn riêng với nhau
- C. Phòng chat chung của từng khóa học
- D. B + nhóm chat tự tạo

**M3. Mức “thời gian thực”.**
- **A. Tin mới hiện ngay khi đang mở cuộc trò chuyện** (kết nối trực tiếp), không cần “đang gõ…”, “đã xem”
- B. Không thời gian thực: tải lại hoặc tự làm mới mỗi vài giây (làm nhanh hơn nhiều)
- C. Đầy đủ: đang gõ, đã xem, trạng thái online

**M4. Nội dung tin nhắn.** **A. Chỉ chữ (có khối code)** / B. Thêm ảnh / C. Thêm tệp đính kèm.

**M5. Chống quấy rối.**
- **A. Chặn một người + báo cáo cuộc trò chuyện cho Moderator**
- B. Chỉ chặn
- C. Không cần

**M6. Moderator/Admin có đọc được tin nhắn riêng không?**
- **A. Chỉ đọc được các tin trong cuộc trò chuyện bị báo cáo**
- B. Không bao giờ
- C. Admin đọc được tất cả

**M7. Báo tin mới.** **A. Số tin chưa đọc trên thanh bên** / B. Thêm email khi có tin lúc offline / C. Không.

---

## Sau khi bạn trả lời

1. Claude ghi câu trả lời (có ngày) vào cuối file này và “Câu hỏi mở” của `PLAN.md`.
2. Với module sắp làm, Claude viết file hướng `plans/<module>.directions.md` (như file thanh toán): đối chiếu schema/code có sẵn, bẫy kỹ thuật, tách task. Module xa hơn chỉ viết khi tới lượt, để không lệch với code.
3. Codex viết spec từ file hướng; Claude phản biện; bạn chốt; rồi code như các module trước.

## Đề xuất trả lời của Claude (2026-11-13, đã qua Codex phản biện, chờ người dùng chốt)

Không phải quyết định. Lấy khuyến nghị in đậm, trừ các điểm “Lệch” dưới đây; căn cứ đã đối chiếu `V1__initial_schema.sql`, V12 và `course-payment.directions.md`.

- **T1:** chỉ người dùng trả lời được. **T2 chờ T1** (A nếu đủ thời gian; thiếu thì B — lưu ý B đưa cả diễn đàn lên trước thanh toán). **T3 A. T4 A. T5 A.**
- **Lệch T6:** A, nhưng **doanh thu chỉ Admin thấy**; Moderator chỉ thấy số đếm nội dung/báo cáo.
- **Lệch P1 (theo Codex):** bắt buộc chỉ cổng giả lập; VNPay sandbox là **task cuối, cắt được** khi thiếu thời gian.
- **P2 A, P4 A, P5 A, P7 A, P8 20%, P9 A, P10 A.**
- **P2 A, P3 A, P6 A đảo/thu hẹp quyết định cũ** trong `PLAN.md` (2026-11-06): bỏ đăng ký bán + Admin duyệt, bỏ điều khoản nhiều phiên bản, bỏ khai thông tin nhận tiền, bỏ sổ tiền/chi trả; dùng YouTube cho khóa trả phí → người dùng phải xác nhận rõ.
- **B1 A, B2 A, B3 A, B5 A, B6 A, B8 A.** Ghi chú: schema gắn **một loại bài cho cả bộ** (`exercise_sets.exercise_type`); `exercise_sets` chưa có version như bài viết → spec quyết cách sửa bộ đang công khai.
- **Lệch B4: chỉ A, bỏ B.** Mỗi câu có `explanation` (spec phải bắt buộc không rỗng — V1 chỉ `NOT NULL`) và B6 A hiện giải thích đó; AI giải thích riêng trùng chức năng, tốn lượt.
- **Lệch B7 (theo Codex): B — không tính giờ.** Làm lại không giới hạn; bỏ tự nộp khi hết giờ (`time_limit_seconds` để trống).
- **Lệch B9: áp cho I1 B** (bài tập không còn AI phía người học). Một hạn mức chung cho AI phía người học, 20 lượt/ngày.
- **I1 B, I2 A, I3 A, I4 A, I5 A, I6 A.** I4 A cần bảng mới.
- **F1 A … F10 A.** F4 A, F5 A cần cột mới trên `forum_posts`.
- **M1 A, M2 A, M4 A, M5 A, M6 A, M7 A. Lệch M3 (theo Codex): B — tự làm mới vài giây/lần**; nâng lên thời gian thực sau nếu còn thời gian.

### Câu hỏi bổ sung (Codex nêu, file trên chưa hỏi)

- **P11. Thanh toán thành công báo về sau khi đơn đã hết hạn (15 phút).** **A. Vẫn cấp quyền học** (người dùng đã trả tiền) / B. Không cấp, báo lỗi.
- **P12. Tác giả có được biết nền tảng giữ 20% không?** **A. Có, form đặt giá ghi một dòng “Nền tảng giữ 20%, bạn nhận X”** / B. Chưa tính hoa hồng ở module này / C. Không hiện.
- **B10. Flashcard tính kết quả thế nào?** **A. Người học tự bấm “Đã nhớ/Chưa nhớ”, lưu số đã nhớ/tổng** / B. Chỉ lật thẻ, không lưu kết quả.
- **F11. Admin/Moderator có đăng hỏi và trả lời trong diễn đàn không?** **A. Có (diễn đàn là cộng đồng, khác với việc học khóa)** / B. Không, chỉ kiểm duyệt.
- **T7. Trợ lý AI của khóa (“Hỏi AI về bài này”, ghi ở `PLAN.md`).** A. Làm bước 1 (ngữ cảnh bài đang xem) sau Ôn phỏng vấn / **B. Hoãn, chỉ làm nếu còn thời gian (cùng mức với Nhắn tin)** / C. Bỏ.

- **P13. Trên localhost, cho phép trang quay về từ cổng thanh toán xác nhận đơn (vẫn kiểm chữ ký)?** **A. Có, ghi là giới hạn của đồ án** (cổng thật không gọi được IPN về máy dev nếu không có tunnel) / B. Không, demo phải dựng tunnel. (Bổ sung 2026-11-14 từ `course-payment.directions.md` mục 7 câu 8.)

Opus rà lại 2026-11-14: giữ nguyên toàn bộ đề xuất trên; người dùng chỉ cần trả T1, xác nhận ba điểm đảo quyết định cũ (P2/P3/P6) và gật đầu phần còn lại.

## Câu trả lời của người dùng

- **2026-11-14 — Thanh toán:** P1 → tiền thật, chỉ qua ngân hàng: VietQR theo từng đơn + Admin xác nhận tay trước, sau đó tích hợp PayOS tự xác nhận (chi tiết `course-payment.directions.md` mục 8). Có hoa hồng cho nền tảng (P8 20%; P2 theo khuyến nghị: thêm doanh thu tác giả + Admin đổi tỷ lệ). P6 A: dùng YouTube vì là demo.
- Chưa trả lời: T1 (hạn chót / có phải đồ án), P3 (có cần bước đăng ký bán), các câu B, I, F, M — chưa trả lời thì lấy đề xuất ở mục trên khi tới lượt module đó.
