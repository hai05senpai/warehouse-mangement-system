# Kịch bản quay video: 3.2 Chỉ mục (PostgreSQL và Redis)

Thời lượng dự kiến: **9–11 phút** (PostgreSQL ~6 phút, Redis ~4 phút). Cảnh đánh dấu _(tùy chọn)_ có thể bỏ nếu cần rút ngắn.
File dùng khi quay: `03_demo_postgres.sql` (pgAdmin) và `04_demo_redis.txt` (Redis Insight > Workbench), cùng thư mục với file này.
Số liệu "kết quả mong đợi" đo trên Railway ngày 25/11/2026; khi quay số có thể lệch, **loại phép quét và số block thì không đổi**.

## Chuẩn bị trước khi quay (5 phút)

1. Đưa dữ liệu demo về ban đầu (thư mục gốc dự án, Docker đang chạy):
   ```bash
   set -a; source .env; set +a
   docker exec -i logistic-postgres psql "$DATABASE_PUBLIC_URL" < demo/indexing/01_load_postgres.sql
   PG_URL="$DATABASE_PUBLIC_URL" REDIS_URL="$REDIS_PUBLIC_URL" bash demo/indexing/02_load_redis.sh
   ```
2. **Bộ gõ: chuyển sang tiếng Anh (ABC).** Telex có thể biến chữ khi gõ lệnh.
3. pgAdmin: kết nối Railway → database `railway` → Query Tool → mở `03_demo_postgres.sql`. Đóng các tab Query Tool cũ.
   - Explain Settings (mũi tên cạnh nút Explain Analyze) bật **Buffers**, **Timing**, **Summary**.
   - Tăng cỡ chữ editor (Preferences > Query Tool > Editor > Font size ~16) cho dễ đọc trên video.
4. Redis Insight: mở kết nối Railway → bút chì cạnh `db0` → đổi thành **15** → tab **Workbench** → Clear Results.
5. Tắt thông báo hệ thống (Focus / Do Not Disturb), đóng các ứng dụng không cần.
6. Chạy thử STEP 3 của PostgreSQL một lần trước khi bấm quay (cho cache nóng, số đo ổn định hơn).

Thao tác trong pgAdmin: **bôi đen** đúng đoạn của STEP rồi **F5**. Với các câu `EXPLAIN ...`, F5 cho kế hoạch dạng chữ (có `Buffers`). Muốn xem sơ đồ thì bôi đen **từ `SELECT` trở đi** (không gồm dòng `EXPLAIN`) rồi **Shift+F7**.

---

## Cảnh 0. Mở đầu (~30 giây)

- **Màn hình:** slide tiêu đề hoặc file `README.md` của `demo/indexing`.
- **Lời thoại:** "Phần 3.2 so sánh chỉ mục trên PostgreSQL và Redis. Hai truy vấn lấy từ ứng dụng kho: tra tồn theo khu (UC-06) và cảnh báo tồn thấp (UC-07). Dữ liệu demo nằm riêng, schema `idx_demo` trên PostgreSQL và database 15 trên Redis, không ảnh hưởng dữ liệu thật."

## Phần A. PostgreSQL (pgAdmin)

### Cảnh A1. STEP 1: Giới thiệu dữ liệu (~30 giây)
- **Thao tác:** bôi đen STEP 1 → F5.
- **Kết quả mong đợi:** 100.000 dòng tồn, 2.000 vị trí, 5.000 mặt hàng; bảng khu: Khu 01–10 mỗi khu 190 vị trí, Khu 11–20 mỗi khu 10 vị trí.
- **Lời thoại:** "100.000 dòng tồn kho. Các khu có kích thước khác nhau có chủ đích: khu lớn 190 vị trí, khu nhỏ chỉ 10 vị trí, để xem khi nào chỉ mục có lợi."

### Cảnh A2. STEP 2: Xóa chỉ mục (~20 giây)
- **Thao tác:** bôi đen STEP 2 → F5.
- **Chỉ vào:** danh sách chỉ mục chỉ còn `*_pkey` và `*_key` (khóa chính, UNIQUE).
- **Lời thoại:** "Bắt đầu từ trạng thái chỉ có chỉ mục mặc định của khóa chính và UNIQUE."

### Cảnh A3. STEP 3: Trước khi có chỉ mục (~45 giây)
- **Thao tác:** bôi đen câu `EXPLAIN (ANALYZE, BUFFERS) ...` của STEP 3 → F5. Sau đó bôi đen từ `SELECT` → Shift+F7 để xem sơ đồ.
- **Chỉ vào:** `Seq Scan on inventory ... rows=100000`, `Buffers: shared hit=834`, dòng `Execution Time` (~18–20 ms).
- **Lời thoại:** "Không có chỉ mục, PostgreSQL phải đọc tuần tự cả 834 block của bảng inventory để lấy 500 dòng của Khu 15."

