# <Tên module>

Trạng thái: xem [`PLAN.md`](PLAN.md). Spec do Codex viết; Claude chỉ ghi vào mục “Phản hồi”.

**Mục tiêu:** <một hai câu: kết quả cuối cùng>
**Làn:** Nhẹ / Đầy đủ
**Giai đoạn:** Backend / Giao diện (module mới: backend xong hết mới mở giao diện; xem [`PLAN.md`](PLAN.md))
**Đổi giao diện:** Có / Không

## Đường dẫn thuộc module

Chỉ được sửa các đường dẫn sau (backend, frontend, test). Ngoài danh sách là ngoài phạm vi.

- `server/...`
- `app/src/...`

## Bản đồ chi tiết

Để người code không phải tìm lại. Liệt kê cụ thể, đúng tên trong mã:

| Hiện ở đâu (file, tên class/hàm/bean) | Dùng bởi (component/trang/lớp gọi) | Đích sau thay đổi |
|---|---|---|
| ... | ... | ... |

Thêm các danh sách ngắn nếu cần: chỗ còn giá trị viết cứng (ví dụ hex), test hiện có bao phủ phần này, phụ thuộc chéo giữa các phần.

## Phạm vi

- ...

## Ngoài phạm vi

- ...

## Ràng buộc

- Được đổi API: Có / Không. Được đổi DB (Flyway mới): Có / Không.
- Giữ nguyên hành vi hiện tại: Có / Không.
- Nếu đổi giao diện: bám [`docs/UI_GUIDE.md`](../docs/UI_GUIDE.md).

## Xong khi

- [ ] <tiêu chí kiểm chứng được>
- [ ] `scripts/verify.sh` đạt (backend integration cần Docker)

## Phản hồi vòng 1 (Claude)

Đúng / Sai / Thiếu / Thừa:

## Trả lời vòng 1 (Codex)

## Phản hồi vòng 2 (Claude)

## Trả lời vòng 2 (Codex)

## Quyết định của người dùng

Chốt theo: ...
