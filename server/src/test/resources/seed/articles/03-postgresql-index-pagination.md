# PostgreSQL: thiết kế index cho danh sách bài viết theo topic

Đọc điều kiện lọc, thứ tự sắp xếp và EXPLAIN để chọn index phù hợp với truy vấn bài viết.

## Bối cảnh

Danh sách bài viết thường lọc theo topic và trạng thái, rồi sắp xếp theo ngày xuất bản. Index nên xuất phát từ truy vấn thật thay vì tạo cho mọi cột.

## Ý tưởng chính

Index tổng hợp có thể phục vụ một tổ hợp điều kiện cụ thể. Việc PostgreSQL có dùng nó hay không còn phụ thuộc dữ liệu, thống kê và chi phí ước lượng. Hãy kiểm tra kế hoạch trước khi kết luận index hiệu quả.

## Ví dụ minh họa

```sql
-- Thay UUID mẫu bằng topic có dữ liệu trong môi trường test.
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, title, summary, published_at
FROM techverse.articles
WHERE topic_id = '00000000-0000-0000-0000-000000000001'
  AND status = 'PUBLISHED'
ORDER BY published_at DESC, id DESC
LIMIT 20;

-- Chỉ nghiên cứu trên DB test; không tạo index trùng trong dự án.
-- Schema TechVerse đã có index topic/status/published_at.
```

## Phân tích từng bước

1. WHERE cho biết các cột lọc chính của truy vấn.
2. ORDER BY có id làm tiêu chí phụ để kết quả không đổi thứ tự khi trùng thời gian.
3. EXPLAIN ANALYZE thực thi truy vấn; chỉ dùng với thao tác và môi trường đã hiểu rõ.

## Lỗi thường gặp

- Bảng nhỏ có thể dùng sequential scan hợp lý hơn index scan.
- Index làm tăng dung lượng và chi phí ghi, không miễn phí.
- Không chạy lệnh tạo index minh họa vào production khi chưa xem các index hiện có.

> Code trong bài phục vụ học tập. Hãy điều chỉnh theo kiến trúc, phiên bản thư viện và quy tắc bảo mật của dự án trước khi sử dụng.

## Bài tập thực hành

So sánh kế hoạch với topic có ít bài và topic có nhiều bài; ghi lại số hàng thực tế và lượng buffer đọc.

## Checklist tự kiểm tra

- Đã giải thích được đầu vào, đầu ra và giới hạn của ví dụ.
- Đã nghĩ tới dữ liệu rỗng, dữ liệu không hợp lệ và tình huống thất bại.
- Đã tách phần minh họa khỏi cấu hình và bí mật của môi trường thật.

---

**Kết luận:** Đọc điều kiện lọc, thứ tự sắp xếp và EXPLAIN để chọn index phù hợp với truy vấn bài viết.
