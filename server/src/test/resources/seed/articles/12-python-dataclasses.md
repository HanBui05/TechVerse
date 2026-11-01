# Python: dùng dataclass để mô hình hóa kết quả đọc bài

Tổ chức dữ liệu bằng dataclass bất biến và xử lý danh sách với hàm thuần dễ kiểm thử.

## Bối cảnh

Một đối tượng dữ liệu rõ ràng giúp tránh nhầm khóa khi truyền dictionary giữa nhiều hàm. Dataclass giảm phần code khởi tạo nhưng vẫn cho phép diễn đạt mô hình.

## Ý tưởng chính

Ví dụ dùng frozen=True để ngăn gán lại trường qua thao tác thông thường. Điều đó không biến mọi đối tượng con thành bất biến sâu; vẫn cần chú ý khi trường chứa list hoặc dictionary.

## Ví dụ minh họa

```python
from dataclasses import dataclass
from typing import Iterable

@dataclass(frozen=True)
class ArticleSummary:
    title: str
    topic: str
    reading_minutes: int

def short_articles(items: Iterable[ArticleSummary]) -> list[str]:
    return [
        item.title
        for item in items
        if 0 < item.reading_minutes <= 5
    ]

articles = [
    ArticleSummary("Hiểu OOP", "Java Core", 4),
    ArticleSummary("Thiết kế hệ thống", "System Design", 12),
]

print(short_articles(articles))
```

## Phân tích từng bước

1. Type hint diễn đạt ý định nhưng Python không tự cưỡng chế mọi kiểu lúc runtime.
2. Hàm thuần không sửa dữ liệu đầu vào nên dễ kiểm tra kết quả.
3. Iterable cho phép nhận nhiều dạng nguồn dữ liệu thay vì chỉ list.

## Lỗi thường gặp

- Không dùng giá trị mặc định mutable dùng chung giữa các instance.
- Không giả định frozen=True bảo vệ mọi cấu trúc lồng nhau.
- Kiểm tra miền giá trị như reading_minutes ở ranh giới dữ liệu thật.

> Code trong bài phục vụ học tập. Hãy điều chỉnh theo kiến trúc, phiên bản thư viện và quy tắc bảo mật của dự án trước khi sử dụng.

## Bài tập thực hành

Viết test cho danh sách rỗng, thời gian bằng 0, bằng 5 và lớn hơn 5 phút.

## Checklist tự kiểm tra

- Đã giải thích được đầu vào, đầu ra và giới hạn của ví dụ.
- Đã nghĩ tới dữ liệu rỗng, dữ liệu không hợp lệ và tình huống thất bại.
- Đã tách phần minh họa khỏi cấu hình và bí mật của môi trường thật.

---

**Kết luận:** Tổ chức dữ liệu bằng dataclass bất biến và xử lý danh sách với hàm thuần dễ kiểm thử.
