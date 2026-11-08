import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Check, Plus, Truck, X } from 'lucide-react'
import { api, errorMessage, type Row } from '../api'
import { DataTable } from '../components/DataTable'
import { Field, Notice, Page, Panel } from '../components/Page'

type Ref = { id: number; sku?: string; name?: string; code?: string; product?: Ref; location?: Ref }
export function Issues() {
  const [orders, setOrders] = useState<Row[]>([])
  const [customers, setCustomers] = useState<Ref[]>([])
  const [products, setProducts] = useState<Ref[]>([])
  const [locations, setLocations] = useState<Ref[]>([])
  const [form, setForm] = useState({ code: '', customerId: '', productId: '', locationId: '', quantity: '1' })
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
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setMessage('')
    try {
      await api.post('/issue-orders', { code: form.code, customerId: Number(form.customerId), items: [{ productId: Number(form.productId), locationId: Number(form.locationId), quantity: Number(form.quantity) }] })
      setMessage('Đã giữ chỗ tồn kho cho phiếu xuất. Hoàn tất phiếu để trừ số lượng tồn.')
      setForm({ code: '', customerId: '', productId: '', locationId: '', quantity: '1' }); await load()
    } catch (reason) { setError(errorMessage(reason)) }
  }
  async function changeStatus(id: number, action: 'complete' | 'cancel') {
    setError(''); setMessage('')
    try { await api.put(`/issue-orders/${id}/${action}`); setMessage(`Đã ${action === 'complete' ? 'hoàn tất' : 'hủy'} phiếu xuất và cập nhật lượng hàng giữ chỗ.`); await load() }
    catch (reason) { setError(errorMessage(reason)) }
  }
  const concurrencyRows = orders.map((order) => ({ id: order.id, code: order.code, customer: order.customer, status: order.status, issueDate: order.issueDate }))
  return <Page eyebrow="QUẢN LÝ XUẤT KHO" title="Đơn xuất kho" description="Giữ chỗ hàng khả dụng khi tạo phiếu và trừ tồn kho khi hoàn tất xuất hàng.">
    {(error || message) && <Notice message={error || message} kind={error ? 'error' : 'success'} />}
    <Panel title="Tạo phiếu xuất kho" subtitle="Khóa dòng dữ liệu giúp tránh xuất vượt tồn khi nhiều yêu cầu cùng lúc">
      <form className="filter-bar" onSubmit={(event) => void submit(event)}>
        <Field label="Mã phiếu xuất"><input required value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} placeholder="PX-0001" /></Field>
        <Field label="Khách hàng"><select required value={form.customerId} onChange={(event) => setForm({ ...form, customerId: event.target.value })}><option value="">Chọn khách hàng</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></Field>
        <Field label="Hàng hóa"><select required value={form.productId} onChange={(event) => setForm({ ...form, productId: event.target.value })}><option value="">Chọn hàng hóa</option>{products.map((product) => <option key={product.id} value={product.id}>{product.sku} — {product.name}</option>)}</select></Field>
        <Field label="Vị trí lấy hàng"><select required value={form.locationId} onChange={(event) => setForm({ ...form, locationId: event.target.value })}><option value="">Chọn vị trí</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.code}</option>)}</select></Field>
        <Field label="Số lượng"><input required type="number" min="1" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} /></Field>
        <button className="button button-primary" type="submit"><Plus size={16} />Giữ chỗ hàng</button>
      </form>
    </Panel>
    <Panel title="Danh sách phiếu xuất" subtitle="Các yêu cầu đồng thời được bảo vệ bằng khóa dòng cơ sở dữ liệu">
      <DataTable rows={concurrencyRows} actions={(order) => order.status === 'PENDING' ? <div className="inline-actions">
        <button className="icon-button success-icon" aria-label="Hoàn tất phiếu xuất" onClick={() => void changeStatus(Number(order.id), 'complete')}><Check size={16} /></button>
        <button className="icon-button danger-icon" aria-label="Hủy phiếu xuất" onClick={() => void changeStatus(Number(order.id), 'cancel')}><X size={16} /></button>
      </div> : null} />
      {!orders.length && <div className="panel-empty"><Truck size={17} />Chưa có phiếu xuất kho nào.</div>}
    </Panel>
  </Page>
}
