# Article flow — Wireframe cổng UI 2a–2d

Trạng thái: **người dùng đã duyệt 2026-11-04** (quyết định ở `article-flow.log.md`). Task 2a–2d code theo file này + spec. Chỉ chốt bố cục; mọi nút/số liệu đều có endpoint trong spec, không thêm chức năng.

## Phong cách (người dùng chốt 2026-11-04)

- **Reader (`/blogs`, `/blogs/:id`, `/blogs/saved`):** bám mẫu javabuilder.online theo số đo `docs/design/javabuilder-patterns.md` 4.1 (header), 4.2 (card lọc), 4.3 (lưới card), 4.4 (chi tiết 2 cột); chỉ lấy bố cục/tỷ lệ/công thức màu.
- **Author và Moderator:** không có web mẫu — Claude tự thiết kế, sinh động nhưng cùng khung chung (Sidebar, `max-w-7xl`, card bo 18, hàng trong card 4.5, chip kicker 4.1). Cách làm sinh động, chỉ bằng token/Badge tone, không gradient:
  - Ô số liệu: ô icon màu theo `statusTone` (nháp slate, chờ duyệt amber, cần sửa sky, công khai green, ẩn/gỡ rose, tổng blue), số `text-2xl font-bold`; ô đang lọc có viền + nền tone nhạt.
  - Hàng bài: thumbnail cover hoặc ô fallback tone/icon topic như card Reader; viền trái 3 px theo trạng thái cần chú ý (chờ duyệt amber, cần sửa sky, bị ẩn/gỡ rose); topic dùng `toneFor`.
  - Editor: header dính trên cùng; banner trạng thái theo tone; nhãn trường 11 px in hoa; preview dùng đúng composition Reader detail để tác giả thấy như độc giả.
  - Empty workspace: icon lớn + dải 3 chip bước “Viết → Gửi duyệt → Xuất bản” (chỉ là hướng dẫn tĩnh) + [Viết bài đầu tiên].
  - Moderator detail: chip “Đã đổi” tone amber, trường đã đổi có viền trái amber ở cột đề xuất; lịch sử dạng timeline chấm màu theo loại action (duyệt green, yêu cầu sửa sky, ẩn/gỡ rose, gửi/rút amber/slate).
- **Mở rộng vai trò Author sau này:** không dựng trước. Khi có tính năng tác giả thứ hai (khóa học, doanh thu), đổi mục sidebar “Tác giả” thành nhóm thu gọn; `/author/blogs` giữ nguyên.

Ký hiệu: `[Nút]` Button · `(Badge)` Badge tone · `▾` select/menu · `⋯` menu thao tác phụ (Popover danh sách nút) · `▓` Skeleton · `⟳` retry. Khung chung: Sidebar trái theo vai trò (User/Admin/Moderator), nội dung `max-w-7xl`. Desktop 1440, mobile 390 (Sidebar thành Sheet).

## Ma trận hành động Author (dùng chung workspace + editor)

Suy từ `workflowStatus` + `publicationStatus` (có snapshot ⇔ publication ≠ `UNPUBLISHED`). Không hiện hành động backend từ chối.

| Trạng thái | Chính | Trong `⋯` |
|---|---|---|
| `UNPUBLISHED` + `DRAFT/CHANGES_REQUESTED` | [Sửa] | Xóa vĩnh viễn (hard) · Lịch sử |
| `UNPUBLISHED` + `PENDING` | [Xem] | Rút lại · Lịch sử |
| `PUBLISHED` + `PUBLISHED` | [Sửa] | Xem bản công khai · Ẩn · Xóa (soft) · Lịch sử |
| `PUBLISHED` + `DRAFT/CHANGES_REQUESTED` | [Sửa] | Xem bản công khai · Hủy bản sửa · Ẩn · Xóa · Lịch sử |
| `PUBLISHED` + `PENDING` | [Xem] | Xem bản công khai · Rút lại · Ẩn · Xóa · Lịch sử |
| `AUTHOR_HIDDEN` + bất kỳ | như hàng tương ứng ở trên | Hiện lại thay cho Ẩn; không có “Xem bản công khai” |
| `HIDDEN` (Moderator ẩn) | như trên | Không Ẩn/Hiện lại; dòng ghi chú “Kiểm duyệt viên đã ẩn bài” |
| `REMOVED` | [Xem] (chỉ đọc) | Lịch sử |

