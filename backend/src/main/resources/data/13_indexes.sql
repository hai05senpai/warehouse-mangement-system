-- Chỉ mục phục vụ UC-06 (tra cứu tồn kho). Hiệu quả đã đo trong demo/indexing/.
-- Chạy sau khi backend đã tạo bảng; chạy lại nhiều lần không lỗi.

-- Tìm SKU "chứa chuỗi" (lower(sku) LIKE '%...%'): B+-tree không dùng được, cần GIN trigram
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_products_sku_trgm ON products USING gin (lower(sku) gin_trgm_ops);

-- Lọc theo khu: truy vấn so sánh lower(zone), nên chỉ mục phải đặt trên đúng biểu thức đó
CREATE INDEX IF NOT EXISTS idx_locations_zone_lower ON locations (lower(zone));

-- Khóa ngoại inventory.location_id: PostgreSQL không tự tạo chỉ mục cho khóa ngoại.
-- (inventory.product_id đã được phủ bởi UNIQUE (product_id, location_id) vì là cột đầu.)
CREATE INDEX IF NOT EXISTS idx_inventory_location ON inventory (location_id);
