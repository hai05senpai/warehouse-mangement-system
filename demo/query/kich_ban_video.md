# Kịch bản quay video: 3.3 Xử lý và tối ưu truy vấn (PostgreSQL và Redis)

Thời lượng dự kiến: **9–11 phút** (PostgreSQL ~6 phút, Redis ~4 phút). Cảnh đánh dấu _(tùy chọn)_ có thể bỏ nếu cần rút ngắn.
File dùng khi quay: `03_demo_postgres.sql` (pgAdmin) và `04_demo_redis.txt` (Redis Insight > Workbench), cùng thư mục với file này.
Số liệu "kết quả mong đợi" đo trên Railway ngày 26/11/2026; khi quay số có thể lệch, **loại phép nối, số dòng và số block thì không đổi**.

## Chuẩn bị trước khi quay (5 phút)

1. Đưa dữ liệu demo về ban đầu (thư mục gốc dự án, Docker đang chạy):
   ```bash
   set -a; source .env; set +a
   docker exec -i logistic-postgres psql "$DATABASE_PUBLIC_URL" < demo/query/01_load_postgres.sql
   PG_URL="$DATABASE_PUBLIC_URL" REDIS_URL="$REDIS_PUBLIC_URL" bash demo/query/02_load_redis.sh
   ```
2. **Bộ gõ: chuyển sang tiếng Anh (ABC).** Telex có thể biến chữ khi gõ lệnh.
3. pgAdmin: kết nối Railway → database `railway` → Query Tool → mở `03_demo_postgres.sql`. Đóng các tab Query Tool cũ.
   - Explain Settings (mũi tên cạnh nút Explain Analyze) bật **Buffers**, **Timing**, **Summary**.
   - Tăng cỡ chữ editor (~16) cho dễ đọc trên video.
4. Redis Insight: mở kết nối Railway → bút chì cạnh `db0` → đổi thành **13** → tab **Workbench** → Clear Results.
5. Mở sẵn `redis_functions.lua` trong VS Code (để chiếu 5–10 giây ở phần Redis).
6. Tắt thông báo hệ thống, đóng ứng dụng không cần. Chạy thử STEP 2b một lần trước khi bấm quay.

Thao tác trong pgAdmin: **bôi đen** đúng đoạn của STEP rồi **F5**. Câu `EXPLAIN ...` chạy F5 cho kế hoạch dạng chữ. Muốn xem sơ đồ thì bôi đen **từ `SELECT` / `WITH` trở đi** (không gồm dòng `EXPLAIN`) rồi **Shift+F7**; tab **Analysis** cạnh sơ đồ có cột thời gian từng toán tử.

---

## Cảnh 0. Mở đầu (~40 giây)

- **Màn hình:** `README.md` của `demo/query` hoặc slide tiêu đề.
- **Lời thoại:** "Phần 3.3 xem hai hệ xử lý một câu truy vấn thế nào. Dùng hai báo cáo của ứng dụng kho, lấy nguyên văn từ `ReportRepository`: hàng chậm luân chuyển (UC-08) và nhập – xuất – tồn (UC-09). Dữ liệu demo là một năm chứng từ: 10.000 phiếu nhập, 10.000 phiếu xuất, 200 lần kiểm kê, nằm riêng ở schema `qry_demo` và Redis database 13."

## Phần A. PostgreSQL (pgAdmin)

### Cảnh A1. STEP 1: Giới thiệu dữ liệu (~20 giây)
- **Thao tác:** bôi đen STEP 1 → F5.
- **Kết quả mong đợi:** 5.000 mặt hàng, 20.000 dòng tồn, 30.000 dòng nhập, 30.000 dòng xuất, 10.000 dòng kiểm kê.

