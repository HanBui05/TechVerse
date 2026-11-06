# <Tên module>

Trạng thái: xem [`PLAN.md`](PLAN.md). Spec do Codex viết; Claude chỉ ghi vào mục “Phản hồi”.

**Mục tiêu:** <một hai câu: kết quả cuối cùng>
**Làn:** Nhẹ / Đầy đủ

Giữ file spec dưới khoảng 30 KB. Không chép lịch sử triển khai vào đây; lịch sử nằm trong log.

## Đường dẫn thuộc module

Chỉ được sửa các đường dẫn sau (backend, frontend, test). Ngoài danh sách là ngoài phạm vi.

- `server/...`
- `app/src/...`

## Ngoài phạm vi

- ...

## Ràng buộc

- Được đổi API: Có / Không. Được đổi DB (Flyway mới): Có / Không.
- Giữ nguyên hành vi hiện tại: Có / Không.

## Task <n> — <Tên task>

**Giai đoạn:** Backend / Giao diện (module mới: hoàn tất toàn bộ Backend rồi mới mở Giao diện)
**Đổi giao diện:** Có / Không

### Phạm vi

- ...

### Quy tắc nghiệp vụ và mã lỗi

Chỉ giữ mục này khi task tạo/sửa endpoint hoặc frontend gọi endpoint.

| Trường / tình huống | Ràng buộc | HTTP / mã lỗi | Copy hiển thị |
|---|---|---|---|
| ... | ... | ... | ... |

### Kế hoạch thực thi

Tối đa 40 dòng cho cả mục; chỉ ghi thông tin giúp người code bắt đầu ngay.

- **File cần đụng:** `<file/class/hàm>` — <thay đổi chính>.
- **Phần dùng lại:** `<component/service/test/helper>` — <cách dùng>.
- **Bẫy đã biết:** <caller, class cùng phần tử, thứ tự nạp file, transaction, validation hoặc tương thích cần giữ>.

### Copy vi/en

Chỉ có trong task Giao diện; xóa khỏi task Backend.

| Khóa / trạng thái | vi | en |
|---|---|---|
| ... | ... | ... |

### UI

Chỉ có trong task Giao diện; xóa khỏi task Backend. Bám [`docs/design/UI_GUIDE.md`](../docs/design/UI_GUIDE.md); nêu trạng thái, responsive và cặp chữ/nền cần kiểm tương phản.

- ...

### Xong khi

Tối đa khoảng 10 mục, theo “Ngân sách kiểm chứng” trong `AGENTS.md`/`CLAUDE.md` và `.claude/rules/`. Logic thuần → unit test; tích hợp chỉ luồng chính.

- [ ] <tiêu chí kiểm chứng được>
- [ ] Chỉ sửa `app/`: các file test liên quan `<file1.test.tsx>`, `<file2.test.tsx>` + `npm run build` trong `app/` đạt (không chạy full `npm test`). Có sửa `server/`: các lớp test bị ảnh hưởng `<Lớp1>`, `<Lớp2>` đạt (cần Docker); full backend do CI chạy khi mở PR, không chạy `scripts/verify.sh`. Xóa dòng không áp dụng.

Trong lần đồng bộ cuối module, thu mỗi task người dùng đã nhận còn 1–2 dòng: ngày nhận, link tới phần tương ứng trong `plans/<module>.log.md` và commit.

## Phản hồi vòng 1 (Claude)

Đúng / Sai / Thiếu / Thừa:

### Đề xuất ngoài spec (không chặn chốt)

Tối đa ~3 ý; mỗi ý: lợi ích, công sức, làm ngay hay tách module sau.

## Trả lời vòng 1 (Codex)

## Phản hồi vòng 2 (Claude)

## Trả lời vòng 2 (Codex)

## Quyết định của người dùng

Chốt theo: ...

Sau khi chốt, chuyển nguyên bốn mục “Phản hồi/Trả lời vòng 1/2” sang `plans/<module>.review.md`; spec chỉ giữ tối đa 5 dòng kết luận tại mục này. Không áp dụng hồi tố cho spec module cũ.
