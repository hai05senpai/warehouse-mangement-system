import axios from 'axios'

export type AdminUser = {
  id: number
  username: string
  fullName: string
  email?: string
  phone?: string
  role: string
  active: boolean
  lastLoginAt?: string
  createdAt?: string
}

export type LoginResponse = {
  token: string
  admin: AdminUser
}

const TOKEN_KEY = 'stockroom_auth_token'
const ADMIN_KEY = 'stockroom_auth_admin'

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function getStoredAdmin(): AdminUser | null {
  const raw = localStorage.getItem(ADMIN_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as AdminUser
  } catch {
    return null
  }
}

export function setStoredAuth(token: string, admin: AdminUser): void {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(ADMIN_KEY, JSON.stringify(admin))
}

export function clearStoredAuth(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(ADMIN_KEY)
}

export const api = axios.create({
  baseURL: 'http://localhost:8080/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
})

api.interceptors.request.use((config) => {
  const token = getStoredToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export function errorMessage(error: unknown): string {
  if (axios.isAxiosError<{ error?: string; message?: string }>(error)) {
    const message = error.response?.data?.error ?? error.response?.data?.message ?? error.message
    if (error.response?.status === 500) {
      return 'Máy chủ gặp lỗi khi xử lý yêu cầu. Hãy xem log backend để biết chi tiết.'
    }
    const translations: Record<string, string> = {
      'Network Error': 'Không thể kết nối máy chủ. Hãy kiểm tra backend và thử lại.',
      'Request failed with status code 500': 'Máy chủ gặp lỗi khi xử lý yêu cầu. Vui lòng kiểm tra log backend.',
      'Username and password are required': 'Vui lòng nhập tên đăng nhập và mật khẩu.',
      'Invalid username or password': 'Tên đăng nhập hoặc mật khẩu không chính xác.',
      'Admin account is disabled': 'Tài khoản quản trị viên này đã bị vô hiệu hóa.',
      'Authentication required': 'Vui lòng đăng nhập để tiếp tục.',
      'Invalid or expired session': 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.',
      'Admin not found': 'Không tìm thấy tài khoản quản trị viên.',
      'Product not found': 'Không tìm thấy hàng hóa.',
      'Location not found': 'Không tìm thấy vị trí kho.',
      'Supplier not found': 'Không tìm thấy nhà cung cấp.',
      'Customer not found': 'Không tìm thấy khách hàng.',
      'Issue order not found': 'Không tìm thấy phiếu xuất kho.',
      'Receipt order not found': 'Không tìm thấy phiếu nhập kho.',
      'Stock take order not found': 'Không tìm thấy phiếu kiểm kê.',
      'Stock transfer not found': 'Không tìm thấy phiếu điều chuyển.',
      'start and end are required and start must be before end': 'Vui lòng chọn đủ ngày; "Từ ngày" phải trước "Đến ngày".',
      'start must be before end': '"Từ ngày" phải trước "Đến ngày".',
      'Inventory item not found': 'Không tìm thấy tồn kho tại vị trí này.',
      'Source inventory not found': 'Không tìm thấy tồn kho tại vị trí nguồn.',
      'Only pending receipt orders can be completed': 'Chỉ có thể hoàn tất phiếu nhập đang chờ xử lý.',
      'Only pending receipt orders can be cancelled': 'Chỉ có thể hủy phiếu nhập đang chờ xử lý.',
      'Only pending issue orders can be cancelled': 'Chỉ có thể hủy phiếu xuất đang chờ xử lý.',
      'Only DRAFT stock take orders can be completed': 'Chỉ có thể hoàn tất phiếu kiểm kê ở trạng thái bản nháp.',
      'Only DRAFT stock take orders can be cancelled': 'Chỉ có thể hủy phiếu kiểm kê ở trạng thái bản nháp.',
      'SKU already exists': 'Mã SKU đã tồn tại.',
      'Product has inventory or transaction history and cannot be deleted': 'Không thể xóa hàng hóa đã có tồn kho hoặc lịch sử giao dịch.',
      'Order code and at least one item are required': 'Vui lòng nhập mã phiếu và ít nhất một mặt hàng.',
      'Receipt code, supplier, and at least one item are required': 'Vui lòng nhập mã phiếu, chọn nhà cung cấp và ít nhất một mặt hàng.',
      'Stock take code and at least one item are required': 'Vui lòng nhập mã phiếu kiểm kê và ít nhất một mặt hàng.',
      'SKU and product name are required': 'Vui lòng nhập mã SKU và tên hàng hóa.',
      'Insufficient available quantity': 'Số lượng khả dụng không đủ.',
      'Not enough available stock': 'Tồn kho khả dụng không đủ.',
      'Transfers require distinct locations and a positive quantity': 'Vị trí chuyển đi và chuyển đến phải khác nhau, số lượng phải lớn hơn 0.',
      'Counted quantity cannot be lower than quantity reserved for pending issues': 'Số lượng kiểm kê không thể thấp hơn số lượng đang được giữ cho các phiếu xuất.',
      'A product can only be counted once per location in a stock take': 'Mỗi mặt hàng chỉ được kiểm kê một lần tại một vị trí trong cùng phiếu.',
    }
    if (translations[message]) return translations[message]
    if (message.includes('Not enough available stock')) return 'Tồn kho khả dụng không đủ cho số lượng yêu cầu.'
    if (message.includes('Insufficient available quantity')) return 'Tồn kho khả dụng không đủ cho số lượng điều chuyển.'
    if (message.includes('Customer not found')) return 'Không tìm thấy khách hàng tương ứng.'
    if (message.includes('Product not found')) return 'Không tìm thấy hàng hóa tương ứng.'
    if (message.includes('Location not found')) return 'Không tìm thấy vị trí kho tương ứng.'
    if (message.includes('Request failed with status code')) return 'Yêu cầu không thành công. Vui lòng thử lại.'
    return message
  }
  return error instanceof Error ? error.message : 'Something went wrong'
}

export type Row = Record<string, unknown> & { id?: number | string }
