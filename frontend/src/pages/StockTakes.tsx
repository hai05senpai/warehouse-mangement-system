import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Check, ClipboardCheck, Eye, Plus, X } from 'lucide-react'
import { api, errorMessage, type Row } from '../api'
import { DataTable } from '../components/DataTable'
import { Field, Notice, Page, Panel } from '../components/Page'

type Ref = { id: number; sku?: string; name?: string; code?: string; zone?: string }
type StockTakeItemRow = {
  id: number
  product?: Ref
  location?: Ref
  systemQty: number
  actualQty: number
  diffQty: number
}
type StockTakeSummary = {
  itemCount: number
  systemQuantity: number
  actualQuantity: number
  difference: number
}

export function StockTakes() {
  const [takes, setTakes] = useState<Row[]>([])
  const [products, setProducts] = useState<Ref[]>([])
  const [locations, setLocations] = useState<Ref[]>([])
  const [form, setForm] = useState({ code: '', createdBy: 'Admin user', productId: '', locationId: '', actualQty: '0' })
  const [selectedTake, setSelectedTake] = useState<Row | null>(null)
  const [detailItems, setDetailItems] = useState<Row[]>([])
  const [summary, setSummary] = useState<StockTakeSummary | null>(null)
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

  async function viewDetails(take: Row) {
    setError('')
    try {
      const id = Number(take.id)
      const [itemsRes, summaryRes] = await Promise.all([
        api.get<StockTakeItemRow[]>(`/stock-takes/${id}/items`),
        api.get<StockTakeSummary>(`/stock-takes/${id}/summary`),
      ])
      setSelectedTake(take)
      setSummary(summaryRes.data)
      setDetailItems(
        itemsRes.data.map((item) => ({
          id: item.id,
          sku: item.product?.sku ?? '—',
          productName: item.product?.name ?? '—',
          location: item.location?.code ?? '—',
          systemQty: item.systemQty,
          actualQty: item.actualQty,
          diffQty: item.diffQty > 0 ? `+${item.diffQty}` : item.diffQty,
        }))
      )
    } catch (reason) {
      setError(errorMessage(reason))
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setMessage('')
    try {
      const res = await api.post<Row>('/stock-takes', {
        code: form.code,
        createdBy: form.createdBy,
        items: [{ productId: Number(form.productId), locationId: Number(form.locationId), actualQty: Number(form.actualQty) }],
      })
      setMessage('Đã lưu phiếu kiểm kê ở trạng thái bản nháp. Xác nhận hoàn tất để điều chỉnh tồn kho.')
      setForm({ ...form, code: '', productId: '', locationId: '', actualQty: '0' })
      await load()
      await viewDetails(res.data)
    } catch (reason) { setError(errorMessage(reason)) }
  }

  async function complete(id: number) {
    setError(''); setMessage('')
    try {
      const res = await api.put<Row>(`/stock-takes/${id}/complete`, null, { params: { approvedBy: 'Quản trị viên' } })
      setMessage('Đã áp dụng điều chỉnh theo kết quả kiểm kê.')
      await load()
      if (selectedTake && Number(selectedTake.id) === id) {
        await viewDetails(res.data)
      }
    } catch (reason) { setError(errorMessage(reason)) }
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

    {selectedTake && summary && (
      <Panel
        title={`Chi tiết & Đối chiếu chênh lệch: ${String(selectedTake.code)}`}
        subtitle="Tổng hợp bằng Aggregate Functions (COUNT, SUM) và truy vấn JOIN chi tiết mặt hàng - vị trí kệ"
        action={
          <div className="inline-actions">
            {selectedTake.status === 'DRAFT' && (
              <button className="button button-primary" type="button" onClick={() => void complete(Number(selectedTake.id))}>
                <Check size={15} /> Duyệt & Điều chỉnh tồn kho
              </button>
            )}
            <button className="icon-button" type="button" aria-label="Đóng chi tiết" onClick={() => { setSelectedTake(null); setSummary(null) }}>
              <X size={16} />
            </button>
          </div>
        }
      >
        <DataTable
          searchable={false}
          rows={[{
            id: 'summary',
            code: selectedTake.code,
            status: selectedTake.status,
            itemCount: summary.itemCount,
            systemQuantity: summary.systemQuantity,
            actualQuantity: summary.actualQuantity,
            difference: summary.difference > 0 ? `+${summary.difference}` : summary.difference,
          }]}
        />
        <div style={{ marginTop: '14px' }}>
          <DataTable searchable={false} rows={detailItems} empty="Phiếu kiểm kê không có mặt hàng." />
        </div>
      </Panel>
    )}

    <Panel title="Danh sách phiếu kiểm kê" subtitle={`${takes.length} phiếu kiểm kê`}>
      <DataTable
        rows={takes}
        actions={(take) => (
          <div className="inline-actions">
            <button
              className="icon-button"
              title="Xem chi tiết đối chiếu & chênh lệch"
              aria-label="Xem chi tiết kiểm kê"
              onClick={() => void viewDetails(take)}
            >
              <Eye size={16} />
            </button>
            {take.status === 'DRAFT' && (
              <button
                className="icon-button success-icon"
                title="Xác nhận duyệt kiểm kê"
                aria-label="Xác nhận kiểm kê"
                onClick={() => void complete(Number(take.id))}
              >
                <Check size={16} />
              </button>
            )}
          </div>
        )}
      />
      {!takes.length && <div className="panel-empty"><ClipboardCheck size={17} />Chưa có phiếu kiểm kê nào.</div>}
    </Panel>
  </Page>
}