### Cảnh A2. STEP 2: Các giai đoạn xử lý, UC-08 (~70 giây)
- **Thao tác:** bôi đen 2a (`EXPLAIN` không ANALYZE) → F5. Rồi bôi đen 2b → F5; sau đó bôi đen từ `SELECT` của 2b → Shift+F7 cho sơ đồ.
- **Chỉ vào:**
  - 2a: chỉ có `cost=` và `rows=` ước lượng, không có thời gian, vì câu lệnh **không chạy**.
  - 2b: `Hash Anti Join` (từ `NOT EXISTS`), nằm **dưới** phép nối với `inventory`; dòng `Hash Anti Join ... rows=117` cạnh `actual ... rows=1582`; `Planning Time` và `Execution Time` (~74 ms).
- **Lời thoại:** "EXPLAIN chỉ phân tích và lập kế hoạch. EXPLAIN ANALYZE chạy thật. Câu SQL viết NOT EXISTS, bộ tối ưu đã viết lại thành phép anti join, và đặt nó trước phép nối với bảng tồn: lọc còn 1.582 mặt hàng rồi mới tra tồn. Để ý ước lượng 117 dòng nhưng thực tế 1.582: thống kê theo từng cột không biết mặt hàng nào có phiếu xuất gần đây."

### Cảnh A3. STEP 3: Viết khác nhau, cùng kế hoạch (~60 giây)
- **Thao tác:** chạy lần lượt 3a, 3b, 3c (mỗi lần bôi đen 1 câu `EXPLAIN`, F5).
- **Chỉ vào:** 3a và 3b đều `Hash Anti Join` với cùng `cost=921.48..1056.58`; 3c là `Seq Scan on products` với `Filter: (NOT (ANY ... hashed SubPlan 1 ...))`.
- **Lời thoại:** "NOT EXISTS và LEFT JOIN IS NULL là cùng một biểu thức đại số quan hệ, nên cùng kế hoạch đến từng con số chi phí. NOT IN thì khác: nếu tập con có NULL, NOT IN cho NULL chứ không phải TRUE. Phép biến đổi phải giữ nguyên kết quả, nên bộ tối ưu không được đổi NOT IN thành anti join."

### Cảnh A4. STEP 4: Chọn thuật toán nối theo số dòng (~70 giây)
- **Thao tác:** bôi đen 4a → F5 (hoặc từ `SELECT` → Shift+F7); rồi 4b; rồi 4c.
- **Chỉ vào:**
  - 4a (1 ngày): `Nested Loop`, `Index Scan using issue_items_issue_order_id_idx ... loops=25`, ~0,3 ms.
  - 4b (cả năm): `Hash Join`, hai `Seq Scan`, ~19 ms.
  - 4c (sắp theo mã phiếu): `Merge Join` trên hai `Index Scan`, không có nút `Sort`.
- **Lời thoại:** "Cùng một phép nối giữa phiếu xuất và dòng xuất. Một ngày chỉ có 25 phiếu: bộ tối ưu chọn Nested Loop, tra chỉ mục 25 lần. Cả năm 10.000 phiếu: chọn Hash Join, đọc tuần tự hai bảng và băm bảng phiếu. Cần kết quả sắp theo mã phiếu: chọn Merge Join, trộn hai chỉ mục vốn đã sắp, khỏi phải sắp xếp."

### Cảnh A5. STEP 5: Ép dùng thuật toán khác (~50 giây)
- **Thao tác:** pgAdmin chỉ hiện kết quả câu **cuối** của vùng bôi đen, nên: bôi đen 5a từ `SET enable_nestloop` tới hết câu `EXPLAIN` (không gồm `RESET`) → F5, rồi bôi đen dòng `RESET` → F5. Làm tương tự với 5b.
- **Chỉ vào:** so `cost=` dòng đầu và `Execution Time` với 4a / 4b: 5a Hash Join ~7 ms (so với 0,3 ms); 5b Nested Loop + `Memoize` ~56 ms (so với 19 ms).
- **Lời thoại:** "Tối ưu dựa trên chi phí: cấm thuật toán bộ tối ưu đã chọn thì nó phải lấy phương án đắt hơn, cả chi phí ước lượng lẫn thời gian thật đều tăng. Lựa chọn ban đầu là đúng."

