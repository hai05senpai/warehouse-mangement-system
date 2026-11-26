-- =============================================================================
-- DEMO TRANSACTION TRÊN POSTGRESQL
-- Mở trong pgAdmin → Query Tool. Bôi đen từng STEP rồi bấm F5.
-- Yêu cầu: đã chạy 01_setup_data.sql
-- =============================================================================

SET search_path = txn_demo;

-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 1: TRANSACTION CƠ BẢN — COMMIT (nhập kho thành công)
-- Mục tiêu: Chứng minh PostgreSQL đảm bảo Atomicity — tất cả thay đổi chỉ có
-- hiệu lực khi COMMIT, nếu không thì không gì thay đổi.
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1a. Xem tồn kho TRƯỚC giao dịch
SELECT p.sku, i.quantity AS ton_truoc FROM inventory i JOIN products p ON p.id = i.product_id WHERE p.sku = 'LAP-001';

-- 1b. Bắt đầu giao dịch nhập kho: tạo phiếu + cộng tồn
BEGIN;
    INSERT INTO receipt_orders (code, supplier_id, status)
    VALUES ('REC-DEMO-001', 1, 'PENDING');

    INSERT INTO receipt_items (receipt_order_id, product_id, location_id, quantity)
    VALUES (currval('receipt_orders_id_seq'), 1, 1, 20);

    -- Cộng 20 Laptop vào tồn kho
    UPDATE inventory SET quantity = quantity + 20
    WHERE product_id = 1 AND location_id = 1;

    -- Cập nhật trạng thái phiếu
    UPDATE receipt_orders SET status = 'COMPLETED'
    WHERE id = currval('receipt_orders_id_seq');
COMMIT;

-- 1c. Xem tồn kho SAU giao dịch: 50 → 70
SELECT p.sku, i.quantity AS ton_sau FROM inventory i JOIN products p ON p.id = i.product_id WHERE p.sku = 'LAP-001';

-- 1d. Phiếu nhập đã được lưu
SELECT code, status, created_at FROM receipt_orders WHERE code = 'REC-DEMO-001';


-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 2: ROLLBACK — nhập kho thất bại, hoàn tác tất cả
-- Mục tiêu: Nếu có lỗi giữa chừng, ROLLBACK đưa DB về trạng thái trước BEGIN.
-- ═══════════════════════════════════════════════════════════════════════════════

-- 2a. Tồn kho hiện tại
SELECT p.sku, i.quantity AS ton_truoc FROM inventory i JOIN products p ON p.id = i.product_id WHERE p.sku = 'PHN-001';

-- 2b. Bắt đầu giao dịch, nhưng phát hiện lỗi → ROLLBACK
BEGIN;
    INSERT INTO receipt_orders (code, supplier_id, status)
    VALUES ('REC-DEMO-002', 1, 'PENDING');

    INSERT INTO receipt_items (receipt_order_id, product_id, location_id, quantity)
    VALUES (currval('receipt_orders_id_seq'), 2, 2, 50);

    UPDATE inventory SET quantity = quantity + 50
    WHERE product_id = 2 AND location_id = 2;

    -- Giả sử phát hiện nhà cung cấp sai, hoặc số lượng không đúng → hủy
ROLLBACK;

-- 2c. Tồn kho KHÔNG thay đổi: vẫn = 100
SELECT p.sku, i.quantity AS ton_sau FROM inventory i JOIN products p ON p.id = i.product_id WHERE p.sku = 'PHN-001';

-- 2d. Phiếu nhập KHÔNG tồn tại
SELECT * FROM receipt_orders WHERE code = 'REC-DEMO-002';


-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 3: SAVEPOINT — rollback một phần, giữ lại phần đúng
-- Mục tiêu: PostgreSQL hỗ trợ điểm lưu (SAVEPOINT) để rollback từng phần
-- trong giao dịch mà không mất toàn bộ.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;
    -- Nhập 10 Laptop: hợp lệ
    UPDATE inventory SET quantity = quantity + 10
    WHERE product_id = 1 AND location_id = 1;

    SAVEPOINT before_second_item;

    -- Nhập 999 Chuột vào vị trí KHÔNG TỒN TẠI → lỗi
    UPDATE inventory SET quantity = quantity + 999
    WHERE product_id = 3 AND location_id = 999;
    -- Không có dòng nào bị ảnh hưởng (0 rows), nhưng giả sử nghiệp vụ coi đây là lỗi

    -- Rollback CHỈ phần nhập chuột, giữ lại phần nhập laptop
    ROLLBACK TO SAVEPOINT before_second_item;

    -- Phần nhập laptop vẫn còn, commit
COMMIT;

-- Laptop tăng thêm 10 (70 → 80), Chuột không đổi (200)
SELECT p.sku, i.quantity FROM inventory i JOIN products p ON p.id = i.product_id ORDER BY p.sku;


-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 4: CONSTRAINT CHECK — vi phạm ràng buộc tự động rollback
-- Mục tiêu: CHECK constraint (quantity >= 0) ngăn xuất vượt tồn.
-- PostgreSQL tự hủy statement lỗi; giao dịch chuyển sang trạng thái aborted.
-- ═══════════════════════════════════════════════════════════════════════════════

