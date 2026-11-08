import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Row } from '../api'

function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'string') {
    const statuses: Record<string, string> = {
      PENDING: 'Chờ xử lý', COMPLETED: 'Hoàn tất', CANCELLED: 'Đã hủy',
      DRAFT: 'Bản nháp', RECEIPT: 'Nhập kho', ISSUE: 'Xuất kho',
      TRANSFER_IN: 'Chuyển đến', TRANSFER_OUT: 'Chuyển đi',
      STOCK_ADJUSTMENT: 'Điều chỉnh kiểm kê',
    }
    if (statuses[value]) return statuses[value]
    if (/^\d{4}-\d\d-\d\dT/.test(value)) {
      return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
    }
  }
  if (typeof value === 'object') {
    const item = value as Record<string, unknown>
    return String(item.name ?? item.sku ?? item.code ?? item.zone ?? item.id ?? '—')
  }
  return String(value)
}

export function DataTable({ rows, empty = 'No records found', searchable = true, actions }: {
  rows: Row[]
  empty?: string
  searchable?: boolean
  actions?: (row: Row) => ReactNode
}) {
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const pageSize = 8
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return needle ? rows.filter((row) => JSON.stringify(row).toLowerCase().includes(needle)) : rows
  }, [query, rows])
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const visible = filtered.slice(page * pageSize, (page + 1) * pageSize)
  const columns = [...new Set(visible.flatMap((row) => Object.keys(row).filter((key) => key !== 'id')))].slice(0, 7)
  const headings: Record<string, string> = {
    sku: 'Mã SKU', name: 'Tên hàng hóa', category: 'Danh mục', unit: 'Đơn vị',
    minQuantity: 'Tồn tối thiểu', product: 'Sản phẩm', productName: 'Tên hàng hóa',
    productId: 'Mã sản phẩm', location: 'Vị trí', zone: 'Khu vực',
    quantity: 'Số lượng', onHand: 'Tồn kho', reserved: 'Đã giữ chỗ',
    available: 'Khả dụng', availableQuantity: 'Số lượng khả dụng',
    totalQuantity: 'Tổng tồn', minimum: 'Mức tối thiểu', status: 'Trạng thái',
    code: 'Mã phiếu', supplier: 'Nhà cung cấp', customer: 'Khách hàng',
    supplierId: 'Mã nhà cung cấp', customerId: 'Mã khách hàng',
    receiptDate: 'Ngày nhập', issueDate: 'Ngày xuất', stockTakeDate: 'Ngày kiểm kê',
    createdBy: 'Người tạo', approvedBy: 'Người duyệt',
    systemQty: 'Tồn hệ thống', actualQty: 'Tồn thực tế', diffQty: 'Chênh lệch',
    itemCount: 'Số mặt hàng', systemQuantity: 'Tổng tồn hệ thống',
    actualQuantity: 'Tổng tồn thực tế', difference: 'Tổng chênh lệch',
    openingQuantity: 'Tồn đầu kỳ', receivedQuantity: 'Nhập trong kỳ',
    issuedQuantity: 'Xuất trong kỳ', adjustmentQuantity: 'Điều chỉnh',
    closingQuantity: 'Tồn cuối kỳ', occurredAt: 'Thời gian', locationCode: 'Mã vị trí',
    lastIssueDate: 'Lần xuất gần nhất',
    transferDate: 'Ngày điều chuyển', activity: 'Hoạt động',
  }
  const translatedEmpty = empty === 'No records found' ? 'Không có dữ liệu.' : empty

  return (
    <div>
      {searchable && (
        <label className="table-search">
          <Search size={16} />
          <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(0) }} placeholder="Lọc dữ liệu..." />
        </label>
      )}
      <div className="table-scroll">
        <table>
          <thead><tr>{columns.map((column) => <th key={column}>{headings[column] ?? column.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())}</th>)}{actions && <th>Thao tác</th>}</tr></thead>
          <tbody>
            {visible.map((row, index) => (
              <tr key={String(row.id ?? index)}>
                {columns.map((column) => {
                  const value = row[column]
                  const isStatus = column.toLowerCase() === 'status'
                  const statusClass = typeof value === 'string'
                    ? ({ PENDING: 'pending', COMPLETED: 'completed', CANCELLED: 'cancelled', DRAFT: 'draft' }[value] ?? '')
                    : ''
                  return <td key={column}>{isStatus
                    ? <span className={`badge ${statusClass ? `badge-${statusClass}` : ''}`}>{display(value)}</span>
                    : display(value)}</td>
                })}
                {actions && <td className="action-cell">{actions(row)}</td>}
              </tr>
            ))}
            {visible.length === 0 && <tr><td className="empty-cell" colSpan={Math.max(columns.length + (actions ? 1 : 0), 1)}>{translatedEmpty}</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="table-footer">
        <span>{filtered.length ? `${page * pageSize + 1}–${Math.min((page + 1) * pageSize, filtered.length)} / ${filtered.length}` : '0 bản ghi'}</span>
        <div className="pagination">
          <button className="icon-button" aria-label="Trang trước" disabled={page === 0} onClick={() => setPage((value) => value - 1)}><ChevronLeft size={17} /></button>
          <span>Trang {page + 1} / {pageCount}</span>
          <button className="icon-button" aria-label="Trang sau" disabled={page + 1 >= pageCount} onClick={() => setPage((value) => value + 1)}><ChevronRight size={17} /></button>
        </div>
      </div>
    </div>
  )
}
