---
name: backend-test
description: Chạy và đọc kết quả test backend TechVerse (Spring Boot, Gradle, Testcontainers) nhanh nhất. Dùng khi làm TDD trong server/, khi cần chạy một lớp test, khi verify.sh báo lỗi backend, hoặc khi cần biết lớp test nào chậm.
---

# Test backend TechVerse

Chạy bằng Git Bash từ thư mục gốc repo.

## 1. Trong vòng TDD: chỉ chạy lớp của task

```bash
cd server && ./gradlew test --tests 'com.techverse.server.<gói>.<Lớp>'
# một phương thức: --tests '<Lớp>.<tênPhươngThức>'
```

- Không `clean` (mất cache build). Test tích hợp cần Docker: `docker info` trước khi chạy.
- Lần đỏ: xác nhận lỗi đúng lý do rồi mới sửa code.

## 2. Đọc lỗi mà không dán cả log

```bash
cd server/build/test-results/test
grep -l '<failure' TEST-*.xml                                  # lớp có lỗi
grep -h -A3 '<failure' TEST-*.xml | grep -E 'message=|at com.techverse' | head -20
```

## 3. Cuối task: chỉ lớp bị ảnh hưởng

```bash
cd server && ./gradlew test --tests '<LớpTask>' --tests '<LớpRegression>' ...
```

Danh sách lớp: lớp của task + regression spec nêu + lớp gọi code dùng chung đã sửa (grep caller).

## 4. Chỉ khi người dùng yêu cầu: verify full, chạy nền

Full backend đã do CI chạy khi mở PR; trên máy chỉ chạy khi cần tái hiện lỗi CI.

```bash
bash scripts/verify.sh > "<scratchpad>/verify.log" 2>&1; echo "exit=$?"
grep -E "tests completed|BUILD|Test Files|Tests  |built in" "<scratchpad>/verify.log"
```

Chạy bằng Bash `run_in_background`; chờ thông báo, không theo dõi liên tục. Toàn bộ mất khoảng 8–10 phút.

## 5. Khi cần biết lớp nào chậm

```bash
cd server/build/test-results/test && for f in TEST-*.xml; do
  t=$(grep -o 'testsuite [^>]*' "$f" | grep -o 'time="[0-9.]*"' | head -1 | tr -dc '0-9.')
  echo "$t ${f#TEST-com.techverse.server.}"; done | sort -rn | head -10
```

## Ghi log

Chỉ ghi lệnh, số test đạt/lỗi và dòng lỗi đầu tiên vào `plans/<module>.log.md`; không dán output.
