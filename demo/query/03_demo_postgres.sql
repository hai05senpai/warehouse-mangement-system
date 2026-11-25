-- =============================================================================
-- DEMO XỬ LÝ VÀ TỐI ƯU TRUY VẤN TRÊN POSTGRESQL: mở trong pgAdmin (Query Tool)
-- Bôi đen từng STEP rồi bấm F5 (chạy) hoặc Shift+F7 (Explain Analyze dạng sơ đồ).
-- Yêu cầu: đã chạy 01_load_postgres.sql. "Hôm nay" của dữ liệu demo là 25/11/2026.
-- Hai báo cáo lấy nguyên văn từ ReportRepository của app (findStagnant, findInOut),
-- chỉ thay tham số :since / :start / :end bằng giá trị cụ thể.
-- =============================================================================

-- STEP 1: Giới thiệu dữ liệu ---------------------------------------------------
SET search_path = qry_demo;

SELECT (SELECT count(*) FROM products)         AS mat_hang,
       (SELECT count(*) FROM inventory)        AS dong_ton,
       (SELECT count(*) FROM receipt_items)    AS dong_nhap,
       (SELECT count(*) FROM issue_items)      AS dong_xuat,
       (SELECT count(*) FROM stock_take_items) AS dong_kiem_ke;


-- STEP 2: Các giai đoạn xử lý một câu truy vấn: UC-08 hàng chậm luân chuyển (90 ngày)
-- 2a. EXPLAIN (không ANALYZE): chỉ phân tích cú pháp + lập kế hoạch, KHÔNG chạy câu lệnh.
--     Nhìn: cây kế hoạch với chi phí ước lượng (cost) và số dòng ước lượng (rows).
--     NOT EXISTS đã được viết lại thành "Hash Anti Join"; phép anti join được đẩy xuống
--     TRƯỚC phép nối với inventory (bộ tối ưu tự đổi thứ tự nối so với câu SQL).
EXPLAIN
SELECT p.id AS "productId", p.sku AS sku, p.name AS "productName",
       SUM(i.quantity) AS "onHand", MAX(last_issue.issue_date) AS "lastIssueDate"
FROM products p
JOIN inventory i ON i.product_id = p.id
LEFT JOIN (
    SELECT ii.product_id, MAX(io.issue_date) AS issue_date
    FROM issue_items ii JOIN issue_orders io ON io.id = ii.issue_order_id
    WHERE io.status = 'COMPLETED'
    GROUP BY ii.product_id
) last_issue ON last_issue.product_id = p.id
WHERE i.quantity > 0
  AND NOT EXISTS (
      SELECT 1 FROM issue_items ii JOIN issue_orders io ON io.id = ii.issue_order_id
      WHERE ii.product_id = p.id AND io.status = 'COMPLETED' AND io.issue_date >= timestamptz '2026-08-27'
  )
GROUP BY p.id, p.sku, p.name
ORDER BY p.sku;

-- 2b. EXPLAIN ANALYZE: chạy thật. Nhìn: "actual rows" bên cạnh "rows" ước lượng,
--     "Planning Time" (lập kế hoạch) tách khỏi "Execution Time" (thực thi).
--     Ước lượng có thể sai: "Hash Anti Join ... rows=117" nhưng "actual ... rows=1582" (sai ~13 lần),
--     vì thống kê chỉ có phân bố từng cột, không biết mặt hàng nào có phiếu xuất gần đây.
EXPLAIN (ANALYZE, BUFFERS)
SELECT p.id AS "productId", p.sku AS sku, p.name AS "productName",
       SUM(i.quantity) AS "onHand", MAX(last_issue.issue_date) AS "lastIssueDate"
FROM products p
JOIN inventory i ON i.product_id = p.id
LEFT JOIN (
    SELECT ii.product_id, MAX(io.issue_date) AS issue_date
    FROM issue_items ii JOIN issue_orders io ON io.id = ii.issue_order_id
    WHERE io.status = 'COMPLETED'
    GROUP BY ii.product_id
) last_issue ON last_issue.product_id = p.id
WHERE i.quantity > 0
  AND NOT EXISTS (
      SELECT 1 FROM issue_items ii JOIN issue_orders io ON io.id = ii.issue_order_id
      WHERE ii.product_id = p.id AND io.status = 'COMPLETED' AND io.issue_date >= timestamptz '2026-08-27'
  )
GROUP BY p.id, p.sku, p.name
ORDER BY p.sku;


