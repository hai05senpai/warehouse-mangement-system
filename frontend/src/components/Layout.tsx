import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import {
  ArrowDownToLine, BarChart3, Boxes, ChevronDown, ClipboardCheck,
  LayoutDashboard, Menu, Package, Search, Truck, X,
} from 'lucide-react'

const navigation = [
  { to: '/dashboard', label: 'Tổng quan', icon: LayoutDashboard },
  { to: '/products', label: 'Danh mục hàng hóa', icon: Package },
  { to: '/inventory', label: 'Tồn kho & tìm kiếm', icon: Search },
  { to: '/receipts', label: 'Đơn nhập kho', icon: ArrowDownToLine },
  { to: '/issues', label: 'Đơn xuất kho', icon: Truck },
  { to: '/stock-takes', label: 'Kiểm kê kho', icon: ClipboardCheck },
  { to: '/reports', label: 'Báo cáo & truy vết', icon: BarChart3 },
]

export function Layout() {
  const [open, setOpen] = useState(false)
  return (
    <div className="app-shell">
      {open && <button className="mobile-backdrop" aria-label="Đóng điều hướng" onClick={() => setOpen(false)} />}
      <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
        <div className="brand">
          <div className="brand-mark"><Boxes size={22} /></div>
          <div><strong>Stockroom</strong><span>QUẢN LÝ KHO HÀNG</span></div>
          <button className="mobile-close icon-button" onClick={() => setOpen(false)} aria-label="Đóng menu"><X size={18} /></button>
        </div>
        <div className="nav-caption">KHÔNG GIAN LÀM VIỆC</div>
        <nav className="nav-list">
          {navigation.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} onClick={() => setOpen(false)} className={({ isActive }) => `nav-link ${isActive ? 'nav-active' : ''}`}>
              <Icon size={18} strokeWidth={1.8} /><span>{label}</span>{label === 'Báo cáo & truy vết' && <ChevronDown className="nav-trailing" size={14} />}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="warehouse-card"><div className="online-dot" /><div><strong>Kho chính</strong><span>Hệ thống hoạt động</span></div></div>
          <div className="user-card"><div className="avatar">AD</div><div><strong>Quản trị viên</strong><span>Quản lý kho</span></div><ChevronDown size={15} /></div>
        </div>
      </aside>
      <main className="main-area">
        <header className="topbar">
          <button className="mobile-menu icon-button" onClick={() => setOpen(true)} aria-label="Mở menu"><Menu size={20} /></button>
          <div className="breadcrumb">Không gian làm việc <span>/</span> <strong>Vận hành</strong></div>
          <div className="topbar-right"><span className="live-status"><i /> Đang hoạt động</span><div className="avatar avatar-small">AD</div></div>
        </header>
        <div className="page-content"><Outlet /></div>
      </main>
    </div>
  )
}
