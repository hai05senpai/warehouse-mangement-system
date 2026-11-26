import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { ArrowDownToLine, Check, Plus, X } from 'lucide-react'
import { api, errorMessage, type Row } from '../api'
import { DataTable } from '../components/DataTable'
import { Field, Notice, Page, Panel } from '../components/Page'
import { productsForSupplier, supplierScope, zonePrefixForCategory } from '../supplierBrands'

type Ref = { id: number; sku?: string; name?: string; code?: string; zone?: string; category?: string; rack?: string; shelf?: string }
type ReceiptItemRow = {
  id: number
  product?: Ref
  location?: Ref
  quantity: number
}

export function Receipts() {
  const [orders, setOrders] = useState<Row[]>([])
  const [suppliers, setSuppliers] = useState<Ref[]>([])
  const [products, setProducts] = useState<Ref[]>([])
  const [locations, setLocations] = useState<Ref[]>([])
  const [form, setForm] = useState({ code: '', supplierId: '', productId: '', locationId: '', quantity: '1' })
  const [selectedOrder, setSelectedOrder] = useState<Row | null>(null)
  const [detailItems, setDetailItems] = useState<Row[]>([])
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const load = useCallback(() => api.get<Row[]>('/receipt-orders').then((response) => setOrders(response.data))
    .catch((reason: unknown) => setError(errorMessage(reason))), [])
  useEffect(() => {
    void load()
    Promise.all([api.get<Ref[]>('/suppliers'), api.get<Ref[]>('/products'), api.get<Ref[]>('/locations')])
      .then(([s, p, l]) => { setSuppliers(s.data); setProducts(p.data); setLocations(l.data) })
      .catch((reason: unknown) => setError(errorMessage(reason)))
  }, [load])

  // Hàng hóa: chỉ sản phẩm mà nhà cung cấp đang chọn bán (suy ra từ tên hãng, xem supplierBrands.ts)
  const selectedSupplier = suppliers.find((supplier) => String(supplier.id) === form.supplierId)
  const scope = supplierScope(selectedSupplier?.name)
  const supplierProducts = form.supplierId ? productsForSupplier(selectedSupplier?.name, products) : []
  const productLabel = !form.supplierId ? 'Hàng hóa'
    : scope.kind === 'brand' ? `Hàng hóa (${supplierProducts.length} sản phẩm ${scope.brand})`
    : scope.kind === 'distributor' ? 'Hàng hóa (nhà phân phối — mọi hãng)'
    : 'Hàng hóa'
  function chooseSupplier(supplierId: string) {
    const supplier = suppliers.find((item) => String(item.id) === supplierId)
    const allowed = productsForSupplier(supplier?.name, products)
    const keepProduct = allowed.some((product) => String(product.id) === form.productId)
    setForm({ ...form, supplierId, productId: keepProduct ? form.productId : '' })
  }

  // Vị trí nhập: nhóm theo khu, khu phù hợp với loại hàng được xếp lên đầu
  const selectedProduct = products.find((product) => String(product.id) === form.productId)
  const zonePrefix = zonePrefixForCategory(selectedProduct?.category)
  const zoneMap = new Map<string, Ref[]>()
  for (const location of locations) {
    const zone = location.zone ?? 'Chưa phân khu'
    zoneMap.set(zone, [...(zoneMap.get(zone) ?? []), location])
  }
  const zoneGroups = [...zoneMap.entries()].sort(([a], [b]) => {
    const aMatch = zonePrefix ? a.startsWith(zonePrefix) : false
    const bMatch = zonePrefix ? b.startsWith(zonePrefix) : false
    return aMatch === bMatch ? a.localeCompare(b) : aMatch ? -1 : 1
  })
  const suggestedZone = zonePrefix ? zoneGroups.find(([zone]) => zone.startsWith(zonePrefix))?.[0] : undefined
  const selectedLocation = locations.find((location) => String(location.id) === form.locationId)
  const locationLabel = selectedLocation ? `Vị trí nhập — ${selectedLocation.zone ?? ''}` : 'Vị trí nhập'

  async function viewDetails(order: Row) {
    setError('')
    try {
      const res = await api.get<ReceiptItemRow[]>(`/receipt-orders/${Number(order.id)}/items`)
      setSelectedOrder(order)
      setDetailItems(res.data.map((item) => ({
        id: item.id,
        sku: item.product?.sku ?? '—',
        productName: item.product?.name ?? '—',
        location: item.location?.code ?? '—',
        zone: item.location?.zone ?? '—',
        quantity: item.quantity,
      })))
    } catch (reason) { setError(errorMessage(reason)) }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setMessage('')
    try {
      const res = await api.post<Row>('/receipt-orders', { code: form.code, supplierId: Number(form.supplierId), items: [{ productId: Number(form.productId), locationId: Number(form.locationId), quantity: Number(form.quantity) }] })
      setMessage('Đã tạo phiếu nhập ở trạng thái chờ xử lý. Hoàn tất phiếu để cộng tồn kho.'); setForm({ code: '', supplierId: '', productId: '', locationId: '', quantity: '1' })
      await load()
      await viewDetails(res.data)
    } catch (reason) { setError(errorMessage(reason)) }
  }
  async function changeStatus(id: number, action: 'complete' | 'cancel') {
    setError(''); setMessage('')
    try {
      const res = await api.put<Row>(`/receipt-orders/${id}/${action}`)
      setMessage(`Đã ${action === 'complete' ? 'hoàn tất' : 'hủy'} phiếu nhập.`)
      await load()
      if (selectedOrder && Number(selectedOrder.id) === id) await viewDetails(res.data)
    } catch (reason) { setError(errorMessage(reason)) }
  }

  const rows = orders.map((order) => ({
    id: order.id,
    code: order.code,
    supplier: order.supplier,
    status: order.status,
    receiptDate: order.receiptDate,
    createdBy: order.createdBy,
  }))

  return <Page eyebrow="QUẢN LÝ NHẬP KHO" title="Đơn nhập kho" description="Ghi nhận hàng từ nhà cung cấp và nhập hàng vào vị trí lưu trữ.">
    {(error || message) && <Notice message={error || message} kind={error ? 'error' : 'success'} />}
    <Panel title="Tạo phiếu nhập kho" subtitle="Phiếu mới ở trạng thái chờ cho đến khi được xác nhận hoàn tất">
      <form className="filter-bar" onSubmit={(event) => void submit(event)}>
        <Field label="Mã phiếu nhập"><input required value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} placeholder="PN-0001" /></Field>
        <Field label="Nhà cung cấp"><select required value={form.supplierId} onChange={(event) => chooseSupplier(event.target.value)}><option value="">Chọn nhà cung cấp</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></Field>
        <Field label={productLabel}>
          <select required disabled={!form.supplierId} value={form.productId} onChange={(event) => setForm({ ...form, productId: event.target.value })}>
            <option value="">{!form.supplierId ? 'Chọn nhà cung cấp trước' : supplierProducts.length ? 'Chọn hàng hóa' : 'Nhà cung cấp này chưa có sản phẩm'}</option>
            {supplierProducts.map((product) => <option key={product.id} value={product.id}>{product.sku} — {product.name}</option>)}
          </select>
        </Field>
        <Field label={locationLabel}>
          <select required value={form.locationId} onChange={(event) => setForm({ ...form, locationId: event.target.value })}>
            <option value="">Chọn vị trí</option>
            {zoneGroups.map(([zone, items]) => (
              <optgroup key={zone} label={zone === suggestedZone ? `${zone} (phù hợp với ${selectedProduct?.category ?? ''})` : zone}>
                {items.map((location) => <option key={location.id} value={location.id}>{location.code} · {zone} · {location.rack ?? ''} {location.shelf ?? ''}</option>)}
              </optgroup>
            ))}
          </select>
        </Field>
        <Field label="Số lượng"><input required type="number" min="1" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} /></Field>
        <button className="button button-primary" type="submit"><Plus size={16} />Tạo phiếu</button>
      </form>
    </Panel>

    {selectedOrder && (
      <Panel
        title={`Chi tiết phiếu nhập: ${String(selectedOrder.code)}`}
        subtitle={`${detailItems.length} mặt hàng thuộc phiếu nhập này`}
        action={
          <div className="inline-actions">
            {selectedOrder.status === 'PENDING' && (
              <>
                <button className="button button-primary" type="button" onClick={() => void changeStatus(Number(selectedOrder.id), 'complete')}>
                  <Check size={15} /> Hoàn tất nhập kho
                </button>
                <button className="button button-secondary" type="button" onClick={() => void changeStatus(Number(selectedOrder.id), 'cancel')}>
                  <X size={15} /> Hủy phiếu
                </button>
              </>
            )}
            <button className="icon-button" type="button" aria-label="Đóng chi tiết" onClick={() => setSelectedOrder(null)}>
              <X size={16} />
            </button>
          </div>
        }
      >
        <DataTable searchable={false} rows={detailItems} empty="Phiếu nhập chưa có dòng mặt hàng nào." />
      </Panel>
    )}

    <Panel title="Danh sách phiếu nhập" subtitle={`${orders.length} phiếu nhập — nhấp vào một dòng để xem chi tiết`}>
      <DataTable
        rows={rows}
        selectedRowId={selectedOrder?.id}
        onRowClick={(row) => void viewDetails(row)}
        actions={(order) => order.status === 'PENDING' ? <div className="inline-actions">
          <button className="icon-button success-icon" title="Hoàn tất phiếu nhập" aria-label="Hoàn tất phiếu nhập" onClick={(event) => { event.stopPropagation(); void changeStatus(Number(order.id), 'complete') }}><Check size={16} /></button>
          <button className="icon-button danger-icon" title="Hủy phiếu nhập" aria-label="Hủy phiếu nhập" onClick={(event) => { event.stopPropagation(); void changeStatus(Number(order.id), 'cancel') }}><X size={16} /></button>
        </div> : null}
      />
      {!orders.length && <div className="panel-empty"><ArrowDownToLine size={17} />Tạo phiếu nhập để bắt đầu theo dõi hàng hóa nhập kho.</div>}
    </Panel>
  </Page>
}