### Cảnh A4. STEP 4: Tạo chỉ mục (~30 giây)
- **Thao tác:** bôi đen STEP 4 → F5.
- **Lời thoại:** "Tạo hai chỉ mục B+-tree: chỉ mục biểu thức trên `lower(zone)`, khớp đúng điều kiện WHERE của ứng dụng, và chỉ mục trên khóa ngoại `location_id`, vì PostgreSQL không tự đánh chỉ mục khóa ngoại. Chỉ khai báo một lần, DBMS tự xây và tự cập nhật."

### Cảnh A5. STEP 5: Sau khi có chỉ mục (~45 giây)
- **Thao tác:** bôi đen STEP 5 → F5, rồi Shift+F7.
- **Chỉ vào:** `Index Scan using idx_locations_zone_lower` (rows=10), `Bitmap Index Scan on idx_inventory_location`, `Heap Blocks: exact=500`, `Execution Time` (~2–4 ms).
- **Lời thoại:** "Cùng câu SQL, không sửa gì. Bộ tối ưu tự chọn dùng chỉ mục: tìm 10 vị trí qua chỉ mục biểu thức, rồi lấy 500 dòng qua Bitmap Index Scan. Số block giảm khoảng 4 lần, thời gian giảm khoảng 4–5 lần."

### Cảnh A6. STEP 6: Khu lớn, chỉ mục không được dùng (~45 giây)
- **Thao tác:** bôi đen STEP 6 → F5.
- **Chỉ vào:** vẫn `Seq Scan on inventory`; phép nối đổi sang `Hash Join`.
- **Lời thoại:** "Khu 05 có 9.500 dòng, nằm rải trên gần hết 834 block. Đây là chỉ mục thứ cấp trên tệp không sắp xếp, nên theo chỉ mục còn tốn hơn đọc tuần tự. Bộ tối ưu tự nhận ra và không dùng chỉ mục: chỉ mục chỉ có lợi khi điều kiện đủ chọn lọc."

### Cảnh A7. STEP 7: Chỉ mục theo hàm _(tùy chọn, ~40 giây)_
- **Thao tác:** bôi đen cả khối STEP 7 tới hết câu `EXPLAIN SELECT * FROM locations ...` → F5. Sau đó bôi đen 3 dòng "Khôi phục chỉ mục đúng" → F5.
- **Chỉ vào:** `Seq Scan on locations`, không có `idx_zone_plain`.
- **Lời thoại:** "Nếu tạo chỉ mục trên cột `zone` trơn, câu `WHERE lower(zone) = ...` không dùng được nó. Khóa của chỉ mục phải là đúng biểu thức trong điều kiện."

### Cảnh A8. STEP 8: Tìm SKU chứa chuỗi, GIN trigram (~45 giây)
- **Thao tác:** chạy lần lượt 8a → 8b → 8c (mỗi lần bôi đen 1 câu, F5).
- **Chỉ vào:** 8a `Seq Scan on products`; 8c `Bitmap Index Scan on idx_products_sku_trgm`.
- **Kết quả mong đợi:** ~2,4 ms → ~0,3 ms; 52 → 7 block.
- **Lời thoại:** "`LIKE '%0123%'` không dùng được B+-tree vì B+-tree chỉ phục vụ tiền tố. GIN trigram tách chuỗi thành các bộ 3 ký tự nên tìm được chuỗi con."

### Cảnh A9. STEP 9: Hash và B+-tree _(tùy chọn, ~40 giây)_
- **Thao tác:** chạy **từng dòng** trong khối STEP 9 (BEGIN, DROP, CREATE, ANALYZE, EXPLAIN 1, EXPLAIN 2, ROLLBACK). pgAdmin chỉ hiện kết quả câu cuối nếu chạy cả khối.
- **Chỉ vào:** EXPLAIN 1 dùng `idx_zone_hash`; EXPLAIN 2 (`LIKE 'khu 1%'`) là `Seq Scan`.
- **Lời thoại:** "Chỉ mục băm chỉ phục vụ phép bằng; tìm tiền tố hay khoảng cần B+-tree. ROLLBACK ở cuối hoàn tác mọi thay đổi."

### Cảnh A10. STEP 10: Truy vấn gộp UC-07 (~40 giây)
- **Thao tác:** bôi đen STEP 10 → F5.
- **Chỉ vào:** vẫn `Seq Scan on inventory`, ~60 ms.
- **Lời thoại:** "Cảnh báo tồn thấp phải cộng tồn của mọi mặt hàng, tức là đọc mọi dòng. Không chỉ mục nào giúp được. Lát nữa xem Redis xử lý bài này thế nào."

### Cảnh A11. Dọn (~10 giây)
- **Thao tác:** chạy lại STEP 2.
- **Lời thoại:** "Chạy lại STEP 2 để đưa dữ liệu về ban đầu."

## Phần B. Redis (Redis Insight > Workbench, database 15)

Mỗi `FCALL` trả về: 1) số dòng, 2) thời gian chạy phía server. Kết quả mới nhất nằm **trên cùng**.

### Cảnh B1. STEP 1: Redis chỉ tra theo khóa (~40 giây)
- **Thao tác:** dán 3 lệnh `DBSIZE`, `HGETALL inv:1`, `HGETALL prod:1` → Run.
- **Chỉ vào:** `DBSIZE` = **105000** (nếu ra 0–2 là đang ở db 0, đổi sang 15).
- **Lời thoại:** "Cùng dữ liệu, mỗi dòng là một HASH. Redis chỉ có một đường truy cập là theo khóa: không có WHERE, không có CREATE INDEX."