-- STEP 3: Viết khác nhau, cùng một kế hoạch: bộ tối ưu làm việc trên ĐẠI SỐ QUAN HỆ ---
-- Ba cách hỏi "mặt hàng không xuất trong 90 ngày". Chạy từng câu.
-- 3a. NOT EXISTS              => Hash Anti Join
EXPLAIN
SELECT p.id FROM products p
WHERE NOT EXISTS (SELECT 1 FROM issue_items ii JOIN issue_orders io ON io.id = ii.issue_order_id
                  WHERE ii.product_id = p.id AND io.status = 'COMPLETED' AND io.issue_date >= timestamptz '2026-08-27');

-- 3b. LEFT JOIN ... IS NULL   => Hash Anti Join, GIỐNG HỆT 3a
EXPLAIN
SELECT p.id FROM products p
LEFT JOIN (SELECT ii.product_id FROM issue_items ii JOIN issue_orders io ON io.id = ii.issue_order_id
           WHERE io.status = 'COMPLETED' AND io.issue_date >= timestamptz '2026-08-27') x ON x.product_id = p.id
WHERE x.product_id IS NULL;

-- 3c. NOT IN                  => KHÔNG thành anti join, mà là "hashed SubPlan".
--     Lý do: NOT IN khác nghĩa khi tập con có NULL (x NOT IN (1, NULL) cho NULL, không phải TRUE),
--     nên bộ tối ưu không được phép biến đổi sang anti join. Phép biến đổi phải GIỮ NGUYÊN kết quả.
EXPLAIN
SELECT p.id FROM products p
WHERE p.id NOT IN (SELECT ii.product_id FROM issue_items ii JOIN issue_orders io ON io.id = ii.issue_order_id
                   WHERE io.status = 'COMPLETED' AND io.issue_date >= timestamptz '2026-08-27');


-- STEP 4: Cùng một phép nối, bộ tối ưu chọn thuật toán theo SỐ DÒNG ước lượng -------
-- 4a. Phiếu xuất của 1 ngày (~25 phiếu)   => Nested Loop + Index Scan (tra chỉ mục 25 lần)
EXPLAIN ANALYZE
SELECT io.code, ii.product_id, ii.quantity
FROM issue_orders io JOIN issue_items ii ON ii.issue_order_id = io.id
WHERE io.issue_date >= timestamptz '2026-11-24' AND io.issue_date < timestamptz '2026-11-25';

-- 4b. Phiếu xuất của cả năm (10.000 phiếu) => Hash Join (đọc tuần tự 2 bảng, băm bảng nhỏ)
EXPLAIN ANALYZE
SELECT io.code, ii.product_id, ii.quantity
FROM issue_orders io JOIN issue_items ii ON ii.issue_order_id = io.id
WHERE io.issue_date >= timestamptz '2025-11-26' AND io.issue_date < timestamptz '2026-11-26';

-- 4c. Cả năm nhưng cần kết quả sắp theo mã phiếu => Merge Join
--     (hai chỉ mục đã sắp sẵn theo id phiếu, trộn hai dãy đã sắp, khỏi phải Sort)
EXPLAIN ANALYZE
SELECT io.code, ii.product_id, ii.quantity
FROM issue_orders io JOIN issue_items ii ON ii.issue_order_id = io.id
ORDER BY io.id;


-- STEP 5: Tối ưu DỰA TRÊN CHI PHÍ: ép dùng thuật toán khác thì chi phí và thời gian đều tăng
-- pgAdmin chỉ hiện kết quả câu CUỐI của vùng bôi đen: bôi đen từ SET tới hết câu EXPLAIN (không gồm RESET) -> F5,
-- rồi bôi đen dòng RESET -> F5. So "cost=" và "Execution Time" với STEP 4a / 4b.
-- 5a. 1 ngày, cấm Nested Loop => Hash Join phải đọc hết 30.000 dòng issue_items
SET enable_nestloop = off;
EXPLAIN ANALYZE
SELECT io.code, ii.product_id, ii.quantity
FROM issue_orders io JOIN issue_items ii ON ii.issue_order_id = io.id
WHERE io.issue_date >= timestamptz '2026-11-24' AND io.issue_date < timestamptz '2026-11-25';
RESET enable_nestloop;

