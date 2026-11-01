import type { Language } from '../types/preferences'

const labels: Record<'article' | 'author' | 'role', Record<string, Record<Language, string>>> = {
  "article": {
    "DRAFT": {
      "vi": "Bản nháp",
      "en": "Draft"
    },
    "PENDING": {
      "vi": "Chờ duyệt",
      "en": "Pending review"
    },
    "PUBLISHED": {
      "vi": "Đã xuất bản",
      "en": "Published"
    },
    "CHANGES_REQUESTED": {
      "vi": "Yêu cầu chỉnh sửa",
      "en": "Changes requested"
    },
    "HIDDEN": {
      "vi": "Đã ẩn",
      "en": "Hidden"
    },
    "REMOVED": {
      "vi": "Đã gỡ",
      "en": "Removed"
    }
  },
  "author": {
    "NOT_APPLIED": {
      "vi": "Chưa đăng ký",
      "en": "Not applied"
    },
    "PENDING": {
      "vi": "Chờ duyệt",
      "en": "Pending review"
    },
    "APPROVED": {
      "vi": "Đã duyệt",
      "en": "Approved"
    },
    "REJECTED": {
      "vi": "Đã từ chối",
      "en": "Rejected"
    },
    "SUSPENDED": {
      "vi": "Đang đình chỉ",
      "en": "Suspended"
    }
  },
  "role": {
    "LEARNER": {
      "vi": "Người học",
      "en": "Learner"
    },
    "AUTHOR": {
      "vi": "Tác giả",
      "en": "Author"
    },
    "MODERATOR": {
      "vi": "Kiểm duyệt viên",
      "en": "Moderator"
    },
    "ADMIN": {
      "vi": "Quản trị viên",
      "en": "Admin"
    }
  }
}

