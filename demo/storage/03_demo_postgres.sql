-- =============================================================================
-- DEMO LƯU TRỮ (mục 3.1) TRÊN POSTGRESQL: mở trong pgAdmin (Query Tool)
-- Bôi đen từng STEP rồi bấm F5. Yêu cầu: đã nạp dữ liệu (02_measure.py load
-- hoặc 01_load_postgres.sql). pgAdmin chỉ hiện kết quả câu CUỐI của vùng bôi đen.
-- =============================================================================

-- STEP 1: Giới thiệu dữ liệu ---------------------------------------------------
SET search_path = storage_demo;
SELECT (SELECT count(*) FROM inventory) AS so_dong_ton,
       pg_relation_size('inventory') / 8192 AS so_trang_heap;


-- STEP 2: Một bản ghi tốn bao nhiêu chỗ ---------------------------------------
-- Nhìn: 1 dòng dữ liệu chỉ 64 byte nhưng heap vẫn cấp 1 trang 8.192 byte,
-- và 2 chỉ mục (khóa chính + UNIQUE) tốn thêm 32.768 byte.
SELECT pg_column_size(t.*) AS byte_1_dong FROM inventory_one t;
SELECT pg_relation_size('inventory_one') AS heap_byte,
       pg_indexes_size('inventory_one')  AS chi_muc_byte;


-- STEP 3: 10.000 bản ghi ------------------------------------------------------
-- Nhìn: heap 84 trang (672 KB), khoảng 68,8 byte mỗi dòng; chỉ mục 568 KB.
SELECT pg_relation_size('inventory') / 8192          AS trang_heap,
       pg_size_pretty(pg_relation_size('inventory')) AS heap,
       pg_size_pretty(pg_indexes_size('inventory'))  AS chi_muc,
       round(pg_relation_size('inventory') / 10000.0, 1) AS byte_moi_dong;


-- STEP 4: MVCC trên một dòng: 500 lần UPDATE dòng id = 1 ----------------------
-- 4a. Vị trí vật lý ban đầu: ctid = (0,1) tức trang 0, ô 1
SELECT ctid, quantity FROM inventory WHERE id = 1;

-- 4b. Cập nhật 500 lần, mỗi lần là một giao dịch riêng như ứng dụng (mỗi lần tạo một phiên bản mới của dòng)
DO $$ BEGIN
  FOR i IN 1..500 LOOP
    UPDATE storage_demo.inventory SET quantity = 100 + i, updated_at = now() WHERE id = 1;
    COMMIT;
  END LOOP;
END $$;

-- 4c. Nhìn: ctid đổi sang trang khác, nhưng số trang không tăng và chỉ còn ít bản ghi chết
--     nhờ cập nhật HOT (phiên bản mới ghi trong cùng trang, phiên bản cũ được dọn dần).
SELECT ctid, quantity FROM inventory WHERE id = 1;
SELECT pg_stat_force_next_flush();
SELECT pg_relation_size('inventory') / 8192 AS trang_heap,
       (SELECT n_dead_tup FROM pg_stat_user_tables WHERE relid = 'inventory'::regclass) AS ban_ghi_chet;


-- STEP 5: 50.000 lượt cập nhật toàn bảng => bảng phình ----------------------------
-- Chạy riêng từng câu. Nhìn: heap lên khoảng 497 trang, khoảng 50.000 bản ghi chết,
-- Seq Scan phải đọc toàn bộ ("Buffers: shared hit=497").
ALTER TABLE inventory SET (autovacuum_enabled = false);
UPDATE inventory SET quantity = quantity + 1, updated_at = now();
UPDATE inventory SET quantity = quantity + 1, updated_at = now();
UPDATE inventory SET quantity = quantity + 1, updated_at = now();
UPDATE inventory SET quantity = quantity + 1, updated_at = now();
UPDATE inventory SET quantity = quantity + 1, updated_at = now();

EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM storage_demo.inventory;


-- STEP 6: VACUUM và VACUUM FULL ---------------------------------------------------
-- 6a. VACUUM: bản ghi chết về 0, chỗ trống được tái sử dụng nhưng tệp không nhỏ lại
VACUUM inventory;
SELECT pg_relation_size('inventory') / 8192 AS trang_heap;

-- 6b. VACUUM FULL: viết lại bảng, trả dung lượng => quay về 84 trang
VACUUM FULL inventory;
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM storage_demo.inventory;


-- STEP 7: Thời gian đọc / ghi một dòng, đo ngay trong server ---------------------
-- Mỗi khối in thời gian cho 1.000 lệnh (xem tab Messages). 1.000 lệnh: x ms = x µs mỗi lệnh.
-- 7a. Đọc 1.000 lần
DO $$ DECLARE t0 timestamptz; r record; BEGIN
  t0 := clock_timestamp();
  FOR i IN 1..1000 LOOP
    SELECT * INTO r FROM storage_demo.inventory WHERE product_id = 1 AND location_id = 1;
  END LOOP;
  RAISE NOTICE 'doc 1000 lan: % ms', extract(epoch FROM clock_timestamp() - t0) * 1000;
END $$;

-- 7b. Ghi 1.000 lần, mỗi lệnh commit riêng (chờ ghi WAL xuống đĩa mỗi lần)
DO $$ DECLARE t0 timestamptz; BEGIN
  t0 := clock_timestamp();
  FOR i IN 1..1000 LOOP
    UPDATE storage_demo.inventory SET quantity = 100 + i % 50 WHERE product_id = 1 AND location_id = 1;
    COMMIT;
  END LOOP;
  RAISE NOTICE 'ghi 1000 lan, commit moi lan: % ms', extract(epoch FROM clock_timestamp() - t0) * 1000;
END $$;

-- 7c. Ghi 1.000 lần trong một giao dịch (chỉ chờ đĩa một lần)
DO $$ DECLARE t0 timestamptz; BEGIN
  t0 := clock_timestamp();
  FOR i IN 1..1000 LOOP
    UPDATE storage_demo.inventory SET quantity = 100 + i % 50 WHERE product_id = 1 AND location_id = 1;
  END LOOP;
  RAISE NOTICE 'ghi 1000 lan trong 1 giao dich: % ms', extract(epoch FROM clock_timestamp() - t0) * 1000;
END $$;
