---
name: plan-review
description: Thủ tục Claude phản biện spec do Codex viết trong plans/<module>.md (Phản hồi vòng 1/2, Đề xuất ngoài spec). Dùng khi người dùng hoặc PLAN.md yêu cầu Claude phản biện/review một spec, trước khi spec được chốt.
---

# Phản biện spec

- **Khi plan:** Codex viết spec trước. Claude không viết hay sửa phần plan; chỉ ghi phản hồi (đúng, sai, thiếu, thừa) vào mục "Phản hồi vòng 1/2" của chính file spec, dùng Ponytail `ultra`. Tối đa 2 vòng rồi người dùng chốt. Không dùng `brainstorming` ở bước phản biện.
- **Đề xuất ngoài spec (vòng 1):** ngoài đúng/sai/thiếu/thừa, chủ động tìm thứ spec chưa nghĩ tới mà đáng có (chức năng, trải nghiệm, rủi ro tương lai) và ghi tối đa ~3 ý vào mục "Đề xuất ngoài spec". Mỗi ý: lợi ích, công sức ước tính, làm ngay hay tách module sau. Mục này không chặn chốt spec; người dùng chọn ý nào thì Codex đưa vào spec, ý còn lại ghi vào "Câu hỏi mở" của `PLAN.md`. "Thiếu" chỉ dành cho lỗ hổng phải sửa.
- Đối chiếu spec với code thật trước khi viết (đường dẫn, số lượng, tên component); ghi “Đúng/Sai/Thiếu/Thừa” kèm bằng chứng ngắn.
- Spec đòi kiểm chứng vượt ngân sách trong `CLAUDE.md` thì nêu ra ở phản hồi.
- Spec có đụng API mà thiếu bảng “Quy tắc nghiệp vụ và mã lỗi” (xem `AGENTS.md`) thì ghi vào “Thiếu”.
- **Ranh giới task:** với mỗi kiểu/cột/enum spec xóa hoặc đổi tên, grep caller thật; caller thuộc task sau mà task trước buộc phải sửa tạm để biên dịch, hoặc ràng buộc DB/test của task trước cần chức năng của task sau (vd. CHECK bắt bài PUBLISHED có snapshot trong khi APPROVE tạo snapshot thuộc task sau), thì ghi “Thiếu”: spec phải nói rõ phần nào làm sớm và lớp test nào được phép hỏng tới task nào.
- **Chi tiết để ngỏ:** chỉ ra chỗ spec nêu kết quả mà không nêu cách hoặc chi phí (vd. kiểm “ảnh managed” có gọi dịch vụ ngoài không, tham số phân trang dùng DTO nào, field cũ còn giữ cho UI cũ không) để Codex chốt trước, tránh Claude tự chọn khi code.
