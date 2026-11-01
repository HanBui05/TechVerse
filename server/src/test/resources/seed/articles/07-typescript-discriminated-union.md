# TypeScript: mô hình hóa trạng thái tải dữ liệu bằng union

Dùng discriminated union để tránh tổ hợp trạng thái loading, data và error mâu thuẫn nhau.

## Bối cảnh

Nếu dùng ba biến độc lập cho loading, data và error, giao diện có thể vô tình giữ lỗi cũ khi dữ liệu mới đã về. Một mô hình trạng thái rõ ràng giúp giảm những tổ hợp không hợp lệ.

## Ý tưởng chính

Discriminated union dùng một trường nhận diện, ở đây là status. Khi kiểm tra trường này, TypeScript thu hẹp kiểu tương ứng. Điều đó không thay thế kiểm tra dữ liệu nhận từ mạng tại runtime.

## Ví dụ minh họa

```typescript
type Article = { id: string; title: string };

type RemoteData<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error"; message: string };

function describe(state: RemoteData<Article[]>): string {
  switch (state.status) {
    case "idle": return "Chưa tải";
    case "loading": return "Đang tải...";
    case "error": return state.message;
    case "success": return `Có ${state.data.length} bài viết`;
  }
}
```

## Phân tích từng bước

1. Mỗi nhánh chỉ có các trường hợp lệ cho trạng thái đó.
2. Trường data không tồn tại ở nhánh loading nên không bị đọc nhầm.
3. Generic T cho phép tái sử dụng mô hình với danh sách topic hoặc thông tin cá nhân.

## Lỗi thường gặp

- Ép kiểu bằng as không xác thực JSON trả về.
- Không tạo union quá lớn chứa toàn bộ trạng thái của cả ứng dụng.
- Không giữ token thật trong fixture để tiện thử.

> Code trong bài phục vụ học tập. Hãy điều chỉnh theo kiến trúc, phiên bản thư viện và quy tắc bảo mật của dự án trước khi sử dụng.

## Bài tập thực hành

Thêm trạng thái refreshing có dữ liệu cũ, sau đó sửa hàm describe để thể hiện rõ đang làm mới.

## Checklist tự kiểm tra

- Đã giải thích được đầu vào, đầu ra và giới hạn của ví dụ.
- Đã nghĩ tới dữ liệu rỗng, dữ liệu không hợp lệ và tình huống thất bại.
- Đã tách phần minh họa khỏi cấu hình và bí mật của môi trường thật.

---

**Kết luận:** Dùng discriminated union để tránh tổ hợp trạng thái loading, data và error mâu thuẫn nhau.
