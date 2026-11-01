# Thuật toán: tìm kiếm nhị phân và lỗi lệch một vị trí

Hiểu bất biến khoảng tìm kiếm và các test biên giúp phát hiện lỗi trong binary search.

## Bối cảnh

Tìm kiếm nhị phân giảm dần phạm vi cần xét, nhưng chỉ phù hợp khi dữ liệu có thứ tự theo điều kiện đang tìm. Lỗi thường không nằm ở ý tưởng mà ở cách cập nhật hai đầu khoảng.

## Ý tưởng chính

Ví dụ dùng khoảng đóng từ left đến right. Sau mỗi lượt, nếu giá trị giữa không phải kết quả thì loại bỏ luôn vị trí đó. Không trộn công thức của khoảng đóng với khoảng nửa mở.

## Ví dụ minh họa

```java
static int binarySearch(int[] values, int target) {
    int left = 0;
    int right = values.length - 1;

    while (left <= right) {
        int mid = left + (right - left) / 2;
        if (values[mid] == target) {
            return mid;
        }
        if (values[mid] < target) {
            left = mid + 1;
        } else {
            right = mid - 1;
        }
    }
    return -1;
}
```

## Phân tích từng bước

1. Đầu vào phải được sắp xếp tăng dần.
2. Mỗi lượt thu hẹp khoảng vì mid đã được kiểm tra.
3. Độ phức tạp thời gian là O(log n); bộ nhớ phụ của phiên bản lặp là O(1).

## Lỗi thường gặp

- Nếu có phần tử trùng, phiên bản này không bảo đảm trả vị trí xuất hiện đầu tiên.
- Đặt left = mid có thể làm vòng lặp không tiến triển.
- Sắp xếp lại dữ liệu cũng có chi phí; không bỏ qua khi tính toàn bộ bài toán.

> Code trong bài phục vụ học tập. Hãy điều chỉnh theo kiến trúc, phiên bản thư viện và quy tắc bảo mật của dự án trước khi sử dụng.

## Bài tập thực hành

Test mảng rỗng, một phần tử, phần tử đầu/cuối, không tìm thấy và nhiều phần tử trùng.

## Checklist tự kiểm tra

- Đã giải thích được đầu vào, đầu ra và giới hạn của ví dụ.
- Đã nghĩ tới dữ liệu rỗng, dữ liệu không hợp lệ và tình huống thất bại.
- Đã tách phần minh họa khỏi cấu hình và bí mật của môi trường thật.

---

**Kết luận:** Hiểu bất biến khoảng tìm kiếm và các test biên giúp phát hiện lỗi trong binary search.
