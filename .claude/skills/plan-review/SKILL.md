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