### Cảnh A6. STEP 6: Bộ tối ưu không sửa được câu viết dư (~70 giây)
- **Thao tác:** bôi đen 6a (từ `EXPLAIN` tới hết `ORDER BY p.sku;` đầu tiên) → F5; rồi 6b → F5. Cuộn lên đầu kết quả.
- **Chỉ vào:** dòng `Buffers` trên cùng: 6a **1.743** block, ~100 ms; 6b **971** block, ~57 ms. Trong 6a có hai lần `Seq Scan on receipt_items` (và `issue_items`, `stock_take_items`).
- **Lời thoại:** "Câu nhập – xuất – tồn của ứng dụng có 7 CTE. Bộ tối ưu gộp CTE vào câu chính nhưng không nhận ra hai CTE cùng đọc một bảng, nên mỗi bảng chứng từ bị quét hai lần. Viết lại để đọc mỗi bảng một lần, dùng SUM FILTER để tách trong kỳ và từ đầu kỳ: cùng 5.000 dòng kết quả, giảm 44% số block và gần một nửa thời gian. Phần này người viết SQL phải tự làm."

### Cảnh A7. STEP 7: Câu có tham số, custom plan và generic plan (~60 giây)
- **Thao tác:** pgAdmin chỉ hiện kết quả câu cuối, nên chạy **từng phần**: `PREPARE` → F5; `SET ... force_custom_plan` + `EXPLAIN ANALYZE EXECUTE` → F5; `SET ... force_generic_plan` + `EXPLAIN ANALYZE EXECUTE` → F5; `RESET` + `DEALLOCATE` → F5.
- **Chỉ vào:** custom: `Nested Loop`, ước lượng `rows=150` sát thực tế 135, ~0,45 ms. Generic: `Hash Join`, ước lượng `rows=9999` / `rows=3333`, điều kiện hiện `$1`, ~6 ms.
- **Lời thoại:** "Ứng dụng gửi câu SQL có tham số qua JPA. Custom plan lập kế hoạch với giá trị thật nên ước lượng đúng và chọn Nested Loop. Generic plan lập một lần cho mọi giá trị, không biết ngày là bao nhiêu nên đoán một phần ba bảng, chọn Hash Join, chậm hơn khoảng 13 lần. Mặc định PostgreSQL dùng custom plan 5 lần đầu rồi có thể chuyển sang generic."

## Phần B. Redis (Redis Insight > Workbench, database 13)

Mỗi `FCALL` trả về: 1) số dòng, 2) thời gian chạy phía server, 3) ghi chú nếu có. Kết quả mới nhất nằm **trên cùng**.

### Cảnh B1. STEP 1: Không có SQL, không có JOIN (~40 giây)
- **Thao tác:** dán `DBSIZE`, `HGETALL io:1`, `HGETALL ii:1` → Run.
- **Chỉ vào:** `DBSIZE` = **115200** (ra số khác là sai database, đổi sang 13); `ii:1` có trường `order_id`.
- **Lời thoại:** "Cùng dữ liệu, mỗi dòng là một HASH. Redis không có SQL, không có phép nối, không có bộ tối ưu. Muốn nối dòng xuất với phiếu xuất thì phải tự đọc `order_id` rồi tự đọc phiếu."

### Cảnh B2. STEP 2–3: Lập trình viên tự chọn thuật toán (~90 giây)
- **Thao tác:** dán `FCALL q_drop_agg 0` và 3 lệnh của STEP 3 → Run. Chiếu `redis_functions.lua` 5–10 giây ở hàm `q_stagnant_scan` và `q_stagnant_nested`.
- **Kết quả mong đợi:**
  - `q_stagnant_scan`: **1582** dòng, ~130 ms.
  - `q_stagnant_nested ... 20`: 5 dòng, ~0,4 s, "ước tính cho 5000 mặt hàng" ~104.000 ms.
  - `q_inout_scan`: 5000 dòng, ~290 ms, dòng mẫu `AC-00005: dau ky 466 | nhap 31 | xuat 29 | dieu chinh 0 | cuoi ky 468`.