-- 5b. Cả năm, cấm Hash Join và Merge Join => Nested Loop tra chỉ mục 30.000 lần
SET enable_hashjoin = off; SET enable_mergejoin = off;
EXPLAIN ANALYZE
SELECT io.code, ii.product_id, ii.quantity
FROM issue_orders io JOIN issue_items ii ON ii.issue_order_id = io.id
WHERE io.issue_date >= timestamptz '2025-11-26' AND io.issue_date < timestamptz '2026-11-26';
RESET enable_hashjoin; RESET enable_mergejoin;


-- STEP 6: UC-09 nhập - xuất - tồn tháng 10/2026: viết lại câu truy vấn để đọc ít hơn ----
-- 6a. Câu của app: 7 CTE. Bộ tối ưu gộp CTE vào câu chính (inline), nhưng KHÔNG nhận ra
--     receipt_totals / all_receipts (và issue / adjustment) cùng đọc một bảng:
--     receipt_items, issue_items, stock_take_items mỗi bảng bị quét 2 lần.
--     Nhìn: số "Seq Scan on receipt_items" và dòng "Buffers" trên cùng.
EXPLAIN (ANALYZE, BUFFERS)
WITH receipt_totals AS (
    SELECT ri.product_id, SUM(ri.quantity) AS qty
    FROM receipt_items ri JOIN receipt_orders ro ON ro.id = ri.receipt_order_id
    WHERE ro.status = 'COMPLETED' AND ro.receipt_date >= timestamptz '2026-10-01' AND ro.receipt_date < timestamptz '2026-11-01'
    GROUP BY ri.product_id
), issue_totals AS (
    SELECT ii.product_id, SUM(ii.quantity) AS qty
    FROM issue_items ii JOIN issue_orders io ON io.id = ii.issue_order_id
    WHERE io.status = 'COMPLETED' AND io.issue_date >= timestamptz '2026-10-01' AND io.issue_date < timestamptz '2026-11-01'
    GROUP BY ii.product_id
), adjustments AS (
    SELECT si.product_id, SUM(si.actual_qty - si.system_qty) AS qty
    FROM stock_take_items si JOIN stock_takes st ON st.id = si.stock_take_id
    WHERE st.status = 'COMPLETED' AND st.stock_take_date >= timestamptz '2026-10-01' AND st.stock_take_date < timestamptz '2026-11-01'
    GROUP BY si.product_id
), all_receipts AS (
    SELECT ri.product_id, SUM(ri.quantity) AS qty
    FROM receipt_items ri JOIN receipt_orders ro ON ro.id = ri.receipt_order_id
    WHERE ro.status = 'COMPLETED' AND ro.receipt_date >= timestamptz '2026-10-01'
    GROUP BY ri.product_id
), all_issues AS (
    SELECT ii.product_id, SUM(ii.quantity) AS qty
    FROM issue_items ii JOIN issue_orders io ON io.id = ii.issue_order_id
    WHERE io.status = 'COMPLETED' AND io.issue_date >= timestamptz '2026-10-01'
    GROUP BY ii.product_id
), all_adjustments AS (
    SELECT si.product_id, SUM(si.actual_qty - si.system_qty) AS qty
    FROM stock_take_items si JOIN stock_takes st ON st.id = si.stock_take_id
    WHERE st.status = 'COMPLETED' AND st.stock_take_date >= timestamptz '2026-10-01'
    GROUP BY si.product_id
), closing AS (
    SELECT product_id, SUM(quantity) AS qty FROM inventory GROUP BY product_id
)
SELECT p.id AS "productId", p.sku AS sku, p.name AS "productName",
       COALESCE(c.qty, 0) - COALESCE(ar.qty, 0) + COALESCE(ai.qty, 0) - COALESCE(aa.qty, 0) AS "openingQuantity",
       COALESCE(r.qty, 0) AS "receivedQuantity", COALESCE(i.qty, 0) AS "issuedQuantity",
       COALESCE(a.qty, 0) AS "adjustmentQuantity",
       COALESCE(c.qty, 0) - COALESCE(ar.qty, 0) + COALESCE(ai.qty, 0) - COALESCE(aa.qty, 0)
       + COALESCE(r.qty, 0) - COALESCE(i.qty, 0) + COALESCE(a.qty, 0) AS "closingQuantity"
FROM products p
LEFT JOIN closing c ON c.product_id = p.id
LEFT JOIN receipt_totals r ON r.product_id = p.id
LEFT JOIN issue_totals i ON i.product_id = p.id
LEFT JOIN adjustments a ON a.product_id = p.id
LEFT JOIN all_receipts ar ON ar.product_id = p.id
LEFT JOIN all_issues ai ON ai.product_id = p.id
LEFT JOIN all_adjustments aa ON aa.product_id = p.id
ORDER BY p.sku;

