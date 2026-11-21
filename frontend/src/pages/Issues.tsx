import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Check, Plus, Trash2, Truck, X } from 'lucide-react'
import { api, errorMessage, getStoredAdmin, type Row } from '../api'
import { DataTable } from '../components/DataTable'
import { Field, Notice, Page, Panel } from '../components/Page'

type Ref = { id: number; sku?: string; name?: string; code?: string; zone?: string }
type IssueLine = { productId: string; locationId: string; quantity: string }
type IssueItemRow = {
  id: number
  product?: Ref
  location?: Ref
  quantity: number
}

const emptyLine = (): IssueLine => ({ productId: '', locationId: '', quantity: '1' })

export function Issues() {
  const admin = getStoredAdmin()
  const [orders, setOrders] = useState<Row[]>([])
  const [customers, setCustomers] = useState<Ref[]>([])
  const [products, setProducts] = useState<Ref[]>([])
  const [locations, setLocations] = useState<Ref[]>([])
  const [code, setCode] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [items, setItems] = useState<IssueLine[]>([emptyLine()])
  const [selectedOrder, setSelectedOrder] = useState<Row | null>(null)
  const [detailItems, setDetailItems] = useState<Row[]>([])
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(() => api.get<Row[]>('/issue-orders').then((response) => setOrders(response.data))
    .catch((reason: unknown) => setError(errorMessage(reason))), [])

  useEffect(() => {
    void load()
    Promise.all([api.get<Ref[]>('/customers'), api.get<Ref[]>('/products'), api.get<Ref[]>('/locations')])
      .then(([c, p, l]) => { setCustomers(c.data); setProducts(p.data); setLocations(l.data) })
      .catch((reason: unknown) => setError(errorMessage(reason)))
  }, [load])

  function updateLine(index: number, patch: Partial<IssueLine>) {
    setItems((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)))
  }

  function addLine() {
    setItems((prev) => [...prev, emptyLine()])
  }

  function removeLine(index: number) {
    if (items.length <= 1) return
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  async function viewDetails(order: Row) {
    setError('')
    try {
      const id = Number(order.id)
      const res = await api.get<IssueItemRow[]>(`/issue-orders/${id}/items`)
      setSelectedOrder(order)
      setDetailItems(
        res.data.map((item) => ({
          id: item.id,
          sku: item.product?.sku ?? '—',
          productName: item.product?.name ?? '—',
          location: item.location?.code ?? '—',
          zone: item.location?.zone ?? '—',
          quantity: item.quantity,
        }))
      )
    } catch (reason) {
      setError(errorMessage(reason))
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setMessage('')
    try {
      const res = await api.post<Row>('/issue-orders', {
        code: code.trim(),
        customerId: Number(customerId),
        createdBy: admin?.fullName || admin?.username || 'Quản trị viên',
        items: items.map((line) => ({
          productId: Number(line.productId),
          locationId: Number(line.locationId),
          quantity: Number(line.quantity),
        })),
      })
      setMessage(`Đã giữ chỗ tồn kho cho phiếu xuất (${items.length} mặt hàng). Hoàn tất phiếu để trừ số lượng tồn.`)
      setCode('')
      setCustomerId('')
      setItems([emptyLine()])
      await load()
      await viewDetails(res.data)
    } catch (reason) { setError(errorMessage(reason)) }
  }

  async function changeStatus(id: number, action: 'complete' | 'cancel') {
    setError(''); setMessage('')
    try {
      const res = await api.put<Row>(`/issue-orders/${id}/${action}`)
      setMessage(`Đã ${action === 'complete' ? 'hoàn tất' : 'hủy'} phiếu xuất và cập nhật lượng hàng giữ chỗ.`)
      await load()
      if (selectedOrder && Number(selectedOrder.id) === id) {
        await viewDetails(res.data)
      }
    } catch (reason) { setError(errorMessage(reason)) }
  }

  const concurrencyRows = orders.map((order) => ({
    id: order.id,
    code: order.code,
    customer: order.customer,
    status: order.status,
    issueDate: order.issueDate,
  }))

  return <Page eyebrow="QUẢN LÝ XUẤT KHO" title="Đơn xuất kho" description="Giữ chỗ hàng khả dụng khi tạo phiếu và trừ tồn kho khi hoàn tất xuất hàng.">
    {(error || message) && <Notice message={error || message} kind={error ? 'error' : 'success'} />}
    <Panel title="Tạo phiếu xuất kho" subtitle="Một phiếu xuất (IssueOrder) hỗ trợ xuất nhiều mặt hàng (IssueItem) trong cùng một giao dịch và tự động sắp xếp khóa chống Deadlock">
      <form className="form-stack" onSubmit={(event) => void submit(event)}>
        <div className="filter-bar" style={{ marginBottom: 0 }}>
          <Field label="Mã phiếu xuất">
            <input required value={code} onChange={(event) => setCode(event.target.value)} placeholder="PX-0001" />
          </Field>
          <Field label="Khách hàng">
            <select required value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
              <option value="">Chọn khách hàng</option>
              {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
            </select>
          </Field>
        </div>

        {items.map((line, index) => (
          <div className="filter-bar" key={index} style={{ marginBottom: 0 }}>
            <Field label={index === 0 ? 'Hàng hóa' : `Hàng hóa #${index + 1}`}>
              <select required value={line.productId} onChange={(event) => updateLine(index, { productId: event.target.value })}>
                <option value="">Chọn hàng hóa</option>
                {products.map((product) => <option key={product.id} value={product.id}>{product.sku} — {product.name}</option>)}
              </select>
            </Field>
            <Field label="Vị trí lấy hàng">
              <select required value={line.locationId} onChange={(event) => updateLine(index, { locationId: event.target.value })}>
                <option value="">Chọn vị trí</option>
                {locations.map((location) => <option key={location.id} value={location.id}>{location.code}</option>)}
              </select>
            </Field>
            <Field label="Số lượng">
              <input required type="number" min="1" value={line.quantity} onChange={(event) => updateLine(index, { quantity: event.target.value })} />
            </Field>
            <button
              type="button"
              className="icon-button danger-icon"
              disabled={items.length <= 1}
              title="Xóa dòng mặt hàng"
              aria-label="Xóa dòng mặt hàng"
              onClick={() => removeLine(index)}
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}

        <div className="form-actions" style={{ justifyContent: 'space-between' }}>
          <button type="button" className="button button-secondary" onClick={addLine}>
            <Plus size={15} /> Thêm dòng mặt hàng
          </button>
          <button className="button button-primary" type="submit">
            <Plus size={16} /> Giữ chỗ hàng ({items.length} dòng)
          </button>
        </div>
      </form>
    </Panel>

    {selectedOrder && (
      <Panel
        title={`Chi tiết phiếu xuất: ${String(selectedOrder.code)}`}
        subtitle={`Danh sách ${detailItems.length} mặt hàng (IssueItem) thuộc phiếu xuất này`}
        action={
          <div className="inline-actions">
            {selectedOrder.status === 'PENDING' && (
              <>
                <button className="button button-primary" type="button" onClick={() => void changeStatus(Number(selectedOrder.id), 'complete')}>
                  <Check size={15} /> Hoàn tất xuất kho
                </button>
                <button className="button button-secondary" type="button" onClick={() => void changeStatus(Number(selectedOrder.id), 'cancel')}>
                  <X size={15} /> Hủy phiếu
                </button>
              </>
            )}
            <button className="icon-button" type="button" aria-label="Đóng chi tiết" onClick={() => setSelectedOrder(null)}>
              <X size={16} />
            </button>
          </div>
        }
      >
        <DataTable searchable={false} rows={detailItems} empty="Phiếu xuất chưa có dòng mặt hàng nào." />
      </Panel>
    )}

    <Panel title="Danh sách phiếu xuất" subtitle="Nhấp vào một dòng phiếu xuất để xem chi tiết các mặt hàng (IssueItem)">
      <DataTable
        rows={concurrencyRows}
        selectedRowId={selectedOrder?.id}
        onRowClick={(row) => void viewDetails(row)}
        actions={(order) => order.status === 'PENDING' ? <div className="inline-actions">
          <button className="icon-button success-icon" title="Hoàn tất phiếu xuất (Approve)" aria-label="Hoàn tất phiếu xuất" onClick={() => void changeStatus(Number(order.id), 'complete')}><Check size={16} /></button>
          <button className="icon-button danger-icon" title="Hủy phiếu xuất (Disapprove)" aria-label="Hủy phiếu xuất" onClick={() => void changeStatus(Number(order.id), 'cancel')}><X size={16} /></button>
        </div> : null}
      />
      {!orders.length && <div className="panel-empty"><Truck size={17} />Chưa có phiếu xuất kho nào.</div>}
    </Panel>
  </Page>
}
