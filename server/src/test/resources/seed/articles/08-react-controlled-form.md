# React: form có kiểm soát và chống bấm lưu liên tục

Kết hợp state hiển thị với ref khóa thao tác để tránh gửi nhiều request do nhấp nhanh.

## Bối cảnh

Nút disabled giúp người dùng hiểu form đang xử lý, nhưng state chỉ thay đổi ở lần render tiếp theo. Với thao tác quan trọng, một ref có thể chặn lời gọi lặp ngay trong cùng nhịp xử lý.

## Ý tưởng chính

Ví dụ dưới minh họa form tối giản. Khóa trên frontend chỉ hỗ trợ trải nghiệm; backend vẫn cần unique constraint, transaction hoặc idempotency tùy nghiệp vụ.

## Ví dụ minh họa

```jsx
import { useRef, useState } from "react";

export function TitleForm({ onSave }) {
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  async function submit(event) {
    event.preventDefault();
    if (inFlight.current || !title.trim()) return;
    inFlight.current = true;
    setBusy(true);
    try {
      await onSave(title.trim());
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <label>Tiêu đề<input value={title}
        onChange={e => setTitle(e.target.value)} /></label>
      <button disabled={busy}>Lưu</button>
    </form>
  );
}
```

## Phân tích từng bước

1. State làm giao diện cập nhật; ref lưu khóa đồng bộ giữa các lời gọi.
2. finally giải phóng khóa cả khi thao tác thất bại.
3. Component cha cần xử lý thông báo lỗi của onSave; đoạn này tập trung riêng vào cơ chế khóa.

## Lỗi thường gặp

- Chặn double-click không ngăn client khác gửi hai request.
- Không đặt mọi thứ vào useEffect khi hành động thực sự xuất phát từ nút bấm.
- Không chỉnh sửa trực tiếp state.

> Code trong bài phục vụ học tập. Hãy điều chỉnh theo kiến trúc, phiên bản thư viện và quy tắc bảo mật của dự án trước khi sử dụng.

## Bài tập thực hành

Thêm thông báo lỗi, rồi test bằng một onSave chậm và hai lần submit liên tiếp.

## Checklist tự kiểm tra

- Đã giải thích được đầu vào, đầu ra và giới hạn của ví dụ.
- Đã nghĩ tới dữ liệu rỗng, dữ liệu không hợp lệ và tình huống thất bại.
- Đã tách phần minh họa khỏi cấu hình và bí mật của môi trường thật.

---

**Kết luận:** Kết hợp state hiển thị với ref khóa thao tác để tránh gửi nhiều request do nhấp nhanh.
