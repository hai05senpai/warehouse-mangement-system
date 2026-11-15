import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { getStoredToken } from './api'
import { Layout } from './components/Layout'
import { Dashboard } from './pages/Dashboard'
import { Inventory } from './pages/Inventory'
import { Issues } from './pages/Issues'
import { Login } from './pages/Login'
import { Products } from './pages/Products'
import { Receipts } from './pages/Receipts'
import { Reports } from './pages/Reports'
import { StockTakes } from './pages/StockTakes'
import type { ReactElement } from 'react'

function RequireAuth({ children }: { children: ReactElement }) {
  const token = getStoredToken()
  if (!token) {
    return <Navigate to="/login" replace />
  }
  return children
}

function PublicOnly({ children }: { children: ReactElement }) {
  const token = getStoredToken()
  if (token) {
    return <Navigate to="/dashboard" replace />
  }
  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
        <Route element={<RequireAuth><Layout /></RequireAuth>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/products" element={<Products />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/receipts" element={<Receipts />} />
          <Route path="/issues" element={<Issues />} />
          <Route path="/stock-takes" element={<StockTakes />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
