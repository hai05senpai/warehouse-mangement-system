import { useState } from 'react'
import { Activity, AlertTriangle, FileBarChart2, Search } from 'lucide-react'
import { api, errorMessage, type Row } from '../api'
import { DataTable } from '../components/DataTable'
import { Field, Notice, Page, Panel } from '../components/Page'

// Ngày theo giờ máy người dùng (YYYY-MM-DD). toISOString() là giờ UTC: trước 7h sáng ở VN sẽ ra ngày hôm qua.
function localDate(date: Date) { return date.toLocaleDateString('sv-SE') }
const today = localDate(new Date())
const monthAgo = localDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
function startOf(value: string) { return new Date(`${value}T00:00:00`).toISOString() }
function endOf(value: string) { return new Date(new Date(`${value}T00:00:00`).getTime() + 86400000).toISOString() }

export function Reports() {
  const [tab, setTab] = useState<'low-stock' | 'stagnant' | 'in-out' | 'trace'>('low-stock')
  const [rows, setRows] = useState<Row[]>([])
  const [sku, setSku] = useState('')
  const [days, setDays] = useState('90')
  const [start, setStart] = useState(monthAgo)
  const [end, setEnd] = useState(today)
  const [error, setError] = useState('')
  const [loaded, setLoaded] = useState(false)
  // Báo cáo nhập–xuất–tồn: mặc định chỉ hiện mặt hàng có nhập/xuất/điều chỉnh trong kỳ
  const [onlyMoving, setOnlyMoving] = useState(true)
  const hasMovement = (row: Row) => [row.receivedQuantity, row.issuedQuantity, row.adjustmentQuantity].some((value) => Number(value ?? 0) !== 0)
  const visibleRows = tab === 'in-out' && onlyMoving ? rows.filter(hasMovement) : rows

  async function runReport() {
    setError(''); setLoaded(false)
    if (tab === 'in-out' || tab === 'trace') {
      if (!start || !end) { setError('Vui lòng chọn đủ "Từ ngày" và "Đến ngày".'); return }
      if (start > end) { setError('"Từ ngày" phải trước hoặc trùng "Đến ngày".'); return }
    }
    try {
      let response
      if (tab === 'low-stock') response = await api.get<Row[]>('/reports/low-stock')
      else if (tab === 'stagnant') response = await api.get<Row[]>('/reports/stagnant', { params: { days: Number(days) } })
      else if (tab === 'in-out') response = await api.get<Row[]>('/reports/in-out', { params: { start: startOf(start), end: endOf(end) } })
      else {
        if (!sku.trim()) { setError('Enter an exact SKU to view its movement history.'); return }
        response = await api.get<Row[]>(`/products/${encodeURIComponent(sku.trim())}/trace`, { params: { start: startOf(start), end: endOf(end) } })
      }
      // Bảng chỉ hiện 7 cột: bỏ productId của báo cáo nhập–xuất–tồn để không bị mất cột "Tồn cuối kỳ"
      setRows(tab === 'in-out' ? response.data.map((row) => Object.fromEntries(Object.entries(row).filter(([key]) => key !== 'productId'))) : response.data); setLoaded(true)
    } catch (reason) { setError(errorMessage(reason)) }
  }
  const tabs = [
    { key: 'low-stock' as const, label: 'Tồn kho thấp', icon: AlertTriangle },
    { key: 'stagnant' as const, label: 'Hàng chậm luân chuyển', icon: Activity },
    { key: 'in-out' as const, label: 'Báo cáo nhập - xuất - tồn', icon: FileBarChart2 },
    { key: 'trace' as const, label: 'Truy vết hàng hóa', icon: Search },
  ]
  return <Page eyebrow="PHÂN TÍCH DỮ LIỆU" title="Báo cáo & truy vết" description="Theo dõi hàng sắp hết, luân chuyển kho và lịch sử giao dịch theo SKU.">
    {error && <Notice message={error} />}
    <div className="report-tabs">{tabs.map(({ key, label, icon: Icon }) => <button key={key} className={`report-tab ${tab === key ? 'report-tab-active' : ''}`} onClick={() => { setTab(key); setRows([]); setLoaded(false); setError('') }}><Icon size={16} />{label}</button>)}</div>
    <Panel title={tabs.find((item) => item.key === tab)?.label ?? 'Report'} subtitle={
      tab === 'low-stock' ? 'Các mặt hàng có tổng tồn kho thấp hơn mức tối thiểu đã thiết lập.'
        : tab === 'stagnant' ? 'Hàng còn tồn nhưng không có giao dịch xuất trong khoảng thời gian chọn.'
          : tab === 'in-out' ? 'Tồn đầu kỳ, nhập, xuất, điều chỉnh và tồn cuối kỳ theo từng mặt hàng.'
            : 'Lịch sử nhập, xuất, điều chuyển và điều chỉnh theo thời gian của một SKU.'}>
      <div className="report-filters">
        {tab === 'stagnant' && <Field label="Không phát sinh xuất trong"><div className="input-suffix"><input min="1" max="3650" type="number" value={days} onChange={(event) => setDays(event.target.value)} /><span>ngày</span></div></Field>}
        {(tab === 'in-out' || tab === 'trace') && <>
          {tab === 'trace' && <Field label="Mã SKU"><input value={sku} onChange={(event) => setSku(event.target.value)} placeholder="Nhập mã SKU" /></Field>}
          <Field label="Từ ngày"><input type="date" value={start} onChange={(event) => setStart(event.target.value)} /></Field>
          <Field label="Đến ngày"><input type="date" value={end} onChange={(event) => setEnd(event.target.value)} /></Field>
          {tab === 'in-out' && <label className="check-field"><input type="checkbox" checked={onlyMoving} onChange={(event) => setOnlyMoving(event.target.checked)} /> Chỉ mặt hàng có phát sinh</label>}
        </>}
        <button className="button button-primary" onClick={() => void runReport()}><Search size={16} />Tạo báo cáo</button>
      </div>
      {loaded && tab === 'in-out' && onlyMoving && <p className="report-note">{visibleRows.length}/{rows.length} mặt hàng có nhập, xuất hoặc điều chỉnh từ {start.split('-').reverse().join('/')} đến {end.split('-').reverse().join('/')}.</p>}
      {loaded && <DataTable rows={visibleRows} empty={tab === 'in-out' && onlyMoving ? 'Không có mặt hàng nào phát sinh nhập, xuất hoặc điều chỉnh trong kỳ này. Bỏ tick "Chỉ mặt hàng có phát sinh" để xem đủ danh mục.' : 'Không có dữ liệu phù hợp với báo cáo này.'} />}
      {!loaded && !error && <div className="panel-empty"><FileBarChart2 size={17} />Chọn điều kiện và tạo báo cáo để xem kết quả.</div>}
    </Panel>
  </Page>
}
