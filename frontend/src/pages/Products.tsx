import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Pencil, Plus, Trash2, X } from 'lucide-react'
import { api, errorMessage, type Row } from '../api'
import { DataTable } from '../components/DataTable'
import { Field, Notice, Page, Panel } from '../components/Page'

type Product = Row & { id: number; sku: string; name: string; category?: string; unit?: string; minQuantity?: number }
const initialForm = { sku: '', name: '', category: '', unit: '', minQuantity: '' }

export function Products() {
  const [products, setProducts] = useState<Product[]>([])
  const [form, setForm] = useState(initialForm)
  const [editing, setEditing] = useState<number>()
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const load = useCallback(() => api.get<Product[]>('/products').then((response) => setProducts(response.data))
    .catch((reason: unknown) => setError(errorMessage(reason))), [])
  useEffect(() => { void load() }, [load])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setSuccess(''); setLoading(true)
    const payload = { ...form, minQuantity: form.minQuantity === '' ? null : Number(form.minQuantity) }
    try {
      if (editing) await api.put(`/products/${editing}`, payload)
      else await api.post('/products', payload)
      setForm(initialForm); setEditing(undefined); setSuccess(editing ? 'Đã cập nhật hàng hóa.' : 'Đã thêm hàng hóa.')
      await load()
    } catch (reason) { setError(errorMessage(reason)) } finally { setLoading(false) }
  }
  function edit(product: Product) {
    setEditing(product.id)
    setForm({ sku: product.sku, name: product.name, category: product.category ?? '', unit: product.unit ?? '', minQuantity: product.minQuantity == null ? '' : String(product.minQuantity) })
    setError(''); setSuccess('')
  }
  async function remove(id: number) {
    if (!window.confirm('Xóa mặt hàng này? Không thể xóa mặt hàng đã có tồn kho hoặc lịch sử giao dịch.')) return
    try { await api.delete(`/products/${id}`); setSuccess('Đã xóa hàng hóa.'); await load() }
    catch (reason) { setError(errorMessage(reason)) }
  }
  const rows = products.map(({ id, sku, name, category, unit, minQuantity }) => ({ id, sku, name, category, unit, minQuantity: minQuantity ?? '—' }))
  return <Page eyebrow="DANH MỤC" title="Hàng hóa" description="Quản lý thông tin, đơn vị tính, danh mục và ngưỡng cảnh báo tồn kho.">
    {(error || success) && <Notice message={error || success} kind={error ? 'error' : 'success'} />}
    <div className="content-grid">
      <Panel title={editing ? 'Sửa thông tin hàng hóa' : 'Thêm hàng hóa'} subtitle="Thông tin mặt hàng và ngưỡng cảnh báo tồn thấp">
        <form className="form-stack" onSubmit={(event) => void submit(event)}>
          <Field label="Mã SKU"><input required value={form.sku} onChange={(event) => setForm({ ...form, sku: event.target.value })} placeholder="Ví dụ: WH-10024" /></Field>
          <Field label="Tên hàng hóa"><input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Tên mặt hàng" /></Field>
          <div className="form-row">
            <Field label="Danh mục"><input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} placeholder="Danh mục" /></Field>
            <Field label="Đơn vị tính"><input value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })} placeholder="cái, kg..." /></Field>
          </div>
          <Field label="Mức tồn tối thiểu"><input type="number" min="0" value={form.minQuantity} onChange={(event) => setForm({ ...form, minQuantity: event.target.value })} placeholder="Không bắt buộc" /></Field>
          <div className="form-actions"><button disabled={loading} className="button button-primary" type="submit">{editing ? <Pencil size={16} /> : <Plus size={17} />}{loading ? 'Đang lưu...' : editing ? 'Lưu thay đổi' : 'Thêm mặt hàng'}</button>
            {editing && <button className="button button-secondary" type="button" onClick={() => { setEditing(undefined); setForm(initialForm) }}><X size={16} />Hủy</button>}</div>
        </form>
      </Panel>
      <Panel title="Danh mục hàng hóa" subtitle={`${products.length} mặt hàng`}>
        <DataTable rows={rows} empty="Chưa có mặt hàng. Hãy thêm mặt hàng đầu tiên." actions={(row) => {
          const product = products.find((item) => item.id === Number(row.id))
          return product ? <div className="inline-actions"><button aria-label={`Edit ${product.sku}`} className="icon-button" onClick={() => edit(product)}><Pencil size={15} /></button><button aria-label={`Delete ${product.sku}`} className="icon-button danger-icon" onClick={() => void remove(product.id)}><Trash2 size={15} /></button></div> : null
        }} />
      </Panel>
    </div>
  </Page>
}
