import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { ArrowDownToLine, Check, Plus, X } from 'lucide-react'
import { api, errorMessage, type Row } from '../api'
import { DataTable } from '../components/DataTable'
import { Field, Notice, Page, Panel } from '../components/Page'

type Ref = { id: number; sku?: string; name?: string; code?: string; zone?: string }
type ReceiptItemRow = {
  id: number
  product?: Ref
  location?: Ref
  quantity: number
}

export function Receipts() {
  const [orders, setOrders] = useState<Row[]>([])
  const [suppliers, setSuppliers] = useState<Ref[]>([])
  const [products, setProducts] = useState<Ref[]>([])
  const [locations, setLocations] = useState<Ref[]>([])
  const [form, setForm] = useState({ code: '', supplierId: '', productId: '', locationId: '', quantity: '1' })
  const [selectedOrder, setSelectedOrder] = useState<Row | null>(null)
  const [detailItems, setDetailItems] = useState<Row[]>([])
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const load = useCallback(() => api.get<Row[]>('/receipt-orders').then((response) => setOrders(response.data))
    .catch((reason: unknown) => setError(errorMessage(reason))), [])
  useEffect(() => {
    void load()
    Promise.all([api.get<Ref[]>('/suppliers'), api.get<Ref[]>('/products'), api.get<Ref[]>('/locations')])
      .then(([s, p, l]) => { setSuppliers(s.data); setProducts(p.data); setLocations(l.data) })
      .catch((reason: unknown) => setError(errorMessage(reason)))
  }, [load])

  async function viewDetails(order: Row) {
    setError('')
    try {
      const res = await api.get<ReceiptItemRow[]>(`/receipt-orders/${Number(order.id)}/items`)
      setSelectedOrder(order)
      setDetailItems(res.data.map((item) => ({
        id: item.id,
        sku: item.product?.sku ?? '—',
        productName: item.product?.name ?? '—',
        location: item.location?.code ?? '—',
        zone: item.location?.zone ?? '—',
        quantity: item.quantity,
      })))
    } catch (reason) { setError(errorMessage(reason)) }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setMessage('')
    try {
      const res = await api.post<Row>('/receipt-orders', { code: form.code, supplierId: Number(form.supplierId), items: [{ productId: Number(form.productId), locationId: Number(form.locationId), quantity: Number(form.quantity) }] })
      setMessage('Đã tạo phiếu nhập ở trạng thái chờ xử lý. Hoàn tất phiếu để cộng tồn kho.'); setForm({ code: '', supplierId: '', productId: '', locationId: '', quantity: '1' })
      await load()
      await viewDetails(res.data)
    } catch (reason) { setError(errorMessage(reason)) }
  }
  async function changeStatus(id: number, action: 'complete' | 'cancel') {
    setError(''); setMessage('')
    try {
      const res = await api.put<Row>(`/receipt-orders/${id}/${action}`)
      setMessage(`Đã ${action === 'complete' ? 'hoàn tất' : 'hủy'} phiếu nhập.`)
      await load()
      if (selectedOrder && Number(selectedOrder.id) === id) await viewDetails(res.data)
    } catch (reason) { setError(errorMessage(reason)) }
  }

  const rows = orders.map((order) => ({
    id: order.id,
    code: order.code,
    supplier: order.supplier,
    status: order.status,
    receiptDate: order.receiptDate,
    createdBy: order.createdBy,
  }))

  return <Page eyebrow="QUẢN LÝ NHẬP KHO" title="Đơn nhập kho" description="Ghi nhận hàng từ nhà cung cấp và nhập hàng vào vị trí lưu trữ.">
    {(error || message) && <Notice message={error || message} kind={error ? 'error' : 'success'} />}
    <Panel title="Tạo phiếu nhập kho" subtitle="Phiếu mới ở trạng thái chờ cho đến khi được xác nhận hoàn tất">
      <form className="filter-bar" onSubmit={(event) => void submit(event)}>
        <Field label="Mã phiếu nhập"><input required value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} placeholder="PN-0001" /></Field>
        <Field label="Nhà cung cấp"><select required value={form.supplierId} onChange={(event) => setForm({ ...form, supplierId: event.target.value })}><option value="">Chọn nhà cung cấp</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></Field>
        <Field label="Hàng hóa"><select required value={form.productId} onChange={(event) => setForm({ ...form, productId: event.target.value })}><option value="">Chọn hàng hóa</option>{products.map((product) => <option key={product.id} value={product.id}>{product.sku} — {product.name}</option>)}</select></Field>
        <Field label="Vị trí nhập"><select required value={form.locationId} onChange={(event) => setForm({ ...form, locationId: event.target.value })}><option value="">Chọn vị trí</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.code}</option>)}</select></Field>
        <Field label="Số lượng"><input required type="number" min="1" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} /></Field>
        <button className="button button-primary" type="submit"><Plus size={16} />Tạo phiếu</button>
      </form>
    </Panel>

    {selectedOrder && (
      <Panel
        title={`Chi tiết phiếu nhập: ${String(selectedOrder.code)}`}
        subtitle={`${detailItems.length} mặt hàng thuộc phiếu nhập này`}
        action={
          <div className="inline-actions">
            {selectedOrder.status === 'PENDING' && (
              <>
                <button className="button button-primary" type="button" onClick={() => void changeStatus(Number(selectedOrder.id), 'complete')}>
                  <Check size={15} /> Hoàn tất nhập kho
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
        <DataTable searchable={false} rows={detailItems} empty="Phiếu nhập chưa có dòng mặt hàng nào." />
      </Panel>
    )}

    <Panel title="Danh sách phiếu nhập" subtitle={`${orders.length} phiếu nhập — nhấp vào một dòng để xem chi tiết`}>
      <DataTable
        rows={rows}
        selectedRowId={selectedOrder?.id}
        onRowClick={(row) => void viewDetails(row)}
        actions={(order) => order.status === 'PENDING' ? <div className="inline-actions">
          <button className="icon-button success-icon" title="Hoàn tất phiếu nhập" aria-label="Hoàn tất phiếu nhập" onClick={(event) => { event.stopPropagation(); void changeStatus(Number(order.id), 'complete') }}><Check size={16} /></button>
          <button className="icon-button danger-icon" title="Hủy phiếu nhập" aria-label="Hủy phiếu nhập" onClick={(event) => { event.stopPropagation(); void changeStatus(Number(order.id), 'cancel') }}><X size={16} /></button>
        </div> : null}
      />
      {!orders.length && <div className="panel-empty"><ArrowDownToLine size={17} />Tạo phiếu nhập để bắt đầu theo dõi hàng hóa nhập kho.</div>}
    </Panel>
  </Page>
}
