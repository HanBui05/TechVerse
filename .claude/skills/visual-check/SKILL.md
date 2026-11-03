---
name: visual-check
description: Thủ tục kiểm bằng mắt giao diện TechVerse — Playwright MCP (chính: viewport thật, giả lập cảm ứng) hoặc Claude in Chrome (dự phòng); dev server, đăng nhập theo vai trò, đo bằng JS, dark/light, mobile cảm ứng, giới hạn ảnh. Dùng khi task có “Đổi giao diện: Có” cần kiểm bằng mắt, hoặc khi cần xem một trang chạy thật.
---

# Kiểm bằng mắt

Môi trường (cổng, CORS, tài khoản theo vai trò, luồng phiên) ở [`docs/RUNBOOK.md`](../../../docs/RUNBOOK.md).

## Khi nào dùng

| Tình huống | Công cụ |
|---|---|
| Logic, validation, format, mapping, hành vi theo role/label/state | Vitest + Testing Library (không mở trình duyệt) |
| Trang/component đổi giao diện: bố cục, màu dark/light, mobile, vùng chạm 44px, chữ tràn | **Playwright MCP** |
| Playwright MCP không có trong phiên, hoặc người dùng muốn xem trên Chrome/phiên đăng nhập của chính họ | Claude in Chrome |
| Chỉ sửa tài liệu/luật, `server/`, hoặc trang không đổi giao diện | Không mở trình duyệt; kiểm tĩnh |

Không viết test e2e Playwright vào repo (`app/`) — chỉ dùng để kiểm trong phiên; muốn có e2e thì phải có spec của Codex.

## Công cụ

- **Chính: Playwright MCP** (`.mcp.json`, tool `mcp__playwright__*`, trình duyệt riêng — không đụng tab/phiên của người dùng). Đổi được viewport thật và giả lập điện thoại cảm ứng (`pointer: coarse` khớp → đo được vùng chạm 44px). Đọc cây accessibility dạng chữ trước, chỉ chụp khi cần nhìn.
- **Dự phòng: Claude in Chrome** khi Playwright MCP không có trong phiên. Chrome không đổi được `innerWidth` và không giả lập cảm ứng: mobile qua `<iframe src="/route" style="width:390px;height:844px">` cùng origin (sau `document.body.innerHTML = ''`), đo qua `iframe.contentDocument`; vùng chạm ghi “chưa kiểm cảm ứng”.
- Script Playwright tạm (khi MCP chưa nạp): viết ở scratchpad, `npm i playwright` tại đó; context điện thoại `{ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }`. Không thêm Playwright vào `app/`.

## Chuẩn bị

- Cổng 3000 đã có Vite của repo (của người dùng) thì dùng chung, không tắt. Không có thì `cd <repo>/app && npm run dev -- --port 3000 --strictPort` chạy nền; xong thì tắt đúng tiến trình mình bật.
- Không khởi động lại backend của người dùng. Backend không chạy, chạy code cũ hoặc vẫn lỗi → ghi “chưa kiểm: <một dòng nguyên nhân>”.
- Đăng nhập: điền form `/login` (Playwright: điền/bấm thật; Chrome: setter `value` + sự kiện `input`, rồi submit), sau đó đổi route bằng `history.pushState` + `popstate`, không tải lại trang. Trình duyệt Playwright không có phiên sẵn → luôn đăng nhập theo vai trò cần kiểm. Vai trò chưa có tài khoản → “chưa kiểm” cho vai trò đó.

## Đo

- Trang không đổi giao diện: không chụp; chứng minh bằng kiểm tĩnh (grep selector, class dùng chung).
- Trang đổi giao diện: một lượt, đọc tối đa 2 ảnh; còn lại đo bằng JS:
  - bố cục: `getBoundingClientRect` (cột, card, sidebar 256/48px, sheet 320px), `scrollWidth > innerWidth`;
  - chữ: `letter-spacing`, `margin` của `h1` và `p` đầu trang;
  - màu: `backgroundColor`, `borderTopColor` của thẻ/khung ở cả dark và light. Đổi theme rồi tải lại trang mới đo (`getComputedStyle` ngay sau khi đổi `data-theme` có lúc trả màu cũ).
- Trang có animation vào (`animate-in`, delay): chờ ≥1,5 giây rồi mới chụp/đo.
- Ảnh lạ: kiểm ảnh đúng trang (không phải trang lỗi) trước khi kết luận.
- Hộp thoại/sheet Radix đóng có hiệu ứng: đo trạng thái đóng sau ≥1 giây.

## Mobile

- Điện thoại cảm ứng 390×844 (và 320 khi trang có sheet): kiểm `matchMedia('(pointer: coarse)').matches === true`, không cuộn ngang, mọi `a`/`button`/ô nhập trong vùng đổi ≥ 44px, chữ trong nút không tràn (`scrollWidth <= clientWidth`).
- Bẫy đã gặp: `pointer-coarse:min-w-11` của Button đè `min-w-*` của trang → nút co lại, chữ tràn. Bố cục nút trên mobile dùng `w-full`/grid, không dựa vào `min-w-*`.

## Kết thúc

Đóng tab/trình duyệt đã mở. Log ghi route đã kiểm (theme, desktop/mobile cảm ứng, công cụ) và phần “chưa kiểm” kèm lý do.
