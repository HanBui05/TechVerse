# Kế hoạch thực hiện TechVerse

Mỗi module có đúng một spec `plans/<module>.md` và một nhật ký `plans/<module>.log.md`. [`PROJECT_CONTEXT.md`](../docs/PROJECT_CONTEXT.md): Codex đọc mục 1–3, 5 trước mọi task; Claude chỉ đọc khi task đụng tới. Lý do các quyết định cũ: [`DECISIONS.md`](DECISIONS.md).

Module đang làm: [deploy-readiness](deploy-readiness.md)

<!-- Hook SessionStart của Claude đọc đúng dòng trên (dạng `[slug](slug.md)`, “—” nếu không có) để tự nạp mục “Bắt đầu từ đây” của log. Đổi module thì sửa dòng này. -->

## Trạng thái module

| Module | Spec | Trạng thái | Người thực hiện | Task hiện tại | Nhật ký |
|---|---|---|---|---|---|
| Workflow bootstrap | [spec](workflow-bootstrap.md) | Hoàn tất | Codex (pilot) | Người dùng chốt hoàn tất 2026-11-23 (code đã ở `main`). | [log](workflow-bootstrap.log.md) |
| UI foundation | [spec](ui-foundation.md) | Hoàn tất | Claude | Người dùng chốt hoàn tất 2026-11-23 (code đã ở `main`, thay bởi UI foundation v2). | [log](ui-foundation.log.md) |
| Auth login/register | [spec](auth-login-register.md) | Hoàn tất | Claude | Người dùng chốt hoàn tất 2026-11-23 (code đã ở `main`). | [log](auth-login-register.log.md) |
| User profile | [spec](user-profile.md) | Hoàn tất | Claude | Người dùng chốt hoàn tất 2026-11-23 (code đã ở `main`). | [log](user-profile.log.md) |
| Sidebar cleanup | — (làn nhẹ, D-012) | Hoàn tất | Claude | Người dùng chốt hoàn tất 2026-11-23 (code đã ở `main`). | [log](sidebar-cleanup.log.md) |
| Seed LF fix | — (làn nhẹ) | Hoàn tất | Claude | Người dùng chốt hoàn tất 2026-11-23 (`.gitattributes` đã ở `main`). | — |
| Forgot password UI | — (làn nhẹ, 2026-11-02) | Hoàn tất | Claude | Người dùng chốt hoàn tất 2026-11-23 (`ForgotPasswordPage` đã ở `main`). | — |
| Docs + `.claude` restructure | — (làn nhẹ, 2026-11-02) | Hoàn tất | Claude | Người dùng chốt hoàn tất 2026-11-23. | — |
| Sidebar + login redirect | — (làn nhẹ, 2026-11-02) | Hoàn tất | Claude | Người dùng chốt hoàn tất 2026-11-23 (code đã ở `main`). | — |
| Course free | [spec](course-free.md) | Hoàn tất | Claude | Mọi task đã nhận (2026-11-10), spec đồng bộ 2026-11-14; PR #4 đã merge vào `main` 2026-11-15, CI đạt. Các mục chưa kiểm: xem log. | [log](course-free.log.md) |
| Course payment | [spec](course-payment.md) | Hoàn tất | Claude | Task 1a–1d, 2a–2c đã nhận; spec đồng bộ 2026-11-16. Các mục chưa kiểm và lỗi test có sẵn: xem spec và log. | [log](course-payment.log.md) |
| Author payout | [spec](author-payout.md) | Hoàn tất | Claude | Task 1a–1d, 2a–2c đã nhận; spec đồng bộ 2026-11-16. Các mục chưa kiểm và review Task 1b: xem spec và log. | [log](author-payout.log.md) |
| PayOS checkout | [spec](payos-checkout.md) | Hoàn tất | Claude | Task 1a, 1b và 2 đã nhận; spec đã đồng bộ 2026-11-17. Các mục chưa kiểm: xem spec và log. | [log](payos-checkout.log.md) |
| Course AI tutor | [spec](course-ai-tutor.md) | Hoàn tất | Claude | Task 1 (Backend) và Task 2 (Giao diện) đã nhận, spec đồng bộ 2026-11-17; PR #10 đã merge vào `main` 2026-11-17, CI đạt. Các mục chưa kiểm: xem spec và log. | [log](course-ai-tutor.log.md) |
| Exercise practice | [spec](exercise-practice.md) | Hoàn tất | Claude | Task 1a–2c đã nhận; spec đồng bộ 2026-11-20. Các mục chưa kiểm: xem spec và log. | [log](exercise-practice.log.md) |
| Interview practice | [spec](interview-practice.md) | Hoàn tất | Claude | Task 1a–1c (2026-11-20), 2a–2b (2026-11-21) đã nhận; spec đồng bộ 2026-11-21; PR #13 đã merge vào `main` 2026-11-21, CI đạt. Các mục chưa kiểm: xem spec và log. | [log](interview-practice.log.md) |
| Forum & reports | [spec](forum-reports.md) | Hoàn tất | Claude | Task 1a–1c (2026-11-21), 2a–2b (2026-11-22) đã nhận; spec đồng bộ 2026-11-22; PR #14 đã merge vào `main` 2026-11-22, CI đạt. Các mục chưa kiểm: xem spec và log. | [log](forum-reports.log.md) |
| Dashboard stats | [spec](dashboard-stats.md) | Đã chốt | Claude | Spec chốt 2026-11-15 (6 câu hỏi mở giữ mặc định; Codex phản biện một vòng); làm sau cùng, khi các module nguồn đã code. | — |
| Messaging | [spec](messaging.md) | Hoàn tất | Claude | Task 1a–1c, 2a–2b đã nhận và spec đồng bộ 2026-11-22; Task 2b nhận không qua Codex review. PR #15 đã merge vào `main` 2026-11-23, CI đạt. Các mục chưa kiểm: xem spec và log. | [log](messaging.log.md) |
| Deploy readiness | — (làn nhẹ, [brief](deploy-readiness.md), 2026-11-23) | Đang thực hiện | Claude | Task 1 (chia code frontend) và Task 2 (cấu hình Railway + RUNBOOK) đã nhận 2026-11-23; chờ deploy thật khi có tên miền. Làm trước Dashboard stats. | [log](deploy-readiness.log.md) |
| AI docs optimization | — (làn nhẹ, [brief](ai-docs-optimization.brief.md), 2026-11-13) | Đang thực hiện | Claude | Câu hỏi mục 5 đã trả lời 2026-11-14. Làm một phần (`PLAN.md` ≤ 60 dòng, có `DECISIONS.md`); còn: rút gọn `PROJECT_CONTEXT.md` (169 dòng), chuyển module xong vào `plans/archive/`, job frontend trong CI. | — |