Hành động nguy hiểm (Rút lại, Hủy bản sửa, Ẩn, Hiện lại, Xóa) đều qua `AlertDialog` nêu hậu quả: hard “Xóa vĩnh viễn, không khôi phục”; soft “Bài gỡ khỏi trang đọc và khỏi danh sách của bạn, không khôi phục”; Hủy bản sửa “Nội dung quay về bản công khai vN”.

## 2a-1 Workspace `/author/blogs` — desktop

```
┌ Sidebar ┬──────────────────────────────────────────────────────────────────────┐
│         │ (✎ Không gian tác giả)                                               │
│         │ Bài viết của tôi                                   [+ Viết bài mới]  │
│         │ Soạn, gửi duyệt và quản lý bài đã công khai.                         │
│         │                                                                      │
│         │ ┌Tổng 12──┐ ┌Bản nháp 3┐ ┌Chờ duyệt 2┐ ┌Cần sửa 1┐ ┌Đang công khai 6┐│
│         │ └─────────┘ └──────────┘ └───────────┘ └─────────┘ └────────────────┘│
│         │  (ô số liệu bấm được = áp filter tương ứng)                          │
│         │ ┌ ⚲ Bộ lọc ──────────────────────────────────────── (12 bài) ┐       │
│         │ │ [⚲ Tìm theo tiêu đề......] [Chủ đề ▾] [Thẻ ▾] [Mới nhất ▾]  │       │
│         │ │ Soạn thảo: (Tất cả)(Nháp)(Chờ duyệt)(Cần sửa)(Khớp bản CK)  │       │
│         │ │ Công khai: (Tất cả)(Chưa)(Đang)(Tự ẩn)(Bị ẩn)(Đã gỡ)        │       │
│         │ └─────────────────────────────────────────────────────────────┘       │
│         │ ┌ Danh sách bài ─────────────────────────────────────────────┐       │
│         │ │ ▢cover  Tiêu đề bài viết hai dòng tối đa…                   │       │
│         │ │ 64×40   (Java) · Sửa 2 giờ trước · Công khai 03/11          │       │
│         │ │         (Đang công khai)(Bản nháp)(● Có thay đổi chưa gửi)   │       │
│         │ │                                         [Sửa]  [⋯]           │       │
│         │ ├─────────────────────────────────────────────────────────────┤       │
│         │ │ ▢  Bài chờ duyệt…  (Chưa công khai)(Chờ duyệt)  [Xem] [⋯]   │       │
│         │ ├─────────────────────────────────────────────────────────────┤       │
│         │ │ ▢  Bài bị ẩn…  (Bị ẩn)(Khớp bản CK)                         │       │
│         │ │    ⓘ Kiểm duyệt viên đã ẩn bài                  [Sửa] [⋯]   │       │
│         │ └─────────────────────────────────────────────────────────────┘       │
│         │                         ‹ 1 2 3 ›                                    │
└─────────┴──────────────────────────────────────────────────────────────────────┘
```

- Số liệu = `totalElements` của `GET /author/articles?size=1&<filter>` (5 request song song, như `ArticleStats` Moderator hiện tại). “Tổng” không gồm `AUTHOR_DELETED` (backend đã loại).
- Bấm hàng (ngoài nút) = mở editor. “Lịch sử” trong `⋯` mở Sheet lịch sử (xem 2a-5).
- **Mobile:** ô số liệu thành dải cuộn ngang 2 hàng lưới 2 cột (không tràn trang); select xếp dọc; hàng bài: cover ẩn, badge xuống dòng, nút [Sửa][⋯] cao 44 px ở cuối hàng.