### Cảnh B2. STEP 2–3: Chưa có chỉ mục (~60 giây)
- **Thao tác:** dán `FCALL drop_indexes 0` và 4 lệnh `FCALL scan_*` của STEP 3 → Run.
- **Kết quả mong đợi:** khu 15: 500 dòng ~100 ms; khu 05: 9.503 dòng ~130 ms; SKU chứa `0123`: 220 dòng ~110 ms; tồn thấp: 250 dòng ~180 ms.
- **Lời thoại:** "Không có chỉ mục thì chỉ còn cách duyệt cả 100.000 khóa, giống Seq Scan. Code của các hàm này nằm trong `redis_functions.lua`." (có thể chuyển sang file Lua 5 giây để cho thấy vòng lặp `KEYS`).

### Cảnh B3. STEP 4: Tự xây chỉ mục (~50 giây)
- **Thao tác:** dán `FCALL build_indexes 0` và 4 lệnh xem chỉ mục (`SCARD`, `SMEMBERS`, `ZRANGE`, `ZRANGEBYSCORE`) → Run.
- **Kết quả mong đợi:** ~5.000 khóa chỉ mục, ~0,6–0,7 giây.
- **Lời thoại:** "Tương đương CREATE INDEX, nhưng phải tự viết code. Chỉ mục chỉ là các khóa bình thường: SET `idx:zone:khu 15` chứa id các dòng tồn của khu, ZSET `idx:sku` để tìm tiền tố, ZSET `idx:lowstock` tính sẵn tổng tồn trừ ngưỡng."

### Cảnh B4. STEP 5: Truy vấn qua chỉ mục (~40 giây)
- **Thao tác:** dán 3 lệnh `FCALL idx_*` của STEP 5 → Run.
- **Kết quả mong đợi:** khu 15 ~4–5 ms; khu 05 ~25 ms; tồn thấp ~0,6–0,8 ms (cùng 250 dòng).
- **Lời thoại:** "Truy vấn phải viết lại để đọc đúng khóa chỉ mục. Tồn thấp nhanh hơn khoảng 200 lần, nhưng đó là nhờ tính sẵn, không phải chỉ mục theo nghĩa của giáo trình."

### Cảnh B5. STEP 6: Tiền tố và chứa chuỗi _(tùy chọn, ~30 giây)_
- **Thao tác:** dán 2 lệnh STEP 6 → Run.
- **Lời thoại:** "Tiền tố thì ZRANGEBYLEX làm được như B+-tree. Chứa chuỗi thì Redis không có cấu trúc tương đương GIN, vẫn phải duyệt từ điển 5.000 SKU."

### Cảnh B6. STEP 7: Cái giá khi ghi (~50 giây)
- **Thao tác:** chạy `ZRANGEBYSCORE idx:lowstock -inf (0 WITHSCORES LIMIT 0 1` → lấy `product_id` → `SMEMBERS idx:product:<product_id>` → lấy 1 id → `FCALL update_stock 0 <inv_id> 5000` → `FCALL idx_lowstock 0`.
- **Chỉ vào:** `update_stock` trả "(đủ hàng)"; `idx_lowstock` còn **249** dòng.
- **Lời thoại:** "Nhập thêm hàng cho một dòng tồn: ứng dụng phải tự sửa dữ liệu và ba chỉ mục liên quan. PostgreSQL làm việc này tự động trong cùng giao dịch."

### Cảnh B7. STEP 8: Mất chỉ mục thì kết quả sai (~40 giây)
- **Thao tác:** `DEL "idx:zone:khu 15"` → `FCALL idx_zone 0 "khu 15"` → `FCALL build_indexes 0`.
- **Chỉ vào:** `idx_zone` trả **0** dòng, không có lỗi.
- **Lời thoại:** "Xóa chỉ mục ở PostgreSQL thì truy vấn chỉ chậm lại, kết quả vẫn đúng. Ở Redis, truy vấn trả về rỗng mà không báo lỗi nào."

## Cảnh kết (~30 giây)

- **Màn hình:** biểu đồ `docs/images/4_2_thoi_gian.png` hoặc slide tổng kết.
- **Lời thoại:** "PostgreSQL có đủ các loại chỉ mục của giáo trình, DBMS tự duy trì và bộ tối ưu tự quyết định dùng hay không. Redis chỉ tra theo khóa; chỉ mục là code của ứng dụng, nhanh khi tính sẵn được nhưng phải tự giữ đồng bộ. Hệ thống kho dùng PostgreSQL làm CSDL chính, Redis làm lớp cache cho kết quả gộp như danh sách tồn thấp."

## Sau khi quay

STEP 7 của Redis đã sửa dữ liệu, chạy lại để đưa Redis về ban đầu:

```bash
PG_URL="$DATABASE_PUBLIC_URL" REDIS_URL="$REDIS_PUBLIC_URL" bash demo/indexing/02_load_redis.sh
```
