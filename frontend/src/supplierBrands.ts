// Gợi ý "nhà cung cấp nào bán sản phẩm nào" cho form nhập kho.
// CSDL không lưu quan hệ này, nên suy ra từ tên hãng:
//   - nhà cung cấp là công ty của một hãng  -> chỉ sản phẩm của hãng đó
//   - nhà phân phối (FPT, Digiworld, ...)  -> mọi sản phẩm
//   - nhà cung cấp chưa có trong danh sách -> mọi sản phẩm (không chặn)
// Đây chỉ là gợi ý trên giao diện; backend không kiểm tra.
// Thêm nhà cung cấp / hãng mới: bổ sung một dòng vào BRANDS hoặc DISTRIBUTORS.

type ProductLike = { sku?: string; name?: string }

type BrandRule = {
  brand: string
  supplier: RegExp // khớp tên nhà cung cấp
  skuCodes: string[] // mã hãng trong SKU, vd LAP-DELL-XPS15 -> DELL
  name?: RegExp // khớp tên sản phẩm (khi SKU không có mã hãng)
}

const BRANDS: BrandRule[] = [
  { brand: 'Samsung', supplier: /samsung/i, skuCodes: ['SS', 'SAM', 'SAMSUNG'], name: /samsung|galaxy/i },
  { brand: 'Dell', supplier: /\bdell\b/i, skuCodes: ['DELL'], name: /\bdell\b/i },
  { brand: 'LG', supplier: /\blg\b/i, skuCodes: ['LG'], name: /\blg\b/i },
  { brand: 'Apple', supplier: /apple/i, skuCodes: ['AP', 'APPLE', 'MAC'], name: /apple|iphone|ipad|macbook|airpods/i },
  { brand: 'ASUS', supplier: /asus/i, skuCodes: ['ASUS'], name: /asus/i },
  { brand: 'Acer', supplier: /acer/i, skuCodes: ['ACER'], name: /\bacer\b/i },
  { brand: 'Lenovo', supplier: /lenovo/i, skuCodes: ['LEN', 'LENOVO'], name: /lenovo|thinkpad/i },
  // "1.5 HP" trong tên máy lạnh là mã lực, không phải hãng HP
  { brand: 'HP', supplier: /\bhp\b/i, skuCodes: ['HP'], name: /(?<![\d.]\s?)\bhp\b/i },
  { brand: 'Sony', supplier: /sony/i, skuCodes: ['SONY'], name: /sony/i },
  { brand: 'Xiaomi', supplier: /xiaomi/i, skuCodes: ['XIA', 'XIAOMI'], name: /xiaomi/i },
  { brand: 'Panasonic', supplier: /panasonic/i, skuCodes: ['PANA', 'PANASONIC'], name: /panasonic/i },
  { brand: 'Canon', supplier: /canon/i, skuCodes: ['CANON'], name: /canon/i },
  { brand: 'Logitech', supplier: /logitech/i, skuCodes: ['LOGI', 'LOGITECH'], name: /logitech/i },
  { brand: 'Kingston', supplier: /kingston/i, skuCodes: ['KING', 'KINGSTON'], name: /kingston/i },
  { brand: 'Western Digital', supplier: /western digital/i, skuCodes: ['WD'], name: /western digital|\bwd\b/i },
  { brand: 'Seagate', supplier: /seagate/i, skuCodes: ['SEA', 'SEAGATE'], name: /seagate/i },
  { brand: 'Intel', supplier: /intel/i, skuCodes: ['INTEL'], name: /\bintel\b/i },
  { brand: 'AMD', supplier: /\bamd\b/i, skuCodes: ['AMD'], name: /\bamd\b|ryzen|radeon/i },
  { brand: 'MSI', supplier: /\bmsi\b/i, skuCodes: ['MSI'], name: /\bmsi\b/i },
  { brand: 'Gigabyte', supplier: /gigabyte/i, skuCodes: ['GIGA', 'GIGABYTE'], name: /gigabyte/i },
  { brand: 'Brother', supplier: /brother/i, skuCodes: ['BROTHER'], name: /brother/i },
  { brand: 'Epson', supplier: /epson/i, skuCodes: ['EPSON'], name: /epson/i },
  { brand: 'Dahua', supplier: /dahua/i, skuCodes: ['DAHUA'], name: /dahua/i },
  { brand: 'Hikvision', supplier: /hikvision/i, skuCodes: ['HIK', 'HIKVISION'], name: /hikvision/i },
]

// Nhà phân phối nhiều hãng: được nhập mọi sản phẩm
const DISTRIBUTORS = /fpt|digiworld|synnex|viettel|\bcmc\b|bkav/i

export type SupplierScope = { kind: 'brand'; brand: string } | { kind: 'distributor' } | { kind: 'unknown' }

export function supplierScope(supplierName?: string): SupplierScope {
  if (!supplierName) return { kind: 'unknown' }
  if (DISTRIBUTORS.test(supplierName)) return { kind: 'distributor' }
  const rule = BRANDS.find((item) => item.supplier.test(supplierName))
  return rule ? { kind: 'brand', brand: rule.brand } : { kind: 'unknown' }
}

function productMatches(rule: BrandRule, product: ProductLike): boolean {
  const skuParts = (product.sku ?? '').toUpperCase().split(/[-_\s]+/)
  if (rule.skuCodes.some((code) => skuParts.includes(code))) return true
  return rule.name ? rule.name.test(product.name ?? '') : false
}

/** Các sản phẩm nhà cung cấp này được phép nhập. */
export function productsForSupplier<T extends ProductLike>(supplierName: string | undefined, products: T[]): T[] {
  const scope = supplierScope(supplierName)
  if (scope.kind !== 'brand') return products
  const rule = BRANDS.find((item) => item.brand === scope.brand)!
  return products.filter((product) => productMatches(rule, product))
}

// Loại hàng -> khu vực kho phù hợp (khớp theo chữ cái đầu của zone: "Khu A - Hàng Điện Tử")
const CATEGORY_ZONE: Record<string, string> = {
  'laptop': 'Khu A', 'điện thoại': 'Khu A', 'thiết bị số': 'Khu A',
  'phụ kiện': 'Khu B', 'âm thanh': 'Khu B',
  'gia dụng': 'Khu C',
}

export function zonePrefixForCategory(category?: string): string | undefined {
  return category ? CATEGORY_ZONE[category.trim().toLowerCase()] : undefined
}
