# Git teamwork: tạo feature branch và đồng bộ main an toàn

Thực hành tên branch, commit message và merge mà không dùng force push để giải quyết nhầm xung đột.

## Bối cảnh

Nhóm nhỏ vẫn cần quy ước rõ. Một nhánh nên có mục tiêu dễ hiểu, commit mô tả thay đổi cụ thể và quá trình merge giữ lại được lịch sử làm việc.

## Ý tưởng chính

Ví dụ theo tên feature mang tính nghiệp vụ, dùng được cho cả frontend và backend. Trước khi đổi nhánh cần kiểm tra thay đổi chưa commit để không mang nhầm code sang nhiệm vụ khác.

## Ví dụ minh họa

```bash
git status
git switch main
git pull --ff-only origin main
git switch -c feature/article-bookmarks

# Sau khi hoàn thành phần thay đổi và tự kiểm tra:
git add app/src server/src
git commit -m "feat(bookmarks): add save and unsave article"
git push -u origin feature/article-bookmarks

# Tích hợp khi nhóm đã thống nhất và working tree sạch:
git switch main
git pull --ff-only origin main
git merge feature/article-bookmarks
git push origin main
```

## Phân tích từng bước

1. feat, fix, refactor và test giúp nhận diện mục đích của commit.
2. git add trong ví dụ cần được điều chỉnh theo file thực sự thuộc nhiệm vụ.
3. Khi --ff-only báo lệch lịch sử, dừng để xem graph trước khi chọn cách tích hợp.

## Lỗi thường gặp

- Không dùng push --force lên main để xử lý non-fast-forward.
- Không commit .env, key dịch vụ hoặc token đăng nhập.
- Không xóa thay đổi của người khác để làm working tree sạch.

> Code trong bài phục vụ học tập. Hãy điều chỉnh theo kiến trúc, phiên bản thư viện và quy tắc bảo mật của dự án trước khi sử dụng.

## Bài tập thực hành

Viết ba commit message cho tạo bài viết, sửa upload ảnh bìa và thêm test refresh đồng thời.

## Checklist tự kiểm tra

- Đã giải thích được đầu vào, đầu ra và giới hạn của ví dụ.
- Đã nghĩ tới dữ liệu rỗng, dữ liệu không hợp lệ và tình huống thất bại.
- Đã tách phần minh họa khỏi cấu hình và bí mật của môi trường thật.

---

**Kết luận:** Thực hành tên branch, commit message và merge mà không dùng force push để giải quyết nhầm xung đột.
