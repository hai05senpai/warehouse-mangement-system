import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  ArrowDownToLine, BarChart3, Boxes, ChevronDown, ClipboardCheck,
  LayoutDashboard, LogOut, Menu, Package, Search, Truck, X,
} from 'lucide-react'
import { api, clearStoredAuth, getStoredAdmin } from '../api'

const navigation = [
  { to: '/dashboard', label: 'Tổng quan', icon: LayoutDashboard },
  { to: '/products', label: 'Danh mục hàng hóa', icon: Package },
  { to: '/inventory', label: 'Tồn kho & tìm kiếm', icon: Search },
  { to: '/receipts', label: 'Đơn nhập kho', icon: ArrowDownToLine },
  { to: '/issues', label: 'Đơn xuất kho', icon: Truck },
  { to: '/stock-takes', label: 'Kiểm kê kho', icon: ClipboardCheck },
  { to: '/reports', label: 'Báo cáo & truy vết', icon: BarChart3 },
]

function formatRole(role?: string): string {
  switch (role) {
    case 'SUPER_ADMIN':
      return 'Quản trị viên cấp cao'
    case 'WAREHOUSE_MANAGER':
      return 'Quản lý kho'
    case 'STAFF':
      return 'Nhân viên kho'
    default:
      return 'Quản trị viên'
  }
}

function getInitials(name?: string): string {
  if (!name) return 'AD'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function Layout() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const admin = getStoredAdmin()
  const displayName = admin?.fullName || admin?.username || 'Quản trị viên'
  const displayRole = formatRole(admin?.role)
  const initials = getInitials(displayName)

  async function handleLogout() {
    try {
      await api.post('/auth/logout')
    } catch {
      // Ignore logout network error and still clear local session
    } finally {
      clearStoredAuth()
      navigate('/login', { replace: true })
    }
  }

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
          <div className="user-card">
            <div className="avatar">{initials}</div>
            <div className="user-info">
              <strong>{displayName}</strong>
              <span>{displayRole}</span>
            </div>
            <button
              type="button"
              className="icon-button logout-icon-button"
              onClick={() => void handleLogout()}
              title="Đăng xuất"
              aria-label="Đăng xuất"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>
      <main className="main-area">
        <header className="topbar">
          <button className="mobile-menu icon-button" onClick={() => setOpen(true)} aria-label="Mở menu"><Menu size={20} /></button>
          <div className="breadcrumb">Không gian làm việc <span>/</span> <strong>Vận hành</strong></div>
          <div className="topbar-right">
            <span className="live-status"><i /> Đang hoạt động</span>
            <div className="avatar avatar-small" title={displayName}>{initials}</div>
            <button
              type="button"
              className="button button-secondary logout-button"
              onClick={() => void handleLogout()}
            >
              <LogOut size={14} />
              <span>Đăng xuất</span>
            </button>
          </div>
        </header>
        <div className="page-content"><Outlet /></div>
      </main>
    </div>
  )
}
