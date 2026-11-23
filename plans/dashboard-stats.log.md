# Nhật ký dashboard stats

Trạng thái chính thức: xem [`PLAN.md`](PLAN.md). Spec: [`dashboard-stats.md`](dashboard-stats.md).

## Bắt đầu từ đây (cập nhật 2026-11-24)

- **Task tiếp:** đồng bộ spec cuối module (Codex) · Giao diện: Không
- Task 1 đã nhận (2026-11-23); Task 2, Task 2b đã nhận (2026-11-24).
- Task 2 chưa kiểm với API thật (backend người dùng đang chạy bản trước Task 1).
- Nhánh `feature/dashboard-stats` (từ `main`), Task 1, 2, 2b đã commit cục bộ, chưa push.

## Quyết định người dùng chưa có trong spec

- **2026-11-23 — Duyệt wireframe Task 2 kèm 5 điều chỉnh (`plans/dashboard-stats.wireframe.md` mục 4):** (1) dùng đúng copy đầy đủ của spec, nhãn dài xuống dòng; (2) khi đang tải lần đầu render ô thật có nhãn, chỉ thay số bằng `Skeleton` (không dùng khung `h-[88px]` cố định), ô cùng hàng cao bằng nhau, số canh đáy (`mt-auto`); (3) bấm “Tải lại” khi đã có số giữ số cũ, nút `disabled` + spinner, không quay về khung chờ, chỉ lượt mới nhất được ghi; (4) bảng doanh thu desktop dùng `<table>` có `th scope` (ô tiêu đề cột kỳ để trống với nhãn `sr-only`), mobile dùng `<dl>`, thiếu một kỳ hoặc một trường tiền thì ẩn đúng hàng/dòng đó; (5) mobile: ô lẻ cuối nhóm chiếm nửa hàng như các ô khác (không `col-span`).
- 2026-11-24 — Thêm **Task 2b: khu “Phân bổ”** (biểu đồ cột) dưới khu “Số liệu”, giữ nguyên các ô số; dùng số của API hiện có, **không đổi backend** (thay mục “Ngoài phạm vi: biểu đồ” của spec). Admin: thẻ “Nội dung đang công khai theo loại” (cột), “Chia doanh thu” (cột chồng nền tảng/tác giả theo kỳ), “Tài khoản” (tỷ lệ người dùng hoạt động/khóa, tác giả duyệt/đình chỉ/chờ); “Khu vực quản trị” ở cuối trang. Moderator: thẻ “Việc đang chờ theo hàng đợi” (4 hàng đợi + báo cáo chờ xử lý, không gồm nội dung đang ẩn) giữa ô số và thẻ hàng đợi. Dùng **shadcn `chart` (Recharts)** qua `npx shadcn@latest add chart` (đúng D-024), thêm biến `--chart-*` vào `tokens.css` lấy từ tone có sẵn (dark + light). Cần wireframe được duyệt trước khi code.
- 2026-11-24 — Duyệt wireframe Task 2b (`dashboard-stats.wireframe.md` mục 5); mục 5.5 theo khuyến nghị: thay “Chia doanh thu” bằng thẻ **“Doanh thu 30 ngày qua”** (thanh tỷ lệ tổng thu 30 ngày / toàn thời gian).

## Câu hỏi mở cho người dùng

- (không có)

## Nhật ký phiên