-- 6b. Viết lại: gom mọi biến động từ đầu kỳ vào một luồng (UNION ALL), đọc mỗi bảng 1 lần,
--     rồi tách "trong kỳ" và "từ đầu kỳ đến nay" bằng SUM(...) FILTER (WHERE ...).
--     Kết quả giống hệt 6a (cùng 5.000 dòng, cùng số liệu), nhưng ít block và nhanh hơn.
--     Đây là việc bộ tối ưu KHÔNG tự làm được: người viết SQL phải tự tối ưu ở mức câu lệnh.
EXPLAIN (ANALYZE, BUFFERS)
WITH movements AS (
    SELECT ri.product_id, ro.receipt_date AS at, ri.quantity AS qty, 'R' AS kind
    FROM receipt_items ri JOIN receipt_orders ro ON ro.id = ri.receipt_order_id
    WHERE ro.status = 'COMPLETED' AND ro.receipt_date >= timestamptz '2026-10-01'
    UNION ALL
    SELECT ii.product_id, io.issue_date, -ii.quantity, 'I'
    FROM issue_items ii JOIN issue_orders io ON io.id = ii.issue_order_id
    WHERE io.status = 'COMPLETED' AND io.issue_date >= timestamptz '2026-10-01'
    UNION ALL
    SELECT si.product_id, st.stock_take_date, si.actual_qty - si.system_qty, 'A'
    FROM stock_take_items si JOIN stock_takes st ON st.id = si.stock_take_id
    WHERE st.status = 'COMPLETED' AND st.stock_take_date >= timestamptz '2026-10-01'
), per_product AS (
    SELECT product_id,
           SUM(qty) AS since_start,
           SUM(qty)  FILTER (WHERE kind = 'R' AND at < timestamptz '2026-11-01') AS received,
           -SUM(qty) FILTER (WHERE kind = 'I' AND at < timestamptz '2026-11-01') AS issued,
           SUM(qty)  FILTER (WHERE kind = 'A' AND at < timestamptz '2026-11-01') AS adjusted
    FROM movements GROUP BY product_id
), closing AS (
    SELECT product_id, SUM(quantity) AS qty FROM inventory GROUP BY product_id
)
SELECT p.id AS "productId", p.sku AS sku, p.name AS "productName",
       COALESCE(c.qty, 0) - COALESCE(m.since_start, 0) AS "openingQuantity",
       COALESCE(m.received, 0) AS "receivedQuantity", COALESCE(m.issued, 0) AS "issuedQuantity",
       COALESCE(m.adjusted, 0) AS "adjustmentQuantity",
       COALESCE(c.qty, 0) - COALESCE(m.since_start, 0)
       + COALESCE(m.received, 0) - COALESCE(m.issued, 0) + COALESCE(m.adjusted, 0) AS "closingQuantity"
FROM products p
LEFT JOIN closing c ON c.product_id = p.id
LEFT JOIN per_product m ON m.product_id = p.id
ORDER BY p.sku;


-- STEP 7: Câu có tham số (app gửi qua JPA): kế hoạch riêng và kế hoạch chung ----------
-- Chạy từng phần (pgAdmin chỉ hiện kết quả câu cuối): PREPARE; SET + EXPLAIN custom; SET + EXPLAIN generic; RESET + DEALLOCATE.
-- Cùng câu, cùng giá trị tham số ('2026-11-24', chỉ ~45 phiếu):
--   custom plan  : lập kế hoạch với GIÁ TRỊ THẬT => ước lượng ~50 dòng => Nested Loop
--   generic plan : lập kế hoạch một lần cho MỌI giá trị, không biết $1 => đoán 1/3 bảng
--                  (rows=3333) => Hash Join đọc hết issue_items, chậm hơn.
-- Mặc định (auto) PostgreSQL dùng custom plan 5 lần đầu rồi có thể chuyển sang generic plan.
PREPARE recent_issues(timestamptz) AS
SELECT io.code, ii.product_id, ii.quantity
FROM issue_orders io JOIN issue_items ii ON ii.issue_order_id = io.id
WHERE io.issue_date >= $1;

SET plan_cache_mode = force_custom_plan;
EXPLAIN ANALYZE EXECUTE recent_issues('2026-11-24');

SET plan_cache_mode = force_generic_plan;
EXPLAIN ANALYZE EXECUTE recent_issues('2026-11-24');

RESET plan_cache_mode;
DEALLOCATE recent_issues;
