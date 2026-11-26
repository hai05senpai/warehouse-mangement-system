import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { ArrowLeftRight, History, Search, X } from 'lucide-react'
import { api, errorMessage, type Row } from '../api'
import { DataTable } from '../components/DataTable'
import { Field, Notice, Page, Panel } from '../components/Page'

type Ref = { id: number; code?: string; sku?: string; name?: string; zone?: string }
type InventoryRow = Row & { product: Ref; location: Ref; quantity: number; reservedQuantity: number }
type Location = Ref & { code: string; zone: string }
type TransferItemRow = { id: number; product?: Ref; sourceLocation?: Ref; destinationLocation?: Ref; quantity: number }

export function Inventory() {
  const [rows, setRows] = useState<InventoryRow[]>([])
  const [products, setProducts] = useState<Ref[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [sku, setSku] = useState('')
  const [zone, setZone] = useState('')
  const [available, setAvailable] = useState(false)
  const [transfer, setTransfer] = useState({ code: '', productId: '', sourceLocationId: '', destinationLocationId: '', quantity: '1' })
  // Tồn của mặt hàng đang chọn tại từng vị trí, dùng để giới hạn vị trí chuyển đi / chuyển đến
  const [productStock, setProductStock] = useState<InventoryRow[]>([])
  // Lịch sử điều chuyển
  const [transfers, setTransfers] = useState<Row[]>([])
  const [selectedTransfer, setSelectedTransfer] = useState<Row | null>(null)
  const [transferDetail, setTransferDetail] = useState<Row[]>([])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const loadTransfers = useCallback(() => api.get<Row[]>('/transfers').then((response) => setTransfers(response.data))
    .catch((reason: unknown) => setError(errorMessage(reason))), [])
  useEffect(() => { void loadTransfers() }, [loadTransfers])

  async function viewTransfer(transferRow: Row) {
    setError('')
    try {
      const response = await api.get<TransferItemRow[]>(`/transfers/${Number(transferRow.id)}/items`)
      setSelectedTransfer(transferRow)
      setTransferDetail(response.data.map((item) => ({
        id: item.id,
        sku: item.product?.sku ?? '—',
        productName: item.product?.name ?? '—',
        sourceLocation: item.sourceLocation?.code ?? '—',
        destinationLocation: item.destinationLocation?.code ?? '—',
        quantity: item.quantity,
      })))
    } catch (reason) { setError(errorMessage(reason)) }
  }
  const load = useCallback(() => api.get<InventoryRow[]>('/inventory', { params: { sku: sku || undefined, zone: zone || undefined, availableOnly: available } })
    .then((response) => setRows(response.data)).catch((reason: unknown) => setError(errorMessage(reason))), [sku, zone, available])
  useEffect(() => {
    void load()
    Promise.all([api.get<Ref[]>('/products'), api.get<Location[]>('/locations')])
      .then(([productResponse, locationResponse]) => { setProducts(productResponse.data); setLocations(locationResponse.data) })
      .catch((reason: unknown) => setError(errorMessage(reason)))
  }, [load])

  const loadProductStock = useCallback(async (productId: string) => {
    const product = products.find((item) => String(item.id) === productId)
    if (!product?.sku) { setProductStock([]); return }
    try {
      // /inventory lọc SKU theo kiểu "chứa chuỗi", nên lọc lại đúng id mặt hàng
      const response = await api.get<InventoryRow[]>('/inventory', { params: { sku: product.sku } })
      setProductStock(response.data.filter((item) => String(item.product?.id) === productId))
    } catch (reason) { setError(errorMessage(reason)) }
  }, [products])

  function chooseProduct(productId: string) {
    setTransfer({ ...transfer, productId, sourceLocationId: '', destinationLocationId: '', quantity: '1' })
    void loadProductStock(productId)
  }

  const availableAt = (item: InventoryRow) => item.quantity - item.reservedQuantity
  // Vị trí chuyển đi: chỉ những vị trí thực sự có mặt hàng này và còn hàng khả dụng
  const sourceOptions = productStock.filter((item) => availableAt(item) > 0)
  const selectedSource = sourceOptions.find((item) => String(item.location?.id) === transfer.sourceLocationId)
  const maxQuantity = selectedSource ? availableAt(selectedSource) : undefined
  const stockAtLocation = (locationId: number) => productStock.find((item) => item.location?.id === locationId)?.quantity ?? 0

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setSuccess('')
    try {
      const created = await api.post<Row>('/transfers', {
        code: transfer.code,
        createdBy: 'Admin user',
        items: [{
          productId: Number(transfer.productId),
          sourceLocationId: Number(transfer.sourceLocationId),
          destinationLocationId: Number(transfer.destinationLocationId),
          quantity: Number(transfer.quantity),
        }],
      })
      setSuccess('Điều chuyển hàng hóa thành công.'); setTransfer({ code: '', productId: '', sourceLocationId: '', destinationLocationId: '', quantity: '1' }); setProductStock([]); await load()
      await loadTransfers(); await viewTransfer(created.data)
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
        <Field label="Khu vực"><select value={zone} onChange={(event) => setZone(event.target.value)}><option value="">Tất cả khu vực</option>{[...new Set(locations.map((location) => location.zone))].sort().map((name) => <option key={name} value={name}>{name}</option>)}</select></Field>
        <label className="check-field"><input type="checkbox" checked={available} onChange={(event) => setAvailable(event.target.checked)} /> Chỉ hàng khả dụng</label>
        <button className="button button-primary"><Search size={16} />Tìm kiếm</button>
      </form>
      <DataTable rows={tableRows} empty="Không có tồn kho phù hợp với điều kiện lọc." />
    </Panel>
    <Panel title="Điều chuyển hàng hóa" subtitle="Chuyển tồn giữa các vị trí mà không làm thay đổi tổng lượng hàng">
      <form className="filter-bar transfer-form" onSubmit={(event) => void submit(event)}>
        <Field label="Mã phiếu điều chuyển"><input required value={transfer.code} onChange={(event) => setTransfer({ ...transfer, code: event.target.value })} placeholder="DC-0001" /></Field>
        <Field label="Hàng hóa"><select required value={transfer.productId} onChange={(event) => chooseProduct(event.target.value)}><option value="">Chọn hàng hóa</option>{products.map((product) => <option key={product.id} value={product.id}>{product.sku} — {product.name}</option>)}</select></Field>
        <Field label="Vị trí chuyển đi">
          <select required disabled={!transfer.productId || !sourceOptions.length} value={transfer.sourceLocationId}
            onChange={(event) => setTransfer({ ...transfer, sourceLocationId: event.target.value, destinationLocationId: transfer.destinationLocationId === event.target.value ? '' : transfer.destinationLocationId, quantity: '1' })}>
            <option value="">{!transfer.productId ? 'Chọn hàng hóa trước' : sourceOptions.length ? 'Chọn vị trí nguồn' : 'Không còn hàng khả dụng'}</option>
            {sourceOptions.map((item) => <option key={item.location.id} value={item.location.id}>{item.location.code} · Khu {item.location.zone} · khả dụng {availableAt(item)}</option>)}
          </select>
        </Field>
        <Field label="Vị trí chuyển đến">
          <select required disabled={!transfer.sourceLocationId} value={transfer.destinationLocationId} onChange={(event) => setTransfer({ ...transfer, destinationLocationId: event.target.value })}>
            <option value="">{transfer.sourceLocationId ? 'Chọn vị trí đích' : 'Chọn vị trí nguồn trước'}</option>
            {locations.filter((location) => String(location.id) !== transfer.sourceLocationId).map((location) => <option key={location.id} value={location.id}>{location.code} · Khu {location.zone} · đang có {stockAtLocation(location.id)}</option>)}
          </select>
        </Field>
        <Field label={maxQuantity !== undefined ? `Số lượng (tối đa ${maxQuantity})` : 'Số lượng'}><input required min="1" max={maxQuantity} type="number" value={transfer.quantity} onChange={(event) => setTransfer({ ...transfer, quantity: event.target.value })} /></Field>
        <button className="button button-primary" type="submit"><ArrowLeftRight size={16} />Điều chuyển</button>
      </form>
    </Panel>
    {selectedTransfer && (
      <Panel
        title={`Chi tiết phiếu điều chuyển: ${String(selectedTransfer.code)}`}
        subtitle={`${transferDetail.length} dòng hàng hóa`}
        action={<button className="icon-button" type="button" aria-label="Đóng chi tiết" onClick={() => setSelectedTransfer(null)}><X size={16} /></button>}
      >
        <DataTable searchable={false} rows={transferDetail} empty="Phiếu điều chuyển chưa có dòng hàng hóa nào." />
      </Panel>
    )}
    <Panel title="Lịch sử điều chuyển" subtitle={`${transfers.length} phiếu điều chuyển — nhấp vào một dòng để xem chi tiết`}>
      <DataTable
        rows={transfers.map((item) => ({ id: item.id, code: item.code, transferDate: item.transferDate, createdBy: item.createdBy, status: item.status }))}
        selectedRowId={selectedTransfer?.id}
        onRowClick={(row) => void viewTransfer(row)}
        empty="Chưa có phiếu điều chuyển nào."
      />
      {!transfers.length && <div className="panel-empty"><History size={17} />Thực hiện điều chuyển ở trên để bắt đầu lưu lịch sử.</div>}
    </Panel>
  </Page>
}
