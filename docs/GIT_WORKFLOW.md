# Quy ước làm việc với Git

Mục tiêu của quy ước này là để ba thành viên làm song song nhưng lịch sử Git vẫn rõ ràng, dễ tìm lỗi và không ghi đè code của nhau.

## 1. Nguyên tắc chính

- `main` luôn là nhánh ổn định, có thể chạy được.
- Không push trực tiếp vào `main`.
- Một nhánh `feature/...` đại diện cho **một tính năng hoàn chỉnh**, có thể chứa thay đổi ở cả `app/` và `server/`.
- Không tách nhánh theo tầng kỹ thuật như `feature/login-api` hoặc `feature/login-ui` nếu chúng cùng thuộc một tính năng.
- Không squash commit. Khi merge trên GitHub, chọn **Create a merge commit**.
- Không dùng `git push --force` cho nhánh đã chia sẻ với người khác.

Ví dụ, nhánh `feature/login-register` có thể bao gồm giao diện đăng nhập/đăng ký trong `app/`, API xác thực trong `server/`, migration cơ sở dữ liệu và test liên quan.

## 2. Đặt tên nhánh

### Nhánh tính năng

Mẫu:

```text
feature/<ten-tinh-nang>
```

Tên dùng chữ thường và gạch nối (`kebab-case`), ngắn nhưng thể hiện rõ nghiệp vụ.

Ví dụ:

```text
feature/login-register
feature/user-profile
feature/course-learning
feature/exercise-practice
feature/interview-practice
feature/forum
feature/payment
```

### Nhánh sửa lỗi hoặc việc kỹ thuật

```text
fix/<mo-ta-loi>
chore/<mo-ta-cong-viec>
```

Ví dụ:

```text
fix/login-token-expiry
chore/update-docker-config
```

### Khi nhiều người cùng làm một feature

`feature/login-register` vẫn là nhánh tích hợp của cả tính năng. Mỗi người đang làm song song tạo một nhánh đóng góp riêng từ nhánh feature đó:

```text
task/login-register-frontend
task/login-register-backend
```

Hai nhánh `task/...` được merge vào `feature/login-register`, rồi chỉ `feature/login-register` mới được merge vào `main`. Cách này giữ đúng ý nghĩa "một feature gồm FE và BE" nhưng tránh việc nhiều người push trực tiếp vào cùng một nhánh rồi phát sinh lỗi lệch lịch sử.

Nếu một người làm trọn feature thì chỉ cần `feature/...`, không cần tạo `task/...`.

## 3. Bắt đầu một feature mới

Luôn cập nhật `main` trước khi tạo nhánh:

```bash
git switch main
git pull --ff-only origin main
git switch -c feature/login-register
git push -u origin feature/login-register
```

Khi cần tạo nhánh đóng góp cho feature đang có:

```bash
git fetch origin
git switch -c task/login-register-backend origin/feature/login-register
git push -u origin task/login-register-backend
```

Không tạo nhánh mới từ một nhánh feature đã cũ ở máy mà chưa cập nhật remote.

## 4. Quy ước commit

Mẫu commit:

```text
<type>(<scope>): <mo-ta-ngan>
```

`<type>` nên dùng một trong các giá trị sau:

| Type | Khi dùng |
| --- | --- |
| `feat` | Thêm chức năng mới |
| `fix` | Sửa lỗi |
| `refactor` | Chỉnh cấu trúc code, không đổi nghiệp vụ |
| `test` | Thêm hoặc sửa test |
| `docs` | Sửa tài liệu |
| `chore` | Cấu hình, dependency, Docker, CI, việc bảo trì |

`<scope>` là module/nghiệp vụ bị ảnh hưởng, không phải tên người làm: `auth`, `user`, `course`, `exercise`, `interview`, `forum`, `payment`, `server`, `app`.

Ví dụ tốt:

```text
feat(auth): add registration endpoint
feat(auth): add registration form
fix(auth): prevent duplicate email registration
test(auth): add registration integration test
refactor(user): simplify profile mapper
chore(server): configure redis connection
```

Tránh các commit không thể hiện nội dung như:

```text
done
update
fix bug
code mới
```

Mỗi commit chỉ nên gói một mục đích rõ ràng. Ví dụ, không gộp "thêm đăng ký", "sửa Docker" và "đổi giao diện profile" vào một commit.

## 5. Vòng lặp làm việc hằng ngày

Trước khi bắt đầu làm trên nhánh đang dùng:

```bash
git pull --ff-only origin <ten-nhanh>
```

Sau khi hoàn thành một phần việc nhỏ:

```bash
git status
git add app/... server/...
git diff --cached
git commit -m "feat(auth): add registration endpoint"
git pull --ff-only origin <ten-nhanh>
git push origin <ten-nhanh>
```

`git diff --cached` là bước tự kiểm tra: chỉ commit đúng file liên quan và tuyệt đối không đưa `.env` hoặc dữ liệu cá nhân vào commit.

Nếu lệnh `git pull --ff-only` báo nhánh đã bị rẽ lịch sử, không force push. Hãy trao đổi với người đang cùng làm nhánh đó; sau đó merge thay đổi remote vào nhánh của mình và xử lý conflict cẩn thận:

```bash
git pull --no-rebase origin <ten-nhanh>
```

## 6. Đưa feature vào `main`

Trước khi tạo Pull Request, cập nhật nhánh feature với `main` để phát hiện conflict sớm:

```bash
git switch feature/login-register
git fetch origin
git merge origin/main
```

Sau khi xử lý conflict (nếu có), chạy test/build phù hợp, commit phần merge nếu Git yêu cầu và push nhánh feature.

Tạo Pull Request:

```text
feature/login-register  ->  main
```

Nhóm không bắt buộc review, nhưng người tạo PR phải tự kiểm tra phần Files changed và kết quả CI/test trước khi merge. Trên GitHub chọn **Create a merge commit** để giữ lại các commit có ý nghĩa.

Khi feature có nhánh `task/...`, merge theo thứ tự:

```text
task/login-register-frontend ─┐
                              ├─> feature/login-register ─> main
task/login-register-backend  ─┘
```

Sau khi merge vào `main`, mọi thành viên cập nhật máy local:

```bash
git switch main
git pull --ff-only origin main
```

## 7. Quy tắc an toàn ngắn gọn

- Luôn `git status` trước khi đổi nhánh, pull hoặc commit.
- Không dùng `git reset --hard` hay `git push --force` trên code chung.
- Không commit `.env`, password, token hoặc file build (`node_modules`, `.next`, `build`).
- Chỉ merge một feature khi nó đã build/test được ở mức phù hợp với phần thay đổi.
- Khi không chắc một lệnh Git sẽ làm gì, dừng lại và hỏi cả nhóm trước khi chạy.

