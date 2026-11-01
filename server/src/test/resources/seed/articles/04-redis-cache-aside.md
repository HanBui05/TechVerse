# Redis: hiểu cache-aside và TTL qua thông tin topic

Mô tả luồng đọc cache, đọc database khi miss và xóa cache sau khi cập nhật dữ liệu.

## Bối cảnh

Cache giúp giảm những lần đọc lặp lại, nhưng nó tạo thêm một bản sao của dữ liệu. Cần quyết định cache có thể cũ bao lâu và phải làm gì khi nguồn dữ liệu thay đổi.

## Ý tưởng chính

Với cache-aside, ứng dụng kiểm tra cache trước. Khi cache miss, ứng dụng đọc database và ghi kết quả vào cache với TTL. Pseudocode dưới đây minh họa luồng, không phải chức năng cache đã được cài trong TechVerse.

## Ví dụ minh họa

```text
readTopic(topicId):
    key = "topic:" + topicId
    cached = redis.get(key)
    if cached exists:
        return deserialize(cached)

    topic = database.findTopic(topicId)
    if topic does not exist:
        return NOT_FOUND

    redis.set(key, serialize(topic), ttl = 60 seconds)
    return topic

updateTopic(topicId, changes):
    database.updateAndCommit(topicId, changes)
    redis.delete("topic:" + topicId)
```

## Phân tích từng bước

1. TTL giới hạn thời gian tồn tại của bản sao, không bảo đảm dữ liệu luôn mới.
2. Chỉ xóa cache sau khi giao dịch database commit thành công.
3. Đối với dữ liệu phân quyền, không tùy tiện dùng cùng mức chấp nhận stale như nội dung công khai.

## Lỗi thường gặp

- Hai request miss cùng lúc vẫn có thể đọc DB; cache-aside cơ bản không chống stampede.
- Một lần đọc cũ đang chạy có thể ghi lại cache sau lần xóa; cần chiến lược bổ sung nếu yêu cầu nhất quán cao.
- Không dùng Redis cache làm nguồn dữ liệu duy nhất cho nghiệp vụ cần lưu bền.

> Code trong bài phục vụ học tập. Hãy điều chỉnh theo kiến trúc, phiên bản thư viện và quy tắc bảo mật của dự án trước khi sử dụng.

## Bài tập thực hành

Vẽ timeline hai request: một request đọc topic trong lúc admin đổi trạng thái; chỉ ra nơi có thể xuất hiện cache cũ.

## Checklist tự kiểm tra

- Đã giải thích được đầu vào, đầu ra và giới hạn của ví dụ.
- Đã nghĩ tới dữ liệu rỗng, dữ liệu không hợp lệ và tình huống thất bại.
- Đã tách phần minh họa khỏi cấu hình và bí mật của môi trường thật.

---

**Kết luận:** Mô tả luồng đọc cache, đọc database khi miss và xóa cache sau khi cập nhật dữ liệu.
