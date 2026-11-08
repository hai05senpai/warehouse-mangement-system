import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { ArrowLeftRight, Search } from 'lucide-react'
import { api, errorMessage, type Row } from '../api'
import { DataTable } from '../components/DataTable'
import { Field, Notice, Page, Panel } from '../components/Page'

type Ref = { id: number; code?: string; sku?: string; name?: string; zone?: string }
type InventoryRow = Row & { product: Ref; location: Ref; quantity: number; reservedQuantity: number }
type Location = Ref & { code: string; zone: string }

export function Inventory() {
  const [rows, setRows] = useState<InventoryRow[]>([])
  const [products, setProducts] = useState<Ref[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [sku, setSku] = useState('')
  const [zone, setZone] = useState('')
  const [available, setAvailable] = useState(false)
  const [transfer, setTransfer] = useState({ code: '', productId: '', sourceLocationId: '', destinationLocationId: '', quantity: '1' })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const load = useCallback(() => api.get<InventoryRow[]>('/inventory', { params: { sku: sku || undefined, zone: zone || undefined, availableOnly: available } })
    .then((response) => setRows(response.data)).catch((reason: unknown) => setError(errorMessage(reason))), [sku, zone, available])
  useEffect(() => {
    void load()
    Promise.all([api.get<Ref[]>('/products'), api.get<Location[]>('/locations')])
      .then(([productResponse, locationResponse]) => { setProducts(productResponse.data); setLocations(locationResponse.data) })
      .catch((reason: unknown) => setError(errorMessage(reason)))
  }, [load])
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setSuccess('')
    try {
      await api.post('/transfers', {
        code: transfer.code,
        createdBy: 'Admin user',
        items: [{
          productId: Number(transfer.productId),
          sourceLocationId: Number(transfer.sourceLocationId),
          destinationLocationId: Number(transfer.destinationLocationId),
          quantity: Number(transfer.quantity),
        }],
      })
      setSuccess('Điều chuyển hàng hóa thành công.'); setTransfer({ code: '', productId: '', sourceLocationId: '', destinationLocationId: '', quantity: '1' }); await load()
    } catch (reason) { setError(errorMessage(reason)) }
  }
  const tableRows = rows.map((item) => ({
    id: item.id, sku: item.product?.sku, product: item.product?.name, location: item.location?.code,
    zone: item.location?.zone, onHand: item.quantity, reserved: item.reservedQuantity,
    available: item.quantity - item.reservedQuantity,
  }))
  return <Page eyebrow="QUẢN LÝ TỒN KHO" title="Tồn kho" description="Tra cứu hàng hóa theo SKU, khu vực kho và số lượng khả dụng.">
    {(error || success) && <Notice message={error || success} kind={error ? 'error' : 'success'} />}
    <Panel title="Tra cứu tồn kho" subtitle="Lọc hàng hóa tại tất cả vị trí lưu trữ">
      <form className="filter-bar" onSubmit={(event) => { event.preventDefault(); void load() }}>
        <Field label="Mã SKU"><input value={sku} onChange={(event) => setSku(event.target.value)} placeholder="Tìm SKU..." /></Field>
        <Field label="Khu vực"><input value={zone} onChange={(event) => setZone(event.target.value)} placeholder="Tất cả khu vực" /></Field>
        <label className="check-field"><input type="checkbox" checked={available} onChange={(event) => setAvailable(event.target.checked)} /> Chỉ hàng khả dụng</label>
        <button className="button button-primary"><Search size={16} />Tìm kiếm</button>
      </form>
      <DataTable rows={tableRows} empty="Không có tồn kho phù hợp với điều kiện lọc." />
    </Panel>
    <Panel title="Điều chuyển hàng hóa" subtitle="Chuyển tồn giữa các vị trí mà không làm thay đổi tổng lượng hàng">
      <form className="filter-bar transfer-form" onSubmit={(event) => void submit(event)}>
        <Field label="Mã phiếu điều chuyển"><input required value={transfer.code} onChange={(event) => setTransfer({ ...transfer, code: event.target.value })} placeholder="DC-0001" /></Field>
        <Field label="Hàng hóa"><select required value={transfer.productId} onChange={(event) => setTransfer({ ...transfer, productId: event.target.value })}><option value="">Chọn hàng hóa</option>{products.map((product) => <option key={product.id} value={product.id}>{product.sku} — {product.name}</option>)}</select></Field>
        <Field label="Vị trí chuyển đi"><select required value={transfer.sourceLocationId} onChange={(event) => setTransfer({ ...transfer, sourceLocationId: event.target.value })}><option value="">Chọn vị trí nguồn</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.code} · Khu {location.zone}</option>)}</select></Field>
        <Field label="Vị trí chuyển đến"><select required value={transfer.destinationLocationId} onChange={(event) => setTransfer({ ...transfer, destinationLocationId: event.target.value })}><option value="">Chọn vị trí đích</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.code} · Khu {location.zone}</option>)}</select></Field>
        <Field label="Số lượng"><input required min="1" type="number" value={transfer.quantity} onChange={(event) => setTransfer({ ...transfer, quantity: event.target.value })} /></Field>
        <button className="button button-primary" type="submit"><ArrowLeftRight size={16} />Điều chuyển</button>
      </form>
    </Panel>
  </Page>
}