-- 4a. Tồn kho hiện tại: Laptop = 80
SELECT p.sku, i.quantity FROM inventory i JOIN products p ON p.id = i.product_id WHERE p.sku = 'LAP-001';

-- 4b. Thử xuất 999 cái (vượt tồn 80)
BEGIN;
    UPDATE inventory SET quantity = quantity - 999
    WHERE product_id = 1 AND location_id = 1;
    -- LỖI: new row for relation "inventory" violates check constraint "inventory_quantity_check"
ROLLBACK;

-- 4c. Tồn kho vẫn nguyên: 80
SELECT p.sku, i.quantity FROM inventory i JOIN products p ON p.id = i.product_id WHERE p.sku = 'LAP-001';


-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 5: XUẤT KHO HOÀN CHỈNH — nhiều bước trong 1 giao dịch
-- Mục tiêu: Xuất hàng = tạo phiếu + giữ chỗ + trừ tồn + cập nhật trạng thái,
-- tất cả trong 1 transaction đảm bảo consistency.
-- ═══════════════════════════════════════════════════════════════════════════════

-- 5a. Tồn kho trước
SELECT p.sku, i.quantity, i.reserved_quantity FROM inventory i JOIN products p ON p.id = i.product_id WHERE p.sku = 'MOU-001';

BEGIN;
    -- Bước 1: Tạo phiếu xuất
    INSERT INTO issue_orders (code, customer_id, status)
    VALUES ('ISS-DEMO-001', 1, 'PENDING');

    -- Bước 2: Thêm chi tiết — xuất 30 Chuột
    INSERT INTO issue_items (issue_order_id, product_id, location_id, quantity)
    VALUES (currval('issue_orders_id_seq'), 3, 3, 30);

    -- Bước 3: Giữ chỗ (reserve)
    UPDATE inventory SET reserved_quantity = reserved_quantity + 30
    WHERE product_id = 3 AND location_id = 3;

    -- Bước 4: Thực xuất — trừ tồn và giải phóng reserve
    UPDATE inventory
    SET quantity = quantity - 30,
        reserved_quantity = reserved_quantity - 30
    WHERE product_id = 3 AND location_id = 3;

    -- Bước 5: Cập nhật trạng thái
    UPDATE issue_orders SET status = 'COMPLETED'
    WHERE id = currval('issue_orders_id_seq');
COMMIT;

-- 5b. Tồn kho sau: 200 → 170, reserved = 0
SELECT p.sku, i.quantity, i.reserved_quantity FROM inventory i JOIN products p ON p.id = i.product_id WHERE p.sku = 'MOU-001';
SELECT code, status FROM issue_orders WHERE code = 'ISS-DEMO-001';


-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 6: ISOLATION LEVEL — Read Committed (mặc định của PostgreSQL)
-- Mục tiêu: Chứng minh transaction chỉ thấy dữ liệu đã COMMIT.
-- Demo này cần MỞ 2 TAB pgAdmin (2 session) chạy song song.
--
-- Hướng dẫn:
--   Tab 1 (Session A): Chạy từng lệnh có đánh dấu [A]
--   Tab 2 (Session B): Chạy từng lệnh có đánh dấu [B]
--   Thứ tự chạy: A1 → A2 → B1 → A3 → B2
-- ═══════════════════════════════════════════════════════════════════════════════

-- ===== TAB 1 — SESSION A =====

-- [A1] Bắt đầu giao dịch
BEGIN;

-- [A2] Cập nhật tồn kho nhưng CHƯA COMMIT
UPDATE txn_demo.inventory SET quantity = quantity + 100
WHERE product_id = 1 AND location_id = 1;

-- (Chuyển sang Tab 2 chạy [B1])

-- [A3] Commit thay đổi
COMMIT;

-- (Chuyển sang Tab 2 chạy [B2])


-- ===== TAB 2 — SESSION B =====

-- [B1] Session B đọc: thấy giá trị CŨ (chưa commit của A)
-- Kết quả: quantity = 80 (không thấy +100 chưa commit)
SELECT i.quantity FROM txn_demo.inventory i WHERE product_id = 1 AND location_id = 1;

-- (Quay lại Tab 1 chạy [A3])

-- [B2] Session B đọc lại SAU KHI A đã commit: thấy giá trị MỚI
-- Kết quả: quantity = 180
SELECT i.quantity FROM txn_demo.inventory i WHERE product_id = 1 AND location_id = 1;


-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 7: ISOLATION LEVEL — Repeatable Read vs Phantom Read
-- Mục tiêu: Ở Repeatable Read, cùng 1 truy vấn trong transaction luôn trả
-- kết quả giống nhau, kể cả khi session khác đã COMMIT dữ liệu mới.
--
-- Thứ tự chạy: A1 → A2 → B1 → B2 → A3 → A4
-- ═══════════════════════════════════════════════════════════════════════════════

-- ===== TAB 1 — SESSION A =====

-- [A1] Bắt đầu với Repeatable Read
BEGIN ISOLATION LEVEL REPEATABLE READ;

