import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Check, ClipboardCheck, Plus, Trash2, X } from 'lucide-react'
import { api, errorMessage, getStoredAdmin, type Row } from '../api'
import { DataTable } from '../components/DataTable'
import { Field, Notice, Page, Panel } from '../components/Page'

type Ref = { id: number; sku?: string; name?: string; code?: string; zone?: string }
type StockTakeLine = { productId: string; locationId: string; actualQty: string }
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

const emptyLine = (): StockTakeLine => ({ productId: '', locationId: '', actualQty: '0' })

export function StockTakes() {
  const admin = getStoredAdmin()
  const [takes, setTakes] = useState<Row[]>([])
  const [products, setProducts] = useState<Ref[]>([])
  const [locations, setLocations] = useState<Ref[]>([])
  const [code, setCode] = useState('')
  const [items, setItems] = useState<StockTakeLine[]>([emptyLine()])
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

  function updateLine(index: number, patch: Partial<StockTakeLine>) {
    setItems((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)))
  }

  function addLine() {
    setItems((prev) => [...prev, emptyLine()])
  }

  function removeLine(index: number) {
    if (items.length <= 1) return
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

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
        code: code.trim(),
        createdBy: admin?.fullName || admin?.username || 'Admin user',
        items: items.map((line) => ({
          productId: Number(line.productId),
          locationId: Number(line.locationId),
          actualQty: Number(line.actualQty),
        })),
      })
      setMessage(`Đã lưu phiếu kiểm kê (${items.length} mặt hàng) ở trạng thái bản nháp. Xác nhận hoàn tất để điều chỉnh tồn kho.`)
      setCode('')
      setItems([emptyLine()])
      await load()
      await viewDetails(res.data)
    } catch (reason) { setError(errorMessage(reason)) }
  }

  async function changeStatus(id: number, action: 'complete' | 'cancel') {
    setError(''); setMessage('')
    try {
      const res = action === 'complete'
        ? await api.put<Row>(`/stock-takes/${id}/complete`, null, {
            params: { approvedBy: admin?.fullName || admin?.username || 'Quản trị viên' },
          })
        : await api.put<Row>(`/stock-takes/${id}/cancel`)
      setMessage(action === 'complete' ? 'Đã áp dụng điều chỉnh theo kết quả kiểm kê.' : 'Đã hủy phiếu kiểm kê.')
      await load()
      if (selectedTake && Number(selectedTake.id) === id) {
        await viewDetails(res.data)
      }
    } catch (reason) { setError(errorMessage(reason)) }
  }

  return <Page eyebrow="KIỂM SOÁT TỒN KHO" title="Kiểm kê kho" description="Đối chiếu số lượng thực tế với số liệu hệ thống và xác nhận điều chỉnh.">
    {(error || message) && <Notice message={error || message} kind={error ? 'error' : 'success'} />}
    <Panel title="Ghi nhận số lượng kiểm kê" subtitle="Một phiếu kiểm kê (StockTake) hỗ trợ kiểm đếm nhiều mặt hàng (StockTakeItem) và tự động tổng hợp chênh lệch">
      <form className="form-stack" onSubmit={(event) => void submit(event)}>
        <div className="filter-bar" style={{ marginBottom: 0 }}>
          <Field label="Mã phiếu kiểm kê">
            <input required value={code} onChange={(event) => setCode(event.target.value)} placeholder="KK-0001" />
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
            <Field label="Vị trí">
              <select required value={line.locationId} onChange={(event) => updateLine(index, { locationId: event.target.value })}>
                <option value="">Chọn vị trí</option>
                {locations.map((location) => <option key={location.id} value={location.id}>{location.code}</option>)}
              </select>
            </Field>
            <Field label="Số lượng thực tế">
              <input required type="number" min="0" value={line.actualQty} onChange={(event) => updateLine(index, { actualQty: event.target.value })} />
            </Field>
            <button
              type="button"
              className="icon-button danger-icon"
              disabled={items.length <= 1}
              title="Xóa dòng kiểm kê"
              aria-label="Xóa dòng kiểm kê"
              onClick={() => removeLine(index)}
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}

        <div className="form-actions" style={{ justifyContent: 'space-between' }}>
          <button type="button" className="button button-secondary" onClick={addLine}>
            <Plus size={15} /> Thêm dòng kiểm kê
          </button>
          <button className="button button-primary" type="submit">
            <Plus size={16} /> Lưu kết quả ({items.length} dòng)
          </button>
        </div>
      </form>
    </Panel>

    {selectedTake && summary && (
      <Panel
        title={`Chi tiết & Đối chiếu chênh lệch: ${String(selectedTake.code)}`}
        subtitle="Tổng hợp bằng Aggregate Functions (COUNT, SUM) và truy vấn JOIN chi tiết mặt hàng - vị trí kệ"
        action={
          <div className="inline-actions">
            {selectedTake.status === 'DRAFT' && (
              <>
                <button className="button button-primary" type="button" onClick={() => void changeStatus(Number(selectedTake.id), 'complete')}>
                  <Check size={15} /> Duyệt & Điều chỉnh tồn kho
                </button>
                <button className="button button-secondary" type="button" onClick={() => void changeStatus(Number(selectedTake.id), 'cancel')}>
                  <X size={15} /> Hủy phiếu
                </button>
              </>
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

    <Panel title="Danh sách phiếu kiểm kê" subtitle="Nhấp vào một dòng phiếu kiểm kê để xem chi tiết các mặt hàng (StockTakeItem) và tổng hợp chênh lệch">
      <DataTable
        rows={takes}
        selectedRowId={selectedTake?.id}
        onRowClick={(row) => void viewDetails(row)}
        actions={(take) => take.status === 'DRAFT' ? (
          <div className="inline-actions">
            <button
              className="icon-button success-icon"
              title="Duyệt kiểm kê (Approve)"
              aria-label="Xác nhận kiểm kê"
              onClick={() => void changeStatus(Number(take.id), 'complete')}
            >
              <Check size={16} />
            </button>
            <button
              className="icon-button danger-icon"
              title="Hủy phiếu kiểm kê (Disapprove)"
              aria-label="Hủy phiếu kiểm kê"
              onClick={() => void changeStatus(Number(take.id), 'cancel')}
            >
              <X size={16} />
            </button>
          </div>
        ) : null}
      />
      {!takes.length && <div className="panel-empty"><ClipboardCheck size={17} />Chưa có phiếu kiểm kê nào.</div>}
    </Panel>
  </Page>
}