**Trạng thái:** loading = 5 ô `▓` + 5 hàng `▓`. Empty chưa có bài = `EmptyState` (icon bút) “Bạn chưa có bài viết nào” + [Viết bài đầu tiên]. Empty theo filter = “Không có bài khớp bộ lọc” + [Xóa bộ lọc]. Error = Card lỗi copy theo mã + [⟳ Thử lại]; lỗi một ô số liệu chỉ hiện “—”.

## 2a-2 Editor `/author/blogs/new`, `/author/blogs/:id/edit` — desktop

```
┌ Sidebar ┬──────────────────────────────────────────────────────────────────────┐
│         │ ‹ Bài viết của tôi                                                   │
│         │ Sửa bài  (Đang công khai)(Bản nháp)   Đã lưu 10:42  [Lưu nháp][Gửi duyệt][⋯]│
│         │ ┌ banner theo trạng thái (tối đa 1) ──────────────────────────────┐  │
│         │ │ ⓘ Độc giả vẫn đọc bản công khai v3. Bản sửa chỉ thay khi duyệt. │  │
│         │ └─────────────────────────────────────────────────────────────────┘  │
│         │ ┌ Thông tin bài ─────────────────────────────────── [Thu gọn ▴] ┐  │
│         │ │ TIÊU ĐỀ  [______________________________________________]       │  │
│         │ │ CHỦ ĐỀ [Java ▾]   THẺ (3/10) [TagPicker…………………………]          │  │
│         │ │ TÓM TẮT [textarea 2 dòng………………………………………] 120/500           │  │
│         │ │ ẢNH BÌA [▢ thumbnail] [Tải ảnh bìa] [Bỏ]                         │  │
│         │ └─────────────────────────────────────────────────────────────────┘  │
│         │ ┌ ⚠ 3 ảnh cần tải lên ─────────────────────────── [Xem 3 ảnh ▾] ┐  │
│         │ │ alt "sơ đồ" · ./img/a.png · dòng 12 cột 3 [Tải ảnh thay thế][Bỏ ảnh]│
│         │ │ alt ""      · https://x/b.jpg · dòng 40   ⚠ File >5 MiB [Thử lại]│  │
│         │ │ [Chọn nhiều ảnh – tự ghép theo tên file]                          │  │
│         │ └─────────────────────────────────────────────────────────────────┘  │
│         │ ┌ Nội dung Markdown ───────────┐┌ [Xem trước | Bản công khai v3] ┐  │
│         │ │ [Nhập .md/.txt][Chèn ảnh]    ││ ▢ cover                         │  │
│         │ │                              ││ (Java)                          │  │
│         │ │ # Heading                    ││ Tiêu đề bài (H1 30)             │  │
│         │ │ textarea font mono, cao =    ││ ┃ Tóm tắt viền nhấn             │  │
│         │ │ chiều cao viewport, cuộn     ││ (tag)(tag)                      │  │
│         │ │ riêng                        ││ MarkdownContent; ảnh chưa tải = │  │
│         │ │                              ││ [▢ placeholder “Ảnh cần tải lên”]│  │
│         │ └──────────────────────────────┘└─────────────────────────────────┘  │
└─────────┴──────────────────────────────────────────────────────────────────────┘
```

- Hai cột 50/50, mỗi cột cuộn riêng; card “Thông tin bài” thu gọn được (mặc định mở với bài mới, gọn với bài đã có) để vùng viết không chật.
- Tab phải “Bản công khai vN” chỉ có khi `publishedVersion` ≠ null: render snapshot chỉ đọc để tác giả tự so. Preview không có thời gian đọc.
- Banner theo trạng thái: `CHANGES_REQUESTED` (sky) “Kiểm duyệt viên yêu cầu sửa: <note>”; `PENDING` (amber) “Đang chờ duyệt — rút lại để tiếp tục sửa” + [Rút lại], form chỉ đọc; `HIDDEN` (rose) “Kiểm duyệt viên đã ẩn bài”; `AUTHOR_HIDDEN` “Bạn đang ẩn bài” + [Hiện lại]; `REMOVED` (rose) “Bài đã bị gỡ: <note>”, toàn trang chỉ đọc, không nút ghi.
- [Gửi duyệt] khóa + tooltip/dòng phụ “Còn N ảnh cần tải lên” khi còn issue. Bài mới chưa có ID: [Tải ảnh…] khóa với dòng “Nhập tiêu đề, chủ đề và lưu nháp trước” nếu thiếu title/topic; đủ thì upload đầu tự lưu nháp.
- `⋯` theo ma trận: Rút lại · Hủy bản sửa · Ẩn/Hiện lại · Xóa · Lịch sử · Xem bản công khai (mở tab mới).
- Lỗi trường: viền `destructive` + chữ dưới trường; lỗi chung (409 stale/không sửa được) = Alert trên đầu form + [Tải lại].
- Rời trang khi có thay đổi chưa lưu: `AlertDialog` “Thay đổi chưa lưu sẽ mất” [Ở lại] [Rời trang]; đóng tab = `beforeunload`.

