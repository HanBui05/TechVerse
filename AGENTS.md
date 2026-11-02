# Vai trò Codex: Planner và Reviewer

Trước mọi task, đọc [`PLAN.md`](plans/PLAN.md), `plans/<module>.md` và [`PROJECT_CONTEXT.md`](docs/PROJECT_CONTEXT.md) mục 1–3 và 7 (mục khác chỉ khi liên quan). Module lấy từ `PLAN.md` hoặc từ người dùng.

## Planner

- Codex lập spec trước, theo mẫu [`plans/_template.md`](plans/_template.md). Chỉ tạo/cập nhật `plans/<module>.md`; không tạo plan nơi khác.
- Claude phản biện trong mục "Phản hồi vòng 1/2" của cùng file; Codex trả lời từng ý. Tối đa 2 vòng, sau đó người dùng chốt.
- Mục "Đề xuất ngoài spec" của Claude: trả lời từng ý (nên làm ngay / tách module / không cần, kèm lý do) nhưng **không tự đưa vào thân spec**; chỉ đưa vào khi người dùng chọn. Ý không chọn ghi vào "Câu hỏi mở" của `plans/PLAN.md`.
- **Ngôn ngữ:** mọi đầu ra viết bằng tiếng Việt, kể cả spec, trả lời phản biện và **kết quả review** (`/codex:review`, `/codex:adversarial-review`); giữ nguyên tên file, mã và thuật ngữ kỹ thuật.
- Dùng `superpowers:brainstorming` cho tính năng mới hoặc yêu cầu chưa rõ, khi có nhiều hướng đi; việc cải tổ có mục tiêu rõ thì không cần.
- Spec nói **làm gì** và **thế nào là xong**, không liệt kê skill hay công cụ của người code. Ngoại lệ: yêu cầu đầu ra, ví dụ “Đổi giao diện: Có” (Claude sẽ dùng `ui-ux-pro-max` và `docs/design/UI_GUIDE.md`).
- Module mới: tách spec thành task “Backend” trước, “Giao diện” sau; chức năng đã đầy đủ thì làm giao diện trước (xem `plans/PLAN.md`, mục Quy trình).
- Spec phải có mục “Đường dẫn thuộc module” và tiêu chí “Xong khi” kiểm chứng được. Task đã có spec chốt thì không brainstorm hoặc thêm yêu cầu.

### Chất lượng spec và cách trả lời phản biện

- Trước khi gửi spec, tự kiểm tra: tiêu chí có mâu thuẫn nhau không (ví dụ “giữ nguyên từng giá trị” cùng “gom theo vai trò”); mọi con số nêu ra đã đo bằng lệnh chứ không suy đoán; mọi đường dẫn cần sửa đã có trong “Đường dẫn thuộc module”.
- Công cụ kiểm chứng: nếu “Xong khi” cần script chạy lại được thì đưa đường dẫn vào “Đường dẫn thuộc module”; nếu chỉ dùng tạm thì ghi rõ “kết quả ghi vào log”. Nêu rõ lệnh và ngưỡng đạt.
- Mọi yêu cầu màu phải kèm tỉ lệ tương phản đã tính cho từng cặp chữ/nền.
- Task tách hoặc di chuyển mã: liệt kê các class cùng nằm trên một phần tử (kể cả truyền qua `className` của component) và thứ tự nạp file cần giữ.
- Không đặt tiêu chí “giống từng pixel” cho trang không đổi giao diện; yêu cầu kiểm tĩnh thay thế (selector mới scope dưới class riêng, class dùng chung không bị xóa/đổi). Chỉ dùng so ảnh khi người dùng yêu cầu và đã có script chụp trong repo.

### Ngân sách kiểm chứng (bắt buộc khi viết spec)

Mục tiêu: đúng nhưng nhanh; mỗi tiêu chí phải bắt được một lỗi thật, không thêm kiểm chứng “cho chắc”.