### 2026-11-24 — Task 2b: khu “Phân bổ” (biểu đồ)
- Người dùng nhận Task 2b (2026-11-24).
- `npx shadcn@latest add chart` (không ghi đè `card.tsx`): thêm `components/ui/chart.tsx` + `recharts` ^3.8.0. `tokens.css`: `--chart-1..3` (light = `--tone-blue/amber/purple-fg`; dark #3b82f6/#d97706/#a855f7) — `validate_palette.js` 5/5 đạt cả hai chế độ; tone dark hiện có quá nhạt nên không dùng được.
- `components/DashboardCharts.tsx` (hai trang dùng): `RankedBars` (Recharts cột ngang, xếp lớn → nhỏ, số cuối thanh, tooltip), `SplitBar` (thanh chia đoạn + chú thích số/% làm tròn kiểu largest remainder), `Meter`, `ChartCard`. Admin: khu “Phân bổ” giữa “Số liệu” và “Khu vực quản trị”; Moderator: thẻ “Việc đang chờ theo hàng đợi” trước thẻ hàng đợi. Copy mới trong `dashboardI18n.ts`.
- Test: 3 ca mới (Admin 2, Moderator 1), đỏ đúng lý do rồi xanh. Chạy `npx vitest run` 4 file dashboard + `components/ui/{focus,labels,sidebar}` → 47/47 đạt; `npm run build` đạt (chunk `AdminDashboardPage` 376 kB / gzip 111 kB do Recharts).
- Kiểm mắt (Playwright MCP, Vite 3000, đăng nhập thật, chặn 2 API dashboard trả dữ liệu mẫu vì backend người dùng vẫn bản trước Task 1): `/admin`, `/moderator` × dark/light × desktop 1440 / điện thoại cảm ứng 390: không cuộn ngang, nhãn trục/số không bị cắt, màu thanh đúng `--chart-1` từng theme, 0 lỗi/cảnh báo console; nhãn trục dài tự xuống dòng ở mobile.
- Codex vòng 1: [P2] lề phải cố định 44px cắt nhãn số lớn ở thanh dài nhất. Đúng → lề phải tính theo nhãn dài nhất (~7px/ký tự + 16px). Kiểm thêm phát hiện: thanh giá trị 0 mất nhãn số (Recharts bỏ nhãn của thanh rỗng) → `minPointSize={1}`. Kiểm mắt số lớn (1.234.567, 999.999) desktop 1440 + mobile 390 Admin/Moderator: mọi nhãn trong khung (cách mép ≥ 30px), nhãn “0” hiện. Chạy lại 7 file test: 47/47 đạt; build đạt.
- Codex vòng 2 (adversarial, phần sửa): approve, không có phát hiện.
- Lệch khác wireframe: không có. Chưa kiểm: số thật từ API (cần khởi động lại backend).

### 2026-11-23 — Task 2: Giao diện hai trang tổng quan
- Người dùng nhận Task 2 (2026-11-24).
- Wireframe: `plans/dashboard-stats.wireframe.md` (duyệt 2026-11-23 kèm 5 điều chỉnh ở mục 4).
- Code: `app/src/types/dashboard.ts` (`AdminDashboard`, `ModeratorDashboard` với mọi nhóm và trường con đều optional), `app/src/services/dashboardService.ts` (`dashboard.admin()`, `dashboard.moderator()`), `app/src/data/dashboardI18n.ts` (copy vi/en theo bảng spec + `formatCount`, `formatMoney` dùng lại `vnd()` từ `courseService.ts`), `app/src/pages/Admin/AdminDashboardPage.tsx` (export `useDashboardData`, `DashboardStatTile`; section “Số liệu” 4 nhóm + bảng/khối “Doanh thu”, giữ nguyên header và 4 ô lối tắt “Khu vực quản trị”), `app/src/pages/Moderator/ModeratorDashboardPage.tsx` (bỏ `ArticleStats`/`useArticleStats` 5 request cũ ở trang này, không đụng `ArticleStats.tsx`; thay bằng 6 ô liên kết hàng đợi + giữ thẻ “Hàng đợi kiểm duyệt” lấy `pending.articles` từ API mới).
- Test (`cd D:/work/Project/TechVerse/app && npx vitest run src/pages/Admin/AdminDashboardPage.test.tsx src/pages/Moderator/ModeratorDashboardPage.test.tsx src/services/dashboardService.test.ts src/data/dashboardI18n.test.ts` + `npm run build`): TDD viết 4 file test trước (11/11 ca đỏ đúng lý do), sau khi code đạt **11/11** (`AdminDashboardPage.test.tsx` 5/5, `ModeratorDashboardPage.test.tsx` 2/2, `dashboardService.test.ts` 2/2, `dashboardI18n.test.ts` 2/2 — 0 lỗi); `npm run build` (`tsc -b && vite build`) thành công 0 lỗi.
- Lệch khác spec: (1) thêm 4 khóa copy tiêu đề nhóm `h3` song ngữ vi/en trong `dashboardI18n.ts` theo mục 4 của prompt: `groupUsers` (“Người dùng” / “Users”), `groupAuthors` (“Tác giả” / “Authors”), `groupContent` (“Nội dung đang công khai” / “Public content”), `groupOrdersRevenue` (“Đơn hàng và doanh thu” / “Orders and revenue”); (2) hai ô liên kết đơn hàng ở Admin truyền sẵn query lọc mà `/admin/orders` đã đọc từ URL: `/admin/orders?status=ALL&transferReported=true` (sửa sau Codex vòng 1) và `/admin/orders?status=ALL&needsReconciliation=true`.
- Rà soát: thay hook tự viết `useCompactViewport` bằng `useIsMobile` có sẵn (`@/hooks/use-mobile`, mốc 768px). Chạy lại 4 file test trên: 11/11 đạt; `npm run build` đạt.
- Kiểm mắt (Playwright MCP, Vite 3000, đăng nhập thật admin/moderator dev): `/admin`, `/moderator` × dark/light × desktop 1440 / điện thoại cảm ứng 390. Backend đang chạy là bản trước Task 1 (API dashboard 500, không khởi động lại) nên chặn hai API dashboard trả dữ liệu mẫu (gồm tiền hàng tỷ). Kết quả: không cuộn ngang, không chữ tràn, mọi link/nút ≥ 44px khi cảm ứng, 0 lỗi JS, desktop dùng `<table>` / mobile `<dl>`, viền amber chỉ ở ô cần xử lý > 0.
- Codex vòng 1: [P2] ô “Đơn chờ xác nhận” đếm cả `EXPIRED` nhưng liên kết mở bộ lọc mặc định `PENDING`; [P2] bảng desktop hiện “—” cho trường doanh thu chỉ thiếu ở một kỳ. Đúng cả hai → liên kết đổi thành `/admin/orders?status=ALL&transferReported=true` (trang chỉ lọc một trạng thái; ALL không giấu đơn nào, có thể kèm đơn đã xử lý); ô thiếu để trống, “—” chỉ khi lỗi tải. Test sửa href + ca mới; 4 file: 12/12 đạt, build đạt.
- Codex vòng 2 (adversarial, phần sửa): approve, không có phát hiện.
- Chưa kiểm: hai trang với API thật (cần khởi động lại backend có code Task 1).

### 2026-11-23 — Task 1: API số liệu
- Người dùng nhận Task 1 (2026-11-23).
- `GET /api/v1/admin/dashboard`, `GET /api/v1/moderator/dashboard`: `DashboardController`, `DashboardService` (kiểm vai trò + tài khoản hoạt động như `ModeratorArticleServiceImpl.checkModerator`; số `null` → 0; vượt 2^53−1 → `IllegalStateException` → 500 `INTERNAL_ERROR` có log), `DashboardRepository` (JdbcTemplate, mỗi endpoint một câu SQL gồm các câu đếm con, `now()` lấy một lần), `DashboardResponse` (record `Admin`/`Moderator` riêng); `SecurityConfiguration` thêm matcher GET `/api/v1/moderator/dashboard`.
- Điều kiện lấy từ code nguồn: hàng đợi bài viết/khóa học = `workflow_status = PENDING` và `publication_status <> AUTHOR_DELETED`; bài tập/phỏng vấn = `status = PENDING`; đơn chờ xác nhận = `transfer_reported_at IS NOT NULL` và `PENDING`/`EXPIRED` (như `OrderRepository.findForAdmin`).
- Lệch khác spec: mọi phần nguồn đã có trong code nên không có khóa nào bị bỏ, không viết logic bỏ nhóm (và không có ca test cho nó). `SUM` rỗng quy về 0 ở service. Giao dịch thứ hai của đơn `PAID` bị trigger V15 bật cờ đối chiếu — test ghi nhận, không phải lỗi.
- Kiểm: `./gradlew test --tests 'com.techverse.server.dashboard.*'` → Controller 3/3, Service 4/4, Integration 4/4 đạt. Không chạy full backend (CI khi mở PR).
- Codex vòng 1: [P2] khoảng 7/30 ngày thiếu cận trên → bản ghi có mốc tương lai bị tính. Đúng → thêm `<= now()` cho `users.created_at` và `orders.paid_at`; test thêm người dùng và đơn `PAID` có mốc +1 giờ (chỉ tính ở tổng). Chạy lại cùng lệnh: 11/11 đạt.
- Codex vòng 2 (adversarial, phần sửa): approve, không có phát hiện.
