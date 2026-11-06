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
# lần đỏ: chỉ các ca mới, dừng ở lỗi đầu
cd server && ./gradlew test --fail-fast --tests '<Lớp>.<ca1>' --tests '<Lớp>.<ca2>'
```

- Không `clean` (mất cache build). Test tích hợp cần Docker: `docker info` trước khi chạy.
- Lần đỏ: xác nhận lỗi đúng lý do rồi mới sửa code.

## 2. Đọc lỗi mà không dán cả log

```bash
cd server/build/test-results/test
grep -l '<failure' TEST-*.xml                                  # lớp có lỗi
grep -h -A3 '<failure' TEST-*.xml | grep -E 'message=|at com.techverse' | head -20
```

Số đạt/lỗi từng lớp (dùng ghi log, không cần mở report):

```bash
cd server && for f in build/test-results/test/TEST-*Ai*.xml build/test-results/test/TEST-*AuthorArticleIntegrationTest.xml; do
  echo "$(basename $f .xml) $(grep -o 'tests="[0-9]*" skipped="[0-9]*" failures="[0-9]*" errors="[0-9]*"' $f | head -1)"; done
```

Chỉ chạy vài ca của lớp tích hợp lớn: `--tests '<Lớp>.aiOutline*'` (wildcard theo tên phương thức).

## Bẫy đã gặp (đừng lặp lại)

- `List.of(...).contains(null)` ném NPE → kiểm null bằng `stream().anyMatch(Objects::isNull)`.
- Stub lại method đã stub ném lỗi: dùng `doThrow(...).when(mock).m(...)`, không `when(mock.m(...))` (gọi stub cũ → ném).
- Helper trong test không đặt tên `post`/`get` (che `MockMvcRequestBuilders`).
- Exception OpenAI SDK trong test: `UnexpectedStatusCodeException.builder().statusCode(n).headers(Headers.builder().build()).error(Optional.empty()).build()`.
- `@WebMvcTest` không nạp `SecurityConfiguration`: cần `@Import` lớp `@EnableMethodSecurity` + `.with(jwt()...).with(csrf())`; CORS/matcher kiểm ở test tích hợp. Mẫu: `ai/AuthorAiControllerTest`.
- Lua Redis: test bằng Redis Testcontainers không Spring (`LettuceConnectionFactory` trực tiếp), mẫu `ai/AiRateLimitServiceTest`.
- Thời gian trong service: inject `Clock` (bean ở `AiAssistConfiguration`), test dùng `MutableClock` của `AiRateLimitServiceTest`.

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
