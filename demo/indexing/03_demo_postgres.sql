-- =============================================================================
-- DEMO CHỈ MỤC TRÊN POSTGRESQL: mở trong pgAdmin (Query Tool, database logistic_db)
-- Bôi đen từng bước rồi bấm F5 (chạy) hoặc Shift+F7 (Explain Analyze dạng sơ đồ).
-- Yêu cầu: đã chạy 01_load_postgres.sql.
-- =============================================================================

-- STEP 1: Giới thiệu dữ liệu ---------------------------------------------------
SET search_path = idx_demo, public;

SELECT (SELECT count(*) FROM inventory) AS so_dong_ton,
       (SELECT count(*) FROM locations) AS so_vi_tri,
       (SELECT count(*) FROM products)  AS so_mat_hang;

SELECT zone, count(*) AS so_vi_tri FROM locations GROUP BY zone ORDER BY zone;


-- STEP 2: Xóa chỉ mục (về trạng thái ban đầu) ---------------------------------
DROP INDEX IF EXISTS idx_inventory_location;
DROP INDEX IF EXISTS idx_locations_zone_lower;
DROP INDEX IF EXISTS idx_products_sku_trgm;
DROP INDEX IF EXISTS idx_zone_plain;

-- Chỉ còn chỉ mục mặc định: khóa chính + UNIQUE
SELECT tablename, indexname, indexdef FROM pg_indexes WHERE schemaname = 'idx_demo' ORDER BY tablename;


-- STEP 3: TRƯỚC khi có chỉ mục: tra tồn theo khu nhỏ "Khu 15" (~500 dòng) ----
-- Nhìn: "Seq Scan on inventory ... rows=100000", "Buffers: shared hit=834" => đọc hết 834 block
EXPLAIN (ANALYZE, BUFFERS)
SELECT p.sku, l.code, i.quantity, i.reserved_quantity
FROM inventory i
JOIN products p  ON p.id = i.product_id
JOIN locations l ON l.id = i.location_id
WHERE lower(l.zone) = 'khu 15';


-- STEP 4: Tạo chỉ mục B+-tree --------------------------------------------------
CREATE INDEX idx_locations_zone_lower ON locations (lower(zone));  -- chỉ mục biểu thức, khớp WHERE lower(zone)
CREATE INDEX idx_inventory_location   ON inventory (location_id);  -- PostgreSQL không tự đánh chỉ mục khóa ngoại
ANALYZE locations; ANALYZE inventory;


-- STEP 5: SAU khi có chỉ mục: chạy lại ĐÚNG câu ở STEP 3 ----------------------
-- Nhìn: "Bitmap Index Scan on idx_inventory_location", "Index Scan using idx_locations_zone_lower"
EXPLAIN (ANALYZE, BUFFERS)
SELECT p.sku, l.code, i.quantity, i.reserved_quantity
FROM inventory i
JOIN products p  ON p.id = i.product_id
JOIN locations l ON l.id = i.location_id
WHERE lower(l.zone) = 'khu 15';


-- STEP 6: Khu lớn "Khu 05" (~9.500 dòng): planner KHÔNG dùng chỉ mục ----------
-- Nhìn: vẫn "Seq Scan on inventory". 9.500 dòng nằm rải gần hết 834 block (secondary index
-- trên file không sắp xếp) => đọc tuần tự rẻ hơn nhảy theo chỉ mục.
EXPLAIN (ANALYZE, BUFFERS)
SELECT p.sku, l.code, i.quantity, i.reserved_quantity
FROM inventory i
JOIN products p  ON p.id = i.product_id
JOIN locations l ON l.id = i.location_id
WHERE lower(l.zone) = 'khu 05';


-- STEP 7: Bẫy function-based index: chỉ mục trên "zone" trơn bị bỏ qua ------
DROP INDEX idx_locations_zone_lower;
CREATE INDEX idx_zone_plain ON locations (zone);
ANALYZE locations;

-- Nhìn: "Seq Scan on locations", không dùng idx_zone_plain vì WHERE dùng lower(zone)
EXPLAIN SELECT * FROM locations WHERE lower(zone) = 'khu 15';

-- Khôi phục chỉ mục đúng
DROP INDEX idx_zone_plain;
CREATE INDEX idx_locations_zone_lower ON locations (lower(zone));
ANALYZE locations;


-- STEP 8: SKU "chứa chuỗi" (LIKE '%...%'): cần GIN trigram, B+-tree không dùng được
-- 8a. Trước: "Seq Scan on products"
EXPLAIN ANALYZE SELECT * FROM products WHERE lower(sku) LIKE '%0123%';

-- 8b. Tạo chỉ mục GIN trigram
CREATE INDEX idx_products_sku_trgm ON products USING gin (lower(sku) gin_trgm_ops);
ANALYZE products;

-- 8c. Sau: "Bitmap Index Scan on idx_products_sku_trgm"
EXPLAIN ANALYZE SELECT * FROM products WHERE lower(sku) LIKE '%0123%';


-- STEP 9: Hash so với B+-tree (chạy cả khối; ROLLBACK hoàn tác ở cuối) -------
BEGIN;
DROP INDEX idx_locations_zone_lower;
CREATE INDEX idx_zone_hash ON locations USING hash (lower(zone));
ANALYZE locations;
EXPLAIN SELECT * FROM locations WHERE lower(zone) = 'khu 15';     -- phép bằng: dùng Hash
EXPLAIN SELECT * FROM locations WHERE lower(zone) LIKE 'khu 1%';  -- tiền tố: Hash không dùng được => Seq Scan
ROLLBACK;
-- pgAdmin chỉ hiện kết quả của câu cuối cùng trong khối: muốn xem từng EXPLAIN thì
-- chạy lần lượt từng dòng (BEGIN, DROP, CREATE, ANALYZE, EXPLAIN 1, EXPLAIN 2, ROLLBACK).


-- STEP 10: Truy vấn gộp UC-07 (tồn thấp): chỉ mục không giúp được ------------
-- Nhìn: vẫn "Seq Scan on inventory": muốn cộng tồn của MỌI mặt hàng thì phải đọc hết bảng.
EXPLAIN ANALYZE
SELECT p.sku, p.min_quantity, COALESCE(SUM(i.quantity), 0) AS total
FROM products p LEFT JOIN inventory i ON i.product_id = p.id
WHERE p.min_quantity IS NOT NULL
GROUP BY p.id, p.sku, p.min_quantity
HAVING COALESCE(SUM(i.quantity), 0) < p.min_quantity
ORDER BY total;