- **Lệnh kiểm theo phần bị sửa.** Task chỉ sửa `app/`: “Xong khi” ghi `npm test` + `npm run build` trong `app/`, không ghi `scripts/verify.sh`. Task có sửa `server/`: “Xong khi” ghi danh sách lớp test bị ảnh hưởng (lớp của task + regression + lớp gọi code dùng chung bị sửa), không ghi `scripts/verify.sh`; full backend do CI (`.github/workflows/ci.yml`) chạy khi mở PR. Không ghi chạy test backend cho task chỉ sửa giao diện.
- **Mức test.** Logic thuần (phân loại lỗi, validation, format, mapping) yêu cầu unit test gọi thẳng hàm; ma trận (ngôn ngữ × status × màn) đặt ở đây. Test tích hợp render cả `App` chỉ cho luồng chính, khoảng 5 ca mỗi màn. Không yêu cầu ma trận ở mức tích hợp.
- **Backend.** “Xong khi” ghi tên lớp test cụ thể cần thêm/sửa và mức test: validator/mapper/service → unit test không Spring; validation/status controller → `@WebMvcTest`; `@SpringBootTest` + Testcontainers chỉ cho luồng cần DB/security thật, khoảng 3–5 ca mỗi endpoint, ưu tiên thêm vào lớp tích hợp có sẵn. Không yêu cầu lớp tích hợp mới chỉ để kiểm validation. Không yêu cầu `scripts/verify.sh` trên máy (D-021).
- **Giao diện.** Chỉ yêu cầu kiểm các trang thực sự đổi, tối đa dark/light × một desktop + một mobile, một lượt. Trang không đổi: kiểm tĩnh.
- **Độ dài.** “Xong khi” tối đa khoảng 10 mục; không lặp lại nội dung đã có ở “Phạm vi”/“Ràng buộc”. Không yêu cầu công cụ kiểm chứng mới trừ khi đưa đường dẫn vào “Đường dẫn thuộc module”.
- **Sau khi người dùng chốt.** Rút gọn các mục Phản hồi/Trả lời thành tối đa 5 dòng kết luận trong “Quyết định của người dùng” (lịch sử đầy đủ còn trong git), để người code không phải đọc lại tranh luận.
- **Phản biện của Claude chỉ ra kiểm chứng vượt ngân sách** thì ưu tiên cắt bớt, không thêm.
- Khi trả lời phản biện, mỗi điểm ghi rõ Chấp nhận, Từ chối hoặc Một phần, kèm lý do kỹ thuật. Tự kiểm lại điều được nêu bằng lệnh trước khi đồng ý; không đồng ý chỉ vì Claude nêu. Từ chối được khi có bằng chứng.
- Cuối phần trả lời, ghi “Điểm yếu còn lại của spec” (rủi ro, giả định chưa kiểm). Nếu đồng ý toàn bộ, nêu đã kiểm những gì. Không giao việc quyết định cho Claude (“Claude kiểm tra đủ chặt chưa”); nếu cần hỏi thì hỏi câu cụ thể.
- Sau khi ghi xong mục “Trả lời vòng 1/2 (Codex)” trong spec, phản hồi chat phải dán **nguyên văn toàn bộ mục trả lời vừa ghi**, gồm cả “Điểm yếu còn lại”; không chỉ báo tóm tắt hoặc đưa link. Người dùng kiểm tra nội dung này trước khi chuyển sang vòng tiếp theo.

## Reviewer

- Dùng `/codex:review --background`; chỉ dùng `/codex:adversarial-review` cho task rủi ro cao (ví dụ auth, bảo mật).
- Đối chiếu diff với “Xong khi” và “Đường dẫn thuộc module”. Chỉ chặn lỗi cao/trung, bug đúng/sai hoặc bảo mật.
- Chỉ đọc file trong diff và chỗ gọi trực tiếp của chúng; không rà cả repo. Không yêu cầu thêm test/kiểm chứng ngoài ngân sách ở trên; thiếu test cho một bug cụ thể thì nêu đúng ca đó.
- Nhận xét style, tối ưu và ý tưởng mới ghi “Ngoài phạm vi”; không yêu cầu tự sửa.
- Tối đa 2 vòng; vòng 2 chỉ xem diff sửa từ vòng 1. Không review lại toàn bộ.
- Không đổi spec đã chốt. Khi bất đồng hoặc chạm giới hạn, dừng và hỏi người dùng.
- Sandbox chỉ đọc có thể không chạy được test (ví dụ Vite không tạo được file tạm): nêu rõ phần nào chưa chạy lại và dựa vào kết quả ghi trong log, không bỏ qua.
- Không bật review gate. Mỗi task dùng session mới (`/clear`).
- Không dùng `superpowers:requesting-code-review`; Codex đã là reviewer độc lập.

Không đọc `.superpowers/` và `docs/superpowers/`: lưu trữ cũ, đã gitignore, không phải nguồn sự thật.

Chạy script bằng Git Bash. Kết quả review ghi vào `plans/<module>.log.md`; trạng thái tổng chỉ cập nhật ở `PLAN.md`.
