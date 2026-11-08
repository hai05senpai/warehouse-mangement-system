import { useEffect, useState } from 'react'
import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine, Boxes, Package, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api, errorMessage, type Row } from '../api'
import { DataTable } from '../components/DataTable'
import { Notice, Page, Panel } from '../components/Page'

type Summary = { productCount: number; stockedProductCount: number; totalQuantity: number; lowStockCount: number }

export function Dashboard() {
  const [summary, setSummary] = useState<Summary>()
  const [lowStock, setLowStock] = useState<Row[]>([])
  const [receipts, setReceipts] = useState<Row[]>([])
  const [issues, setIssues] = useState<Row[]>([])
  const [error, setError] = useState('')
  useEffect(() => {
    Promise.all([
      api.get<Summary>('/dashboard/summary'), api.get<Row[]>('/reports/low-stock'),
      api.get<Row[]>('/receipt-orders'), api.get<Row[]>('/issue-orders'),
    ]).then(([stats, low, receiptOrders, issueOrders]) => {
      setSummary(stats.data); setLowStock(low.data); setReceipts(receiptOrders.data.slice(0, 4)); setIssues(issueOrders.data.slice(0, 4))
    }).catch((reason: unknown) => setError(errorMessage(reason)))
  }, [])
  const activityRows: Row[] = [
    ...receipts.map((item) => ({ ...item, activity: 'Receipt order' })),
    ...issues.map((item) => ({ ...item, activity: 'Issue order' })),
  ]
  const metrics = [
    { label: 'MẶT HÀNG', value: summary?.productCount, icon: Package, tone: 'violet', foot: `${summary?.stockedProductCount ?? 0} mặt hàng đang có tồn` },
    { label: 'TỔNG SỐ LƯỢNG', value: summary?.totalQuantity?.toLocaleString('vi-VN'), icon: Boxes, tone: 'blue', foot: 'Tại tất cả vị trí trong kho' },
    { label: 'CẢNH BÁO TỒN THẤP', value: summary?.lowStockCount, icon: AlertTriangle, tone: 'amber', foot: 'Mặt hàng dưới mức tồn tối thiểu' },
    { label: 'ĐƠN CHỜ XỬ LÝ', value: [...receipts, ...issues].filter((order) => order.status === 'PENDING').length, icon: ArrowDownToLine, tone: 'green', foot: 'Đơn nhập và xuất đang chờ' },
  ]
  return <Page eyebrow="TỔNG QUAN" title="Xin chào, Quản trị viên" description="Tình hình hoạt động kho hàng của bạn hôm nay."
    action={<Link className="button button-primary" to="/receipts"><Plus size={17} /> Tạo phiếu nhập</Link>}>
    {error && <Notice message={error} />}
    <div className="metric-grid">{metrics.map(({ label, value, icon: Icon, tone, foot }) =>
      <article className="metric-card" key={label}><div className={`metric-icon tone-${tone}`}><Icon size={19} /></div><div className="metric-label">{label}</div><div className="metric-value">{value ?? '—'}</div><div className="metric-foot">{foot}</div></article>)}</div>
    <div className="dashboard-grid">
      <Panel title="Cảnh báo tồn kho thấp" subtitle="Mặt hàng có tồn kho dưới mức tối thiểu" action={<Link className="text-link" to="/reports">Xem báo cáo →</Link>}>
        <DataTable rows={lowStock.slice(0, 5)} searchable={false} empty="Tất cả mặt hàng đều đủ tồn kho." />
      </Panel>
      <Panel title="Hoạt động gần đây" subtitle="Trạng thái đơn hàng mới nhất">
        <div className="activity-list">
          {activityRows.slice(0, 6).map((item, index) => <div className="activity-item" key={`${item.id ?? item.code}-${index}`}>
              <div className={`activity-icon ${item.activity === 'Receipt order' ? 'activity-in' : 'activity-out'}`}>{item.activity === 'Receipt order' ? <ArrowDownToLine size={15} /> : <ArrowUpFromLine size={15} />}</div>
              <div className="activity-copy"><strong>{String(item.code ?? item.activity)}</strong><span>{item.activity === 'Receipt order' ? 'Phiếu nhập kho' : 'Phiếu xuất kho'}</span></div>
              <span className={`badge badge-${String(item.status ?? '').toLowerCase()}`}>{item.status === 'PENDING' ? 'Chờ xử lý' : item.status === 'COMPLETED' ? 'Hoàn tất' : item.status === 'CANCELLED' ? 'Đã hủy' : '—'}</span>
            </div>)}
          {!receipts.length && !issues.length && <div className="empty-state">Chưa có đơn hàng gần đây.</div>}
        </div>
      </Panel>
    </div>
  </Page>
}