## 2a-3 Editor — mobile 390

```
┌──────────────────────────────┐
│ ‹ Bài của tôi            [⋯] │
│ (Đang CK)(Bản nháp)          │
│ ⓘ banner trạng thái          │
│ [ Soạn thảo | Xem trước ]    │  ← Tabs
│ ┌ Thông tin bài ▾ ────────┐  │
│ │ Tiêu đề / Chủ đề / Thẻ   │  │
│ │ Tóm tắt / Ảnh bìa        │  │
│ └──────────────────────────┘  │
│ [⚠ 3 ảnh cần tải lên  ›]     │  ← mở Sheet đáy chứa danh sách issue
│ [Nhập file][Chèn ảnh]        │
│ textarea toàn chiều rộng     │
│                              │
├──────────────────────────────┤
│ [Lưu nháp]     [Gửi duyệt]   │  ← thanh dính đáy, nút cao 44
└──────────────────────────────┘
```

Tab “Xem trước” có lựa chọn phụ “Bản công khai vN” (segmented) khi có snapshot. Không cuộn ngang; bảng/code trong preview cuộn trong khung.

## 2a-4 Editor — loading / error

- Loading (`:id/edit`): header `▓`, card metadata `▓` 4 dòng, hai cột `▓`.
- 404/không phải bài của mình: `EmptyState` “Không tìm thấy bài viết” + [Về danh sách]. Lỗi mạng/5xx: Card lỗi + [⟳ Thử lại].
- Import lỗi (415/413/400): Alert ngay dưới nút [Nhập file], copy theo mã.

## 2a-5 Sheet Lịch sử (Author; Moderator dùng cùng khung)

```
┌ Lịch sử bài viết ─────────── ✕ ┐
│ ● Duyệt · v3 · Nguyễn A        │
│   04/11 10:20                  │
│ ● Yêu cầu sửa · Nguyễn A       │
│   “Bổ sung ví dụ…”             │
│ ● Gửi duyệt · bạn              │
│ ● Tác giả ẩn bài · bạn         │
│        [Tải thêm]              │
└────────────────────────────────┘
```

Mỗi mục: nhãn action vi/en (không enum thô), actor, thời gian, note nếu có, version nếu có. Loading `▓` 4 mục; rỗng “Chưa có lịch sử”; lỗi + [⟳].

## 2b-1 Moderator dashboard `/moderator` và list `/moderator/articles`

Giữ khung Admin/Moderator hiện tại (D-029). Thay đổi:

```
│ Bài viết cần xử lý                                                      │
│ ┌Chờ duyệt 4┐ ┌Cần sửa 2┐ ┌Đang công khai 18┐ ┌Bị ẩn 1┐ ┌Đã gỡ 0┐      │
│ ┌ ⚲ Bộ lọc ─────────────────────────────────────────── (4 bài) ┐       │
│ │ [⚲ Tiêu đề…] [Tác giả ▾] [Chủ đề ▾] [Thẻ ▾] [Từ–đến 📅] [Sắp xếp ▾]│
│ │ Soạn thảo: (Tất cả)(Chờ duyệt)(Cần sửa)(Khớp bản CK)(Nháp cập nhật)│
│ │ Công khai: (Tất cả)(Chưa)(Đang)(Tự ẩn)(Bị ẩn)(Đã gỡ)               │
│ └───────────────────────────────────────────────────────────────┘     │
│ ┌ hàng ────────────────────────────────────────────────────────┐      │
│ │ (av) Tiêu đề bài…                    (Đang CK)(Chờ duyệt)     │      │
│ │      Trần B · (Java) · 2 giờ trước   (Bản cập nhật)  ›        │      │
│ │      ⚠ Tác giả không còn đủ điều kiện   (khi !authorEligible) │      │
│ └──────────────────────────────────────────────────────────────┘      │
```