- **Lời thoại:** "Cùng câu hỏi hàng chậm luân chuyển, viết tay theo kiểu hash join: băm phiếu xuất gần đây rồi quét dòng xuất một lần, 130 mili giây, ra đúng 1.582 như PostgreSQL. Viết theo kiểu nested loop không chỉ mục: mỗi mặt hàng quét lại 30.000 dòng xuất. Chỉ chạy 20 mặt hàng đã mất nửa giây; cả 5.000 mặt hàng ước tính gần 2 phút, và Redis đơn luồng bị chặn suốt thời gian đó. PostgreSQL không bao giờ chọn kế hoạch như vậy; Redis không có gì ngăn. Báo cáo nhập – xuất – tồn cũng ra đúng số của PostgreSQL."
- **Lưu ý:** **không tăng số 20** trong `q_stagnant_nested`: Redis Railway dùng chung với ứng dụng.

### Cảnh B3. STEP 4: Cách của Redis, tính sẵn khi ghi (~40 giây)
- **Thao tác:** dán `FCALL q_build_agg 0` và 3 lệnh xem bảng gộp → Run.
- **Chỉ vào:** `q_build_agg` ~0,4 s; `HGET agg:onhand 5` = 468; `agg:last_issue` là ZSET với điểm là thời điểm xuất.
- **Lời thoại:** "Thay vì tính lúc đọc, tính sẵn lúc ghi: tổng tồn theo mặt hàng, lần xuất gần nhất, tổng nhập – xuất theo ngày. Bảng gộp chỉ là các khóa bình thường."

### Cảnh B4. STEP 5: Đọc từ bảng gộp (~30 giây)
- **Thao tác:** dán 2 lệnh STEP 5 → Run.
- **Kết quả mong đợi:** `q_stagnant_agg` 1582 dòng ~8 ms; `q_inout_agg` 5000 dòng ~12 ms, cùng dòng mẫu `AC-00005`.
- **Lời thoại:** "Cùng kết quả, nhanh hơn chính nó khoảng 16–24 lần và nhanh hơn PostgreSQL khoảng 8–9 lần."

### Cảnh B5. STEP 6: Cái giá (~60 giây)
- **Thao tác:** lần lượt `HGETALL inv:15010` → `FCALL q_issue 0 15010 1` → `FCALL q_stagnant_agg 0 1787788800` → `FCALL q_stagnant_scan 0 1787788800` → `DEL agg:last_issue` → `FCALL q_stagnant_agg 0 1787788800` → `FCALL q_build_agg 0`.
- **Chỉ vào:** `q_issue` trả "6 khoa da sua"; cả hai cách đều ra **1581**; sau khi `DEL`, `q_stagnant_agg` trả **5000**, không có lỗi.
- **Lời thoại:** "Xuất một cái cho mặt hàng 10 đang chậm luân chuyển: một lệnh nghiệp vụ phải sửa 6 khóa. Nếu quên cập nhật một bảng gộp, ở đây xóa luôn `agg:last_issue`, báo cáo nói cả 5.000 mặt hàng chậm luân chuyển, sai hoàn toàn mà không có lỗi nào. Bảng gộp chỉ trả lời được những câu hỏi đã thiết kế trước."

## Cảnh kết (~30 giây)

- **Màn hình:** biểu đồ `docs/images/4_3_thoi_gian.png`.
- **Lời thoại:** "PostgreSQL tự viết lại câu truy vấn, tự chọn thuật toán nối theo chi phí và cho xem toàn bộ bằng EXPLAIN; điểm yếu là ước lượng có thể sai và nó không sửa được câu SQL viết dư. Redis không có xử lý truy vấn: lập trình viên là bộ tối ưu, và chỉ nhanh hơn khi tính sẵn kết quả, đổi lại phải tự giữ đồng bộ. Các báo cáo nhiều bảng, khoảng thời gian bất kỳ như UC-08, UC-09 nên chạy trên PostgreSQL."

## Sau khi quay

STEP 6 của Redis đã thêm một phiếu xuất, chạy lại để đưa Redis về ban đầu:

```bash
PG_URL="$DATABASE_PUBLIC_URL" REDIS_URL="$REDIS_PUBLIC_URL" bash demo/query/02_load_redis.sh
```