-- [A2] Đọc lần 1: đếm số phiếu nhập
SELECT count(*) AS so_phieu FROM txn_demo.receipt_orders;

-- (Chuyển sang Tab 2 chạy [B1] và [B2])

-- [A3] Đọc lần 2 (sau khi B đã commit phiếu mới): vẫn thấy SỐ CŨ
-- PostgreSQL đảm bảo snapshot không đổi trong suốt transaction
SELECT count(*) AS so_phieu FROM txn_demo.receipt_orders;

-- [A4]
COMMIT;


-- ===== TAB 2 — SESSION B =====

-- [B1] Thêm 1 phiếu nhập mới
INSERT INTO txn_demo.receipt_orders (code, supplier_id, status) VALUES ('REC-PHANTOM', 2, 'COMPLETED');

-- [B2] Commit
-- (Quay lại Tab 1 chạy [A3])


-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 8: SERIALIZABLE — phát hiện xung đột ghi
-- Mục tiêu: Ở mức Serializable, PostgreSQL phát hiện khi 2 transaction đọc
-- cùng dữ liệu rồi cập nhật dựa trên kết quả đọc → abort 1 transaction.
--
-- Scenario: 2 session cùng đọc tồn kho, cùng quyết định xuất dựa trên số đọc.
-- Thứ tự: A1 → B1 → A2 → B2 → A3 → B3
-- ═══════════════════════════════════════════════════════════════════════════════

-- ===== TAB 1 — SESSION A =====

-- [A1]
BEGIN ISOLATION LEVEL SERIALIZABLE;

-- [A2] Đọc tồn Laptop
SELECT quantity FROM txn_demo.inventory WHERE product_id = 1 AND location_id = 1;

-- (Chuyển sang Tab 2 chạy [B1] [B2])

-- [A3] Xuất 50 cái dựa trên số vừa đọc
UPDATE txn_demo.inventory SET quantity = quantity - 50
WHERE product_id = 1 AND location_id = 1;
COMMIT;


-- ===== TAB 2 — SESSION B =====

-- [B1]
BEGIN ISOLATION LEVEL SERIALIZABLE;

-- [B2] Đọc tồn — cùng dòng với A
SELECT quantity FROM txn_demo.inventory WHERE product_id = 1 AND location_id = 1;

-- (Quay lại Tab 1 chạy [A3])

-- [B3] Cũng xuất 50 cái → PostgreSQL phát hiện xung đột serializable
-- LỖI: could not serialize access due to concurrent update
UPDATE txn_demo.inventory SET quantity = quantity - 50
WHERE product_id = 1 AND location_id = 1;
COMMIT;


-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 9: PHIẾU XUẤT 2 DÒNG, DÒNG 2 THIẾU HÀNG → HỦY TOÀN BỘ
-- Mục tiêu: Dòng 1 (10 chuột) hợp lệ và đã được giữ chỗ, dòng 2 (999 laptop)
-- vượt tồn. Ràng buộc reserved_quantity <= quantity (BR-02) chặn dòng 2, giao dịch
-- chuyển sang aborted; ROLLBACK hủy luôn phiếu và phần giữ chỗ của dòng 1.
-- Đây đúng là cách @Transactional của ứng dụng xử lý (NFR-02).
-- ═══════════════════════════════════════════════════════════════════════════════

-- 9a. Trước: chuột 170 / giữ 0, laptop 130 / giữ 0
SELECT p.sku, i.quantity, i.reserved_quantity FROM inventory i JOIN products p ON p.id = i.product_id ORDER BY p.sku;

BEGIN;
    INSERT INTO issue_orders (code, customer_id, status)
    VALUES ('ISS-DEMO-002', 2, 'PENDING');

    -- Dòng 1: giữ 10 chuột (đủ hàng) → thành công
    INSERT INTO issue_items (issue_order_id, product_id, location_id, quantity)
    VALUES (currval('issue_orders_id_seq'), 3, 3, 10);
    UPDATE inventory SET reserved_quantity = reserved_quantity + 10
    WHERE product_id = 3 AND location_id = 3;

    -- Dòng 2: giữ 999 laptop (chỉ có 130)
    INSERT INTO issue_items (issue_order_id, product_id, location_id, quantity)
    VALUES (currval('issue_orders_id_seq'), 1, 1, 999);
    UPDATE inventory SET reserved_quantity = reserved_quantity + 999
    WHERE product_id = 1 AND location_id = 1;
    -- LỖI: violates check constraint "inventory_reserved_le_quantity"
ROLLBACK;

-- 9b. Sau: không còn gì của phiếu, kể cả phần giữ chỗ của dòng 1
SELECT p.sku, i.quantity, i.reserved_quantity FROM inventory i JOIN products p ON p.id = i.product_id ORDER BY p.sku;
SELECT count(*) AS so_phieu FROM issue_orders WHERE code = 'ISS-DEMO-002';


-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 10: RESET DỮ LIỆU (chạy lại từ đầu)
-- ═══════════════════════════════════════════════════════════════════════════════

DROP SCHEMA txn_demo CASCADE;
-- Sau đó chạy lại 01_setup_data.sql