- Dashboard giữ bố cục hiện có, chỉ đổi ô số liệu sang 2 trục như trên. Cả hàng là link tới `/moderator/articles/:id`; bỏ Sheet cũ. Mặc định list lọc “Chờ duyệt”.
- Mobile: chip filter cuộn ngang trong card, hàng badge xuống dòng. Loading 5 hàng `▓`; empty “Không có bài khớp bộ lọc” (+ [Xóa bộ lọc] khi có filter) / “Không còn bài chờ duyệt”; error + [⟳].

## 2b-2 Moderator detail `/moderator/articles/:id` — desktop

```
┌ Sidebar ┬──────────────────────────────────────────────────────────────────────┐
│         │ Moderator › Bài viết › Tiêu đề bài…                                  │
│         │ Tiêu đề bài viết (H1 24)                                             │
│         │ (Đang công khai v2)(Chờ duyệt) · (av) Trần B ✓ đủ điều kiện          │
│         │                [Yêu cầu sửa] [Duyệt]  [Ẩn] [Gỡ bài]   (theo trạng thái)│
│         │ ┌ Thay đổi so với v2: (Tiêu đề)(Nội dung)(Thẻ) ─ [Song song|Đề xuất|Công khai]┐
│         │ ├ Bản công khai v2 ────────────┬ Bản đề xuất ──────────────────────┤│
│         │ │ Tiêu đề cũ                   │ Tiêu đề mới        (Đã đổi)        ││
│         │ │ Tóm tắt                      │ Tóm tắt                            ││
│         │ │ (Java) (tag1)(tag2)          │ (Java) (tag1)(tag3) (Đã đổi)       ││
│         │ │ ▢ cover                      │ ▢ cover                            ││
│         │ │ MarkdownContent              │ MarkdownContent    (Đã đổi)        ││
│         │ └──────────────────────────────┴────────────────────────────────────┘│
│         │ ┌ Tác giả ─────────────┐ ┌ Lịch sử (5 mới nhất) ─── [Xem tất cả] ┐  │
│         │ │ (av) Trần B          │ │ ● Gửi duyệt · Trần B · 10:20          │  │
│         │ │ ✓ Đủ điều kiện / ⚠   │ │ ● Yêu cầu sửa · bạn · “…”             │  │
│         │ └──────────────────────┘ └────────────────────────────────────────┘  │
└─────────┴──────────────────────────────────────────────────────────────────────┘
```

- Bài chưa từng công khai: không có cột so sánh, chỉ “Bản đề xuất” rộng ~880 px; dải “Thay đổi” ẩn.
- “Đã đổi” so từng trường title/summary/cover/topic/tập tag/content (so chuỗi/ID ở client, không diff ký tự). Tác giả không đủ điều kiện: nút [Duyệt] khóa + dòng lý do.
- Nút theo trạng thái: `PENDING` → Yêu cầu sửa, Duyệt; `PUBLISHED/AUTHOR_HIDDEN` → Ẩn, Gỡ bài; `HIDDEN` → Khôi phục, Gỡ bài; `REMOVED`/`AUTHOR_DELETED` → không nút, banner “Bài đã gỡ” / “Tác giả đã xóa bài, chỉ còn để đối soát”.
- **Mobile:** nút xếp thành hàng dính đáy (cao 44, tối đa 2 nút + `⋯`); so sánh chỉ một cột theo segmented [Đề xuất|Công khai]; Tác giả + Lịch sử xuống dưới.
- Loading: header `▓` + hai cột `▓`. 404 “Không tìm thấy bài viết” + [Về danh sách]; error + [⟳].

