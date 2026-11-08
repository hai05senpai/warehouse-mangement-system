import { useState } from 'react'
import { Activity, AlertTriangle, FileBarChart2, Search } from 'lucide-react'
import { api, errorMessage, type Row } from '../api'
import { DataTable } from '../components/DataTable'
import { Field, Notice, Page, Panel } from '../components/Page'

const today = new Date().toISOString().slice(0, 10)
const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
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

  async function runReport() {
    setError(''); setLoaded(false)
    try {
      let response
      if (tab === 'low-stock') response = await api.get<Row[]>('/reports/low-stock')
      else if (tab === 'stagnant') response = await api.get<Row[]>('/reports/stagnant', { params: { days: Number(days) } })
      else if (tab === 'in-out') response = await api.get<Row[]>('/reports/in-out', { params: { start: startOf(start), end: endOf(end) } })
      else {
        if (!sku.trim()) { setError('Enter an exact SKU to view its movement history.'); return }
        response = await api.get<Row[]>(`/products/${encodeURIComponent(sku.trim())}/trace`, { params: { start: startOf(start), end: endOf(end) } })
      }
      setRows(response.data); setLoaded(true)
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
        </>}
        <button className="button button-primary" onClick={() => void runReport()}><Search size={16} />Tạo báo cáo</button>
      </div>
      {loaded && <DataTable rows={rows} empty="Không có dữ liệu phù hợp với báo cáo này." />}
      {!loaded && !error && <div className="panel-empty"><FileBarChart2 size={17} />Chọn điều kiện và tạo báo cáo để xem kết quả.</div>}
    </Panel>
  </Page>
}
