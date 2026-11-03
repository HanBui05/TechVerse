import { describe, expect, it } from 'vitest'
import { ApiError } from '../../services/api/client'
import { adminErrorText } from './adminErrors'

const api = (status: number, code?: string) => new ApiError('Topic name already exists', status, code)

describe('adminErrorText', () => {
  it('never shows the English backend message for a known code', () => {
    expect(adminErrorText(api(409, 'TOPIC_EXISTED'), 'vi', 'Không thể lưu')).toBe('Tên chủ đề đã tồn tại. Hãy chọn tên khác.')
    expect(adminErrorText(api(409, 'TOPIC_EXISTED'), 'en', 'Could not save')).toBe('A topic with this name already exists. Choose another name.')
    expect(adminErrorText(api(409, 'TAG_EXISTED'), 'vi', 'Không thể lưu')).toBe('Tên thẻ đã tồn tại. Hãy chọn tên khác.')
    expect(adminErrorText(api(409, 'ADMIN_SELF_LOCK_NOT_ALLOWED'), 'vi', 'x')).toBe('Bạn không thể tự khóa tài khoản của mình.')
    expect(adminErrorText(api(409, 'LAST_ACTIVE_ADMIN_CANNOT_BE_LOCKED'), 'en', 'x')).toBe('At least one active administrator must remain.')
  })

  it('falls back to the HTTP status when the code is unknown or missing', () => {
    expect(adminErrorText(api(400), 'vi', 'x')).toBe('Dữ liệu chưa hợp lệ. Vui lòng kiểm tra lại.')
    expect(adminErrorText(api(403, 'SOMETHING_NEW'), 'en', 'x')).toBe('You do not have permission to do this.')
    expect(adminErrorText(api(404), 'vi', 'x')).toBe('Không tìm thấy dữ liệu. Có thể nó đã bị xóa.')
    expect(adminErrorText(api(409), 'vi', 'x')).toBe('Dữ liệu đã thay đổi. Hãy tải lại rồi thử lại.')
    expect(adminErrorText(api(429), 'en', 'x')).toBe('Too many requests. Please try again shortly.')
    expect(adminErrorText(api(503), 'vi', 'x')).toBe('Hệ thống tạm thời gián đoạn. Vui lòng thử lại sau.')
  })

  it('uses the caller fallback for other statuses and network errors', () => {
    expect(adminErrorText(api(418), 'vi', 'Không thể lưu')).toBe('Không thể lưu')
    expect(adminErrorText(new TypeError('Failed to fetch'), 'en', 'Could not save')).toBe('Could not save')
  })
})