## 2b-3 Dialog Moderator (`AlertDialog`)

```
┌ Duyệt và xuất bản ─────────────────────┐   ┌ Ẩn bài ──────────────────────────┐
│ Bản đề xuất sẽ thành v3 trên cùng URL. │   │ Bài sẽ biến khỏi trang đọc.      │
│ ┌ Lần trước trả về: “Bổ sung ví dụ…” ┐ │   │ LÝ DO (bắt buộc) [textarea]      │
│ └ (chỉ khi có, theo mốc APPROVE)     ┘ │   │ 0/2000                           │
│ GHI CHÚ (tùy chọn) [textarea] 0/2000  │   │            [Hủy] [Ẩn bài]        │
│              [Hủy] [Duyệt]            │   └──────────────────────────────────┘
└────────────────────────────────────────┘
```

- Yêu cầu sửa: ghi chú bắt buộc. Gỡ bài: lý do bắt buộc, nút `destructive`, cảnh báo “Không khôi phục được”. Khôi phục: xác nhận, ghi chú tùy chọn.
- 409 stale/transition: lỗi trong dialog “Bài đã thay đổi, hãy tải lại” + [Tải lại] (tải detail + token mới, đóng dialog). Thiếu note: lỗi dưới textarea, không gửi.

## 2c-1 Reader list `/blogs` — desktop

```
┌ Sidebar ┬──────────────────────────────────────────────────────────────────────┐
│         │ (📖 Thư viện bài viết)                                               │
│         │ Bài viết                                          [♡ Bài đã lưu]     │
│         │ Kiến thức lập trình do tác giả TechVerse chia sẻ.                    │
│         │ ┌ ⚲ Bộ lọc ─────────────────────────────────────── (42 bài) ┐        │
│         │ │ [⚲ Tìm bài viết… ⏎        ✕] [Thẻ ▾]  [Mới nhất ▾]          │        │
│         │ │ (Tất cả)(Java)(Spring)(React)(…)  ← chip topic nhanh         │        │
│         │ └──────────────────────────────────────────────────────────────┘        │
│         │ ┌ card ───────────┐ ┌ card ───────────┐ ┌ card ───────────┐         │
│         │ │ ▢ cover 16:10   │ │ ▢ fallback tone │ │                 │         │
│         │ │ (Java)  3 ngày  │ │   + icon topic  │ │                 │         │
│         │ │ Tiêu đề 2 dòng… │ │                 │ │                 │         │
│         │ │ Tóm tắt 2 dòng… │ │                 │ │                 │         │
│         │ │ (t1)(t2)(t3)+2  │ │                 │ │                 │         │
│         │ │ ⏱ 6 phút  [♡] [Đọc tiếp ›]│        │ │                 │         │
│         │ │ (av) Trần B     │ │                 │ │                 │         │
│         │ └─────────────────┘ └─────────────────┘ └─────────────────┘         │
│         │                       ‹ 1 2 3 … 7 ›                                  │
└─────────┴──────────────────────────────────────────────────────────────────────┘
```

- Grid 3/2/1 cột. Filter/page đồng bộ URL như spec. [♡] = `ArticleSaveButton` (aria-pressed, 44 px); lỗi lưu hiện dòng nhỏ ngay dưới nút trong card.
- **Mobile:** 1 cột; chip topic cuộn ngang; [♡ Bài đã lưu] thành nút icon cạnh H1.
- Loading 6 card `▓`. Empty “Không tìm thấy bài viết phù hợp” + [Xóa bộ lọc] (khi không có filter: “Chưa có bài viết nào”). Error + [⟳ Thử lại].

## 2c-2 Reader detail `/blogs/:id` — desktop