const messages: Record<string, Record<Language, string>> = {
  "TechVerse administration": {
    "vi": "TechVerse • Quản trị",
    "en": "TechVerse • Administration"
  },
  "TechVerse Moderator": {
    "vi": "TechVerse • Kiểm duyệt",
    "en": "TechVerse • Moderation"
  },
  "Quản lý người dùng": {
    "vi": "Quản lý người dùng",
    "en": "Manage users"
  },
  "Tìm theo tên hoặc email": {
    "vi": "Tìm theo tên hoặc email",
    "en": "Search name or email"
  },
  "Tìm": {
    "vi": "Tìm",
    "en": "Search"
  },
  "Tài khoản": {
    "vi": "Tài khoản",
    "en": "Account"
  },
  "Tất cả": {
    "vi": "Tất cả",
    "en": "All"
  },
  "Hoạt động": {
    "vi": "Hoạt động",
    "en": "Active"
  },
  "Đã khóa": {
    "vi": "Đã khóa",
    "en": "Locked"
  },
  "Role": {
    "vi": "Vai trò",
    "en": "Role"
  },
  "Hồ sơ Author": {
    "vi": "Hồ sơ tác giả",
    "en": "Author profile"
  },
  "Sắp xếp": {
    "vi": "Sắp xếp",
    "en": "Sort by"
  },
  "Ngày tạo": {
    "vi": "Ngày tạo",
    "en": "Created date"
  },
  "Họ tên": {
    "vi": "Họ tên",
    "en": "Full name"
  },
  "Email": {
    "vi": "Email",
    "en": "Email"
  },
  "Thứ tự": {
    "vi": "Thứ tự",
    "en": "Order"
  },
  "Giảm dần": {
    "vi": "Giảm dần",
    "en": "Descending"
  },
  "Tăng dần": {
    "vi": "Tăng dần",
    "en": "Ascending"
  },
  "Danh sách người dùng": {
    "vi": "Danh sách người dùng",
    "en": "User list"
  },
  "Chọn trang này": {
    "vi": "Chọn trang này",
    "en": "Select this page"
  },
  "Khóa (": {
    "vi": "Khóa (",
    "en": "Lock ("
  },
  "Mở khóa (": {
    "vi": "Mở khóa (",
    "en": "Unlock ("
  },
  "Đang tải...": {
    "vi": "Đang tải...",
    "en": "Loading..."
  },
  "Không tìm thấy người dùng.": {
    "vi": "Không tìm thấy người dùng.",
    "en": "No users found."
  },
  "Thông tin tài khoản": {
    "vi": "Thông tin tài khoản",
    "en": "Account details"
  },
  "Vai trò:": {
    "vi": "Vai trò:",
    "en": "Roles:"
  },
  "Điện thoại:": {
    "vi": "Điện thoại:",
    "en": "Phone:"
  },
  "Ngày sinh:": {
    "vi": "Ngày sinh:",
    "en": "Date of birth:"
  },
  "Trạng thái:": {
    "vi": "Trạng thái:",
    "en": "Status:"
  },
  "Hồ sơ Author:": {
    "vi": "Hồ sơ tác giả:",
    "en": "Author profile:"
  },
  "Chọn người dùng để xem chi tiết.": {
    "vi": "Chọn người dùng để xem chi tiết.",
    "en": "Select a user to view details."
  },
  "Hồ sơ đăng ký Author": {
    "vi": "Hồ sơ đăng ký tác giả",
    "en": "Author applications"
  },
  "Tìm kiếm": {
    "vi": "Tìm kiếm",
    "en": "Search"
  },
  "Hồ sơ": {
    "vi": "Hồ sơ",
    "en": "Application"
  },
  "Chờ duyệt": {
    "vi": "Chờ duyệt",
    "en": "Pending review"
  },
  "Đã duyệt": {
    "vi": "Đã duyệt",
    "en": "Approved"
  },
  "Từ chối": {
    "vi": "Từ chối",
    "en": "Reject"
  },
  "Tạm ngưng": {
    "vi": "Tạm ngưng",
    "en": "Suspend"
  },
  "Ngày cập nhật": {
    "vi": "Ngày cập nhật",
    "en": "Updated date"
  },
  "Danh sách hồ sơ": {
    "vi": "Danh sách hồ sơ",
    "en": "Application list"
  },
  "Không có hồ sơ phù hợp.": {
    "vi": "Không có hồ sơ phù hợp.",
    "en": "No matching applications."
  },
  "Chi tiết hồ sơ": {
    "vi": "Chi tiết hồ sơ",
    "en": "Application details"
  },
  "Chuyên môn:": {
    "vi": "Chuyên môn:",
    "en": "Expertise:"
  },
  "Giới thiệu:": {
    "vi": "Giới thiệu:",
    "en": "Biography:"
  },
  "Xem portfolio ↗": {
    "vi": "Xem hồ sơ năng lực ↗",
    "en": "View portfolio ↗"
  },
  "Ghi chú:": {
    "vi": "Ghi chú:",
    "en": "Note:"
  },
  "Ghi chú / lý do": {
    "vi": "Ghi chú / lý do",
    "en": "Note / reason"
  },
  "Phê duyệt": {
    "vi": "Phê duyệt",
    "en": "Approve"
  },
  "Khôi phục": {
    "vi": "Khôi phục",
    "en": "Restore"
  },
  "Chọn một hồ sơ để xem chi tiết.": {
    "vi": "Chọn một hồ sơ để xem chi tiết.",
    "en": "Select an application to view details."
  },
  "Quản lý": {
    "vi": "Quản lý",
    "en": "Manage"
  },
  "Trạng thái": {
    "vi": "Trạng thái",
    "en": "Status"
  },
  "Ngừng hoạt động": {
    "vi": "Ngừng hoạt động",
    "en": "Inactive"
  },
  "Tên": {
    "vi": "Tên",
    "en": "Name"
  },
  "Tạo mới": {
    "vi": "Tạo mới",
    "en": "Create new"
  },
  "Danh sách": {
    "vi": "Danh sách",
    "en": "List"
  },
  "Chưa có dữ liệu.": {
    "vi": "Chưa có dữ liệu.",
    "en": "No data yet."
  },
  "Mô tả": {
    "vi": "Mô tả",
    "en": "Description"
  },
  "Ẩn": {
    "vi": "Ẩn",
    "en": "Hidden"
  },
  "Lưu thay đổi": {
    "vi": "Lưu thay đổi",
    "en": "Save changes"
  },
  "Kích hoạt": {
    "vi": "Kích hoạt",
    "en": "Activate"
  },
  "Đã cập nhật trạng thái.": {
    "vi": "Đã cập nhật trạng thái.",
    "en": "Status updated."
  },
  "Trang chủ": {
    "vi": "Trang chủ",
    "en": "Dashboard"
  },
  "Chào mừng trở lại!": {
    "vi": "Chào mừng trở lại!",
    "en": "Welcome back!"
  },
  "Đây là tổng quan về hoạt động của hệ thống TechVerse hôm nay.": {
    "vi": "Đây là tổng quan về hoạt động của hệ thống TechVerse hôm nay.",
    "en": "An overview of today's activity on TechVerse."
  },
  "Hoạt động gần đây": {
    "vi": "Hoạt động gần đây",
    "en": "Recent activity"
  },
  "Các hoạt động mới nhất trên hệ thống": {
    "vi": "Các hoạt động mới nhất trên hệ thống",
    "en": "Latest activity on the platform"
  },
  "Chưa có dữ liệu": {
    "vi": "Chưa có dữ liệu",
    "en": "No data yet"
  },
  "KHÁCH HÀNG": {
    "vi": "KHÁCH HÀNG",
    "en": "CUSTOMER"
  },
  "NỘI DUNG HOẠT ĐỘNG": {
    "vi": "NỘI DUNG HOẠT ĐỘNG",
    "en": "ACTIVITY"
  },
  "SỐ TIỀN": {
    "vi": "SỐ TIỀN",
    "en": "AMOUNT"
  },
  "THỜI GIAN": {
    "vi": "THỜI GIAN",
    "en": "TIME"
  },
  "TRẠNG THÁI": {
    "vi": "TRẠNG THÁI",
    "en": "STATUS"
  },
  "Chưa có hoạt động": {
    "vi": "Chưa có hoạt động",
    "en": "No activity yet"
  },
  "Dữ liệu hoạt động sẽ xuất hiện khi hệ thống có giao dịch.": {
    "vi": "Dữ liệu hoạt động sẽ xuất hiện khi hệ thống có giao dịch.",
    "en": "Activity will appear when transactions are available."
  },
  "Thành viên trực tuyến": {
    "vi": "Thành viên trực tuyến",
    "en": "Online members"
  },
  "Danh sách người dùng đang hoạt động thực tế": {
    "vi": "Danh sách người dùng đang hoạt động thực tế",
    "en": "Currently active users"
  },
  "— online": {
    "vi": "— trực tuyến",
    "en": "— online"
  },
  "Danh sách thành viên sẽ được cập nhật từ backend.": {
    "vi": "Danh sách thành viên sẽ được cập nhật từ backend.",
    "en": "Member data will be provided by the backend."
  },
  "Tổng người dùng": {
    "vi": "Tổng người dùng",
    "en": "Total users"
  },
  "Người dùng mới hôm nay": {
    "vi": "Người dùng mới hôm nay",
    "en": "New users today"
  },
  "Khóa học hoạt động": {
    "vi": "Khóa học hoạt động",
    "en": "Active courses"
  },
  "Doanh thu tháng này": {
    "vi": "Doanh thu tháng này",
    "en": "Revenue this month"
  },
  "Học viên mới tháng này": {
    "vi": "Học viên mới tháng này",
    "en": "New learners this month"
  },
  "Kiểm duyệt bài viết": {
    "vi": "Kiểm duyệt bài viết",
    "en": "Review articles"
  },
  "Xem nội dung từ Author và quản lý hàng đợi kiểm duyệt.": {
    "vi": "Xem nội dung từ tác giả và quản lý hàng đợi kiểm duyệt.",
    "en": "Review author submissions and manage the moderation queue."
  },
  "Tìm kiếm bài viết": {
    "vi": "Tìm kiếm bài viết",
    "en": "Search articles"
  },
  "Tất cả trạng thái": {
    "vi": "Tất cả trạng thái",
    "en": "All statuses"
  },
  "Danh sách bài viết": {
    "vi": "Danh sách bài viết",
    "en": "Article list"
  },
  "Đang tải bài viết...": {
    "vi": "Đang tải bài viết...",
    "en": "Loading articles..."
  },
  "Không có bài viết phù hợp.": {
    "vi": "Không có bài viết phù hợp.",
    "en": "No matching articles."
  },
  "Đang tải nội dung...": {
    "vi": "Đang tải nội dung...",
    "en": "Loading content..."
  },
  "Tóm tắt": {
    "vi": "Tóm tắt",
    "en": "Summary"
  },
  "Nội dung bài viết": {
    "vi": "Nội dung bài viết",
    "en": "Article content"
  },
  "Nhận xét trước đó": {
    "vi": "Nhận xét trước đó",
    "en": "Previous feedback"
  },
  "Nhận xét kiểm duyệt": {
    "vi": "Nhận xét kiểm duyệt",
    "en": "Review feedback"
  },
  "Nhận xét là bắt buộc khi yêu cầu chỉnh sửa.": {
    "vi": "Nhận xét là bắt buộc khi yêu cầu chỉnh sửa.",
    "en": "Feedback is required when requesting changes."
  },
  "Yêu cầu chỉnh sửa": {
    "vi": "Yêu cầu chỉnh sửa",
    "en": "Request changes"
  },
  "Chọn bài viết để xem": {
    "vi": "Chọn bài viết để xem",
    "en": "Select an article"
  },
  "Chọn một bài trong danh sách để đọc và kiểm duyệt.": {
    "vi": "Chọn một bài trong danh sách để đọc và kiểm duyệt.",
    "en": "Select an article to read and review."
  },
  "Tìm theo tiêu đề...": {
    "vi": "Tìm theo tiêu đề...",
    "en": "Search by title..."
  },
  "Nhập nhận xét cho tác giả...": {
    "vi": "Nhập nhận xét cho tác giả...",
    "en": "Enter feedback for the author..."
  },
  "Chưa có tóm tắt": {
    "vi": "Chưa có tóm tắt",
    "en": "No summary"
  },
  "Chưa phân loại": {
    "vi": "Chưa phân loại",
    "en": "Uncategorized"
  },
  "Chưa có tóm tắt.": {
    "vi": "Chưa có tóm tắt.",
    "en": "No summary."
  },
  "Phê duyệt và xuất bản bài viết này?": {
    "vi": "Phê duyệt và xuất bản bài viết này?",
    "en": "Approve and publish this article?"
  },
  "Gửi yêu cầu chỉnh sửa cho tác giả?": {
    "vi": "Gửi yêu cầu chỉnh sửa cho tác giả?",
    "en": "Request changes from the author?"
  },
  "Bài viết đã được phê duyệt và xuất bản.": {
    "vi": "Bài viết đã được phê duyệt và xuất bản.",
    "en": "The article has been approved and published."
  },
  "Đã gửi yêu cầu chỉnh sửa tới tác giả.": {
    "vi": "Đã gửi yêu cầu chỉnh sửa tới tác giả.",
    "en": "Changes have been requested from the author."
  },
  "Bài viết đã thay đổi. Hãy mở lại bài để kiểm tra trước khi duyệt.": {
    "vi": "Bài viết đã thay đổi. Hãy mở lại bài để kiểm tra trước khi duyệt.",
    "en": "The article has changed. Reopen it before reviewing."
  },
  "Không thể tải bài viết": {
    "vi": "Không thể tải bài viết",
    "en": "Unable to load articles"
  },
  "Không thể tải chi tiết": {
    "vi": "Không thể tải chi tiết",
    "en": "Unable to load details"
  },
  "Không thể duyệt bài viết": {
    "vi": "Không thể duyệt bài viết",
    "en": "Unable to review the article"
  },
  "Không tải được người dùng": {
    "vi": "Không tải được người dùng",
    "en": "Unable to load users"
  },
  "Không tải được chi tiết": {
    "vi": "Không tải được chi tiết",
    "en": "Unable to load details"
  },
  "Không thể cập nhật": {
    "vi": "Không thể cập nhật",
    "en": "Unable to update"
  },
  "Không tải được hồ sơ": {
    "vi": "Không tải được hồ sơ",
    "en": "Unable to load applications"
  },
  "Không thể cập nhật hồ sơ": {
    "vi": "Không thể cập nhật hồ sơ",
    "en": "Unable to update application"
  },
  "Không tải được dữ liệu": {
    "vi": "Không tải được dữ liệu",
    "en": "Unable to load data"
  },
  "Không thể lưu": {
    "vi": "Không thể lưu",
    "en": "Unable to save"
  },
  "Đã lưu thành công.": {
    "vi": "Đã lưu thành công.",
    "en": "Saved successfully."
  },
  "Khóa tài khoản": {
    "vi": "Khóa tài khoản",
    "en": "Lock account"
  },
  "Mở khóa tài khoản": {
    "vi": "Mở khóa tài khoản",
    "en": "Unlock account"
  },
  "Khóa": {
    "vi": "Khóa",
    "en": "Lock"
  },
  "Mở khóa": {
    "vi": "Mở khóa",
    "en": "Unlock"
  }
}

// Chỉ dịch nhãn hiển thị; enum dùng trong request và điều kiện nghiệp vụ giữ nguyên.
export function statusLabel(value: string, kind: keyof typeof labels, language: Language = 'vi') {
  return labels[kind][value]?.[language] || (language === 'vi' ? 'Không xác định' : 'Unknown')
}

// Dùng chung bản dịch cho giao diện quản trị và kiểm duyệt.
export function managementText(message: string, language: Language = 'vi') {
  return messages[message]?.[language] || message
}