Đã xong: Author profile (Backend) — [spec](author-profile.md), [log](author-profile.log.md) · UI foundation v2 (shadcn) — [spec](ui-foundation-v2.md), [log](ui-foundation-v2.log.md) · Article flow (2026-11-04, PR #2) — [spec](article-flow.md), [log](article-flow.log.md) · AI assist (2026-11-06, PR #3) — [spec](ai-assist.md), [log](ai-assist.log.md).

Trạng thái hợp lệ: `Đề xuất` → `Đang lập kế hoạch` → `Chờ người dùng chốt` → `Đã chốt` → `Đang thực hiện` → `Đang review` → `Chờ người dùng nhận kết quả` → `Hoàn tất`; dùng `Bị chặn` khi không thể tạo ra kết quả để bàn giao vì cần quyết định hoặc môi trường bên ngoài. **Trạng thái chỉ ghi ở bảng này**; ai hoàn thành task thì cập nhật dòng của mình.

## Quy trình riêng của bảng này

- **Làn đầy đủ (đổi vai 2026-11-14, D-030):** Claude viết spec theo [`_template.md`](_template.md) → Codex phản biện tối đa 2 vòng → người dùng chốt (`course-payment` do Codex viết trước đó, giữ nguyên). **Làn nhẹ:** việc cơ học, rủi ro thấp (đổi tên, di chuyển file, sửa tài liệu) — một dòng ở bảng, không spec, Claude làm, Codex review một lần. Người dùng quyết task vào làn nào.
- **Backend trước, giao diện sau** cho chức năng mới: chỉ mở task giao diện khi toàn bộ backend của module xong (API + test đạt); thiếu endpoint thì mở task backend bổ sung trong spec, không sửa backend trong task giao diện. Chức năng đã đầy đủ: sửa giao diện trước.
- **Cổng wireframe cho mọi giao diện (người dùng chốt 2026-11-16):** module nào có task “Đổi giao diện: Có” thì sau backend phải có `plans/<module>.wireframe.md` được người dùng duyệt rồi mới code giao diện; áp cả cho spec đã chốt trước đó ghi “không làm wireframe” (`exercise-practice`, `interview-practice`, `forum-reports`, `dashboard-stats`, `messaging`, `course-ai-tutor` nếu có giao diện); riêng `interview-practice` đã được người dùng bỏ cổng này ngày 2026-11-20 và `messaging` ngày 2026-11-22.
- Người dùng quyết định tại bốn cổng: chốt plan; bất đồng giữa các AI; chạm giới hạn vòng; nhận kết quả cuối.

## Câu hỏi mở

- **Lộ trình đến hạn 2026-11-28 (người dùng chốt 2026-11-14, câu trả lời ở [`roadmap.questions.md`](roadmap.questions.md)):** mỗi module Claude spec → Codex phản biện (D-030) → người dùng chốt → code. Dự kiến: `course-payment` + `course-ai-tutor` 14–19/11 (PayOS hoãn 2026-11-14, không làm) → bài tập + AI 19–21/11 → ôn phỏng vấn 22–23/11 → diễn đàn + báo cáo 24–25/11 → số liệu dashboard 26/11 → nhắn tin 27/11 nếu còn thời gian (cắt đầu tiên) → 28/11 dự phòng. Trễ quá một ngày thì báo người dùng để cắt.
- **Thanh toán khóa học:** hướng ở [`course-payment.directions.md`](course-payment.directions.md) (gồm cả hướng cũ 2026-11-06 về đăng ký bán, hoa hồng, không hoàn tiền, video, trợ lý AI của khóa); người dùng đã chọn hướng (2026-11-14, mục 8: VietQR theo đơn + Admin xác nhận, sau đó PayOS; có hoa hồng; video YouTube). Tiếp: Claude tra tài liệu VietQR/PayOS (mục 9) rồi Codex viết `course-payment.md`.
- **Diễn đàn, để sau hạn (đề xuất của Codex, 2026-11-15):** thông báo cho người đăng khi bài bị ẩn (cần module thông báo); báo cáo vi phạm cho bài viết và khóa học (API báo cáo đã nhận `targetType` để mở rộng). Chờ người dùng quyết có mở module không.
- **Theo dõi chi phí AI, để sau (đề xuất của Codex khi phản biện `course-ai-tutor`, 2026-11-17):** đo mức dùng/chi phí AI tổng hợp (không chứa nội dung người học) và trần chi phí toàn hệ thống. Người dùng chọn tách module sau; chờ quyết có mở module không.
- **Menu Tác giả khi có tính năng thứ hai (2026-11-04):** đổi mục sidebar “Tác giả” thành nhóm thu gọn (Bài viết của tôi, Khóa học, sau này Doanh thu); không dựng trước.
- **Thông báo cho tác giả (2026-11-04):** báo khi bài được duyệt/trả về/ẩn/gỡ; cần module notification riêng (xem `roadmap.questions.md` T5).
- **Chẩn đoán lỗi Cloudinary (2026-11-04):** task backend reliability: log `status + error.message` của provider (không log secret), ánh xạ 401/403 sang `ARTICLE_STORAGE_UNAVAILABLE`. Chờ người dùng quyết có mở task không.
- **Tăng tốc test backend (cần spec riêng):** gom container Testcontainers singleton + thống nhất `properties` để dùng lại Spring context; có thể cắt phần lớn ~400 giây (ước tính). Chờ người dùng quyết.
- **`.superpowers/`** (lưu trữ cũ, gitignore, 21 MB): chờ người dùng quyết giữ hay xóa.