```
┌ Sidebar ┬──────────────────────────────────────────────────────────────────────┐
│         │ Bài viết › Java › Tiêu đề…                                           │
│         │ ┌ nội dung ~880 ─────────────────────────────┐ ┌ sidebar 280 sticky ┐│
│         │ │ ▢ cover bo 18                              │ │ Về tác giả         ││
│         │ │ [◼ Java]                                    │ │ (av) Trần B        ││
│         │ │ Tiêu đề bài viết (H1 30)                   │ │ Chuyên môn…        ││
│         │ │ (av) Trần B · 01/11 · Cập nhật 04/11 · ⏱ 6p │ │ Bio ≤300 ký tự…    ││
│         │ │                    [♡ Lưu] [🔗 Sao chép link]│ ├ Mục lục ───────────┤│
│         │ │ ┃ Tóm tắt (viền trái nhấn)                 │ │ ▸ Mở đầu  (đang đọc)││
│         │ │ (tag)(tag)(tag)                            │ │   Cài đặt          ││
│         │ │ ## Mở đầu  🔗                               │ │     Bước 1         ││
│         │ │ đoạn văn…                                  │ ├ Bài liên quan ─────┤│
│         │ │ ┌ java ─────────────── [Copy] ┐            │ │ ▢ Tiêu đề 2 dòng   ││
│         │ │ │ code                        │            │ │   02/11            ││
│         │ │ └─────────────────────────────┘            │ │ [Xem tất cả Java ›]││
│         │ │ bảng cuộn ngang trong khung                │ └────────────────────┘│
│         │ │ ─────────────────────────────              │                       │
│         │ │ [‹ Về danh sách]            [↑ Về đầu trang]│                       │
│         │ └────────────────────────────────────────────┘                       │
└─────────┴──────────────────────────────────────────────────────────────────────┘
```

- “Cập nhật <approvedAt>” chỉ khi `versionNumber > 1`. Sidebar cuộn riêng khi dài hơn viewport.
- **Mobile:** breadcrumb rút còn “‹ Bài viết”; mục lục thành khối thu gọn “Mục lục ▾” ngay dưới tóm tắt; Về tác giả + Bài liên quan xuống cuối bài; hàng meta xuống dòng, [♡][🔗] cao 44.
- Loading: cover `▓`, H1 `▓`, 8 dòng `▓`, sidebar `▓`. 404: `EmptyState` “Bài viết không tồn tại hoặc đã bị ẩn” + [Về danh sách]. Error khác + [⟳]. Không có related thì ẩn card đó.

## 2d Bài đã lưu `/blogs/saved`

```
┌ Sidebar ┬──────────────────────────────────────────────────────────────────────┐
│ Trang chủ│ (♡ Của bạn)                                                         │
│ Bài viết │ Bài đã lưu   (8 bài)                         [‹ Tất cả bài viết]     │
│  Bài đã  │ [⚲ Tìm trong bài đã lưu… ⏎   ✕]                                      │
│  lưu  ◀  │ ┌ card (dùng ArticleCard) ┐ ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┐ ┌ card ─┐     │
│          │ │ …            [♥ Đã lưu] │ │ Đã bỏ lưu · [Hoàn tác]  │ │       │     │
│          │ └─────────────────────────┘ │ (giữ chỗ, cao 1 dòng)   │ └───────┘     │
│          │                             └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┘               │
│          │                         ‹ 1 2 ›                                      │
└──────────┴──────────────────────────────────────────────────────────────────────┘
```

- Entry “Bài đã lưu” chỉ ở sidebar User, dưới “Bài viết”; Admin/Moderator vào qua [♡ Bài đã lưu] ở header `/blogs`.
- Dòng “Đã bỏ lưu · Hoàn tác” chiếm đúng ô card trong grid tới khi rời trang; lỗi bỏ lưu/hoàn tác hiện chữ `destructive` ngay trong dòng, card trở lại trạng thái đã xác nhận.
- Empty: icon tim, “Chưa có bài đã lưu”, [Khám phá bài viết] → `/blogs`. Search không có kết quả: “Không có bài đã lưu khớp” + [Xóa tìm kiếm]. Loading 6 card `▓`; error + [⟳].
- **Mobile:** 1 cột; nút quay lại thành icon; dòng undo full width cao 44.
