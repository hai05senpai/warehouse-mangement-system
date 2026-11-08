import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Dashboard } from './pages/Dashboard'
import { Inventory } from './pages/Inventory'
import { Issues } from './pages/Issues'
import { Products } from './pages/Products'
import { Receipts } from './pages/Receipts'
import { Reports } from './pages/Reports'
import { StockTakes } from './pages/StockTakes'

export default function App() {
  return <BrowserRouter><Routes><Route element={<Layout />}>
    <Route index element={<Navigate to="/dashboard" replace />} />
    <Route path="/dashboard" element={<Dashboard />} />
    <Route path="/products" element={<Products />} />
    <Route path="/inventory" element={<Inventory />} />
    <Route path="/receipts" element={<Receipts />} />
    <Route path="/issues" element={<Issues />} />
    <Route path="/stock-takes" element={<StockTakes />} />
    <Route path="/reports" element={<Reports />} />
    <Route path="*" element={<Navigate to="/dashboard" replace />} />
  </Route></Routes></BrowserRouter>
}
