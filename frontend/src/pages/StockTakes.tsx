import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Check, ClipboardCheck, Plus } from 'lucide-react'
import { api, errorMessage, type Row } from '../api'
import { DataTable } from '../components/DataTable'
import { Field, Notice, Page, Panel } from '../components/Page'

type Ref = { id: number; sku?: string; name?: string; code?: string }
export function StockTakes() {
  const [takes, setTakes] = useState<Row[]>([])
  const [products, setProducts] = useState<Ref[]>([])
  const [locations, setLocations] = useState<Ref[]>([])
  const [form, setForm] = useState({ code: '', createdBy: 'Admin user', productId: '', locationId: '', actualQty: '0' })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const load = useCallback(() => api.get<Row[]>('/stock-takes').then((response) => setTakes(response.data))
    .catch((reason: unknown) => setError(errorMessage(reason))), [])
  useEffect(() => {
    void load()
    Promise.all([api.get<Ref[]>('/products'), api.get<Ref[]>('/locations')])
      .then(([p, l]) => { setProducts(p.data); setLocations(l.data) })
      .catch((reason: unknown) => setError(errorMessage(reason)))
  }, [load])
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setMessage('')
    try {
      await api.post('/stock-takes', { code: form.code, createdBy: form.createdBy, items: [{ productId: Number(form.productId), locationId: Number(form.locationId), actualQty: Number(form.actualQty) }] })
      setMessage('Đã lưu phiếu kiểm kê ở trạng thái bản nháp. Xác nhận hoàn tất để điều chỉnh tồn kho.')
      setForm({ ...form, code: '', productId: '', locationId: '', actualQty: '0' }); await load()
    } catch (reason) { setError(errorMessage(reason)) }
  }
  async function complete(id: number) {
    setError(''); setMessage('')
    try { await api.put(`/stock-takes/${id}/complete`, null, { params: { approvedBy: 'Quản trị viên' } }); setMessage('Đã áp dụng điều chỉnh theo kết quả kiểm kê.'); await load() }
    catch (reason) { setError(errorMessage(reason)) }
  }
  return <Page eyebrow="KIỂM SOÁT TỒN KHO" title="Kiểm kê kho" description="Đối chiếu số lượng thực tế với số liệu hệ thống và xác nhận điều chỉnh.">
    {(error || message) && <Notice message={error || message} kind={error ? 'error' : 'success'} />}
    <Panel title="Ghi nhận số lượng kiểm kê" subtitle="Lưu số tồn hệ thống và tự động tính chênh lệch cần điều chỉnh">
      <form className="filter-bar" onSubmit={(event) => void submit(event)}>
        <Field label="Mã phiếu kiểm kê"><input required value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} placeholder="KK-0001" /></Field>
        <Field label="Hàng hóa"><select required value={form.productId} onChange={(event) => setForm({ ...form, productId: event.target.value })}><option value="">Chọn hàng hóa</option>{products.map((product) => <option key={product.id} value={product.id}>{product.sku} — {product.name}</option>)}</select></Field>
        <Field label="Vị trí"><select required value={form.locationId} onChange={(event) => setForm({ ...form, locationId: event.target.value })}><option value="">Chọn vị trí</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.code}</option>)}</select></Field>
        <Field label="Số lượng thực tế"><input required type="number" min="0" value={form.actualQty} onChange={(event) => setForm({ ...form, actualQty: event.target.value })} /></Field>
        <button className="button button-primary" type="submit"><Plus size={16} />Lưu kết quả</button>
      </form>
    </Panel>
    <Panel title="Danh sách phiếu kiểm kê" subtitle={`${takes.length} phiếu kiểm kê`}>
      <DataTable rows={takes} actions={(take) => take.status === 'DRAFT' ? <button className="icon-button success-icon" aria-label="Xác nhận kiểm kê" onClick={() => void complete(Number(take.id))}><Check size={16} /></button> : null} />
      {!takes.length && <div className="panel-empty"><ClipboardCheck size={17} />Chưa có phiếu kiểm kê nào.</div>}
    </Panel>
  </Page>
}
