# Demo xử lý và tối ưu truy vấn: PostgreSQL và Redis (mục 4.3)

Hai báo cáo của app trên một năm chứng từ: **hàng chậm luân chuyển (UC-08)** và **nhập - xuất - tồn (UC-09)**.

- **PostgreSQL**: `EXPLAIN` / `EXPLAIN ANALYZE` để xem bộ tối ưu viết lại câu truy vấn, chọn thuật toán nối theo chi phí, và chỗ nó không tự làm được.
- **Redis**: không có SQL, không có bộ tối ưu; lập trình viên tự chọn thuật toán (hash join / nested loop viết tay) hoặc tính sẵn kết quả gộp khi ghi.

Dữ liệu demo nằm riêng (schema `qry_demo` trên PostgreSQL, database `13` trên Redis), **không ảnh hưởng dữ liệu của app**. Hai câu báo cáo lấy nguyên văn từ `ReportRepository` (`findStagnant`, `findInOut`).

## Các file

| File                   | Loại        | Dùng để                                                                                    |
| ---------------------- | ----------- | ------------------------------------------------------------------------------------------ |
| `01_load_postgres.sql` | Nạp dữ liệu | Tạo schema `qry_demo`: 5.000 mặt hàng, 20.000 dòng tồn, 1 năm phiếu nhập / xuất / kiểm kê |
| `02_load_redis.sh`     | Nạp dữ liệu | Chép đúng dữ liệu đó sang Redis database 13 + cài các hàm trong `redis_functions.lua`      |
| `redis_functions.lua`  | Code        | Hai báo cáo viết tay trên Redis: quét + nối thủ công, bảng gộp tính sẵn, chi phí khi ghi   |
| `03_demo_postgres.sql` | **Demo**    | 7 bước demo, mở trong **pgAdmin**                                                          |
| `04_demo_redis.txt`    | **Demo**    | 6 bước demo, dán vào **Redis Insight > Workbench**                                         |
| `05_measure.py`        | Đo          | Đo lại toàn bộ demo trên máy chủ (6 lần, bỏ lần đầu, trung vị) → `results.json`            |
| `kich_ban_video.md`    | **Video**   | Kịch bản quay video demo: chuẩn bị, từng cảnh, lời thoại, kết quả mong đợi                |

## Cách dùng

**1. Trước giờ demo** (tại thư mục gốc dự án, container đang chạy: `docker compose up -d`):

```bash
docker exec -i logistic-postgres psql -U logistic_user -d logistic_db < demo/query/01_load_postgres.sql
bash demo/query/02_load_redis.sh
```

Nạp lên **Railway** thay vì Docker (URL lấy từ `.env`; container Docker vẫn cần chạy vì dùng `psql` / `redis-cli` trong đó làm client):

```bash
set -a; source .env; set +a
docker exec -i logistic-postgres psql "$DATABASE_PUBLIC_URL" < demo/query/01_load_postgres.sql
PG_URL="$DATABASE_PUBLIC_URL" REDIS_URL="$REDIS_PUBLIC_URL" bash demo/query/02_load_redis.sh
```

Chạy lại 2 lệnh này bất cứ lúc nào để đưa dữ liệu demo về trạng thái ban đầu. Sau buổi demo nên chạy lại dòng Redis (STEP 6 bên Redis có thêm một phiếu xuất). Các bước PostgreSQL không sửa dữ liệu.

**2. Khi demo:**

- **PostgreSQL:** pgAdmin → Query Tool → mở `03_demo_postgres.sql`. Bôi đen từng STEP, bấm **F5** (hoặc **Shift+F7** để xem plan dạng sơ đồ; khi đó chỉ bôi đen câu `SELECT`, bỏ dòng `EXPLAIN ...`).
- **Redis:** Redis Insight → mở kết nối → đổi sang database **13** (bút chì cạnh `db0`) → Workbench → chạy từng lệnh trong `04_demo_redis.txt`.

**Dọn dẹp** (Railway: thay `-U logistic_user -d logistic_db` bằng `"$DATABASE_PUBLIC_URL"`, thêm `-u "$REDIS_PUBLIC_URL"` sau `redis-cli`):

```bash
docker exec logistic-postgres psql -U logistic_user -d logistic_db -c "DROP SCHEMA qry_demo CASCADE"
docker exec logistic-redis redis-cli -n 13 FLUSHDB
docker exec logistic-redis redis-cli FUNCTION DELETE qry_demo
```

## Dữ liệu demo

"Hôm nay" của dữ liệu cố định là **25/11/2026**; chứng từ trải đều từ 26/11/2025. Trạng thái lệch có chủ đích: ~90% `COMPLETED`, ~7% `PENDING`, ~3% `CANCELLED`.

| Bảng                                | Số dòng         | Ghi chú                                                                              |
| ----------------------------------- | --------------- | ------------------------------------------------------------------------------------ |
| `products`                          | 5.000           | id chia hết cho 10: không xuất trong 90 ngày cuối; chia hết cho 50: chưa từng xuất |
| `inventory`                         | 20.000          | Mỗi mặt hàng ở 4 vị trí                                                              |
| `receipt_orders` / `receipt_items`  | 10.000 / 30.000 |                                                                                      |
| `issue_orders` / `issue_items`      | 10.000 / 30.000 |                                                                                      |
| `stock_takes` / `stock_take_items`  | 200 / 10.000    |                                                                                      |

Demo có thêm chỉ mục trên khóa ngoại và ngày chứng từ (`issue_items(issue_order_id)`, `issue_orders(issue_date)`, ...) để bộ tối ưu **có** lựa chọn giữa các cách nối. App hiện chưa có các chỉ mục này.

## Kết quả tham khảo (MacBook, Docker, PostgreSQL 17 / Redis 7.4; đơn vị ms)

| Bước                                                | PostgreSQL                                             | Redis                                     |
| --------------------------------------------------- | ------------------------------------------------------ | ----------------------------------------- |
| UC-08, 90 ngày (1.582 mặt hàng)                     | ~18 (câu của app, Hash Anti Join)                      | ~75 (hash anti join viết tay)             |
| UC-08 viết kiểu nested loop không chỉ mục           | không bao giờ được chọn                                 | ~200 cho 20 mặt hàng, ước tính **~50.000** cho 5.000 |
| UC-09, tháng 10/2026 (5.000 dòng)                   | ~28 câu của app (1.746 block) → ~19 viết lại (971 block) | ~150 (quét + nối viết tay)                |
| Dựng bảng gộp                                       |                                                        | ~270                                      |
| UC-08 / UC-09 từ bảng gộp                           |                                                        | **~6 / ~6**                               |
| Nối 1 ngày phiếu xuất: Nested Loop (ép Hash Join)    | ~0,1 (~2)                                              |                                           |
| Nối cả năm: Hash Join (ép Nested Loop)               | ~5 (~12)                                               |                                           |
| Câu có tham số: custom plan / generic plan           | ~0,1 / ~2                                              |                                           |

Trên **Railway** (PostgreSQL 18.7 / Redis 8.2; 6 lần, bỏ lần đầu, lấy trung vị, đo bằng `05_measure.py`, kết quả trong `results.json`): kế hoạch thực thi giống hệt Docker, thời gian chậm hơn ~2–4 lần.
PostgreSQL: UC-08 ~74; UC-09 ~100 → ~57 khi viết lại; nối 1 ngày ~0,3 (ép Hash Join ~7); nối cả năm ~19 (ép Nested Loop ~56); custom / generic plan ~0,45 / ~6.
Redis: UC-08 quét ~128, nested loop ~415 cho 20 mặt hàng (ước tính ~104.000 cho 5.000), UC-09 quét ~290, dựng bảng gộp ~400, UC-08 / UC-09 từ bảng gộp ~8 / ~12.

Hai hệ cho **cùng kết quả**: 1.582 mặt hàng chậm luân chuyển; dòng mẫu UC-09 `AC-00005`: đầu kỳ 466, nhập 31, xuất 29, điều chỉnh 0, cuối kỳ 468.
Số liệu thay đổi theo máy và giữa các lần chạy; khi trình bày nhấn vào **loại phép nối** và **số block** (`Buffers`), thời gian chỉ là phụ.

## Nhận xét để đưa vào báo cáo

1. **PostgreSQL xử lý câu truy vấn qua nhiều giai đoạn** (phân tích → viết lại → lập kế hoạch → thực thi). `EXPLAIN` chỉ lập kế hoạch, `EXPLAIN ANALYZE` chạy thật và tách `Planning Time` / `Execution Time` (STEP 2).
2. **Bộ tối ưu viết lại câu lệnh theo đại số quan hệ**: `NOT EXISTS` và `LEFT JOIN ... IS NULL` cho cùng một `Hash Anti Join`; bộ tối ưu còn đổi thứ tự nối (anti join chạy trước khi nối với `inventory`). `NOT IN` thì không được biến đổi vì khác nghĩa khi có `NULL` (STEP 3).
3. **Chọn thuật toán nối theo chi phí ước lượng**: 1 ngày → Nested Loop + chỉ mục, cả năm → Hash Join, cần sắp xếp → Merge Join (STEP 4). Ép dùng cách khác thì chi phí và thời gian đều tăng (STEP 5).
4. **Ước lượng có thể sai**: anti join ở UC-08 ước lượng 117 dòng, thực tế 1.582. Câu có tham số dùng generic plan thì không biết giá trị, đoán 1/3 bảng, chọn kế hoạch kém hơn (STEP 7). App gửi tham số qua JPA nên gặp đúng tình huống này.
5. **Bộ tối ưu không sửa được mọi thứ**: câu UC-09 của app đọc `receipt_items` / `issue_items` / `stock_take_items` mỗi bảng 2 lần; viết lại để đọc 1 lần giảm ~44% block, cùng kết quả (STEP 6).
6. **Redis: lập trình viên là bộ tối ưu.** Cùng một câu hỏi, viết kiểu hash join mất ~75 ms, viết kiểu nested loop mất ~50 giây, không có gì ngăn cách viết tệ (STEP 3 Redis). Cách nhanh của Redis là **tính sẵn** kết quả gộp (~6 ms), đổi lại mỗi lệnh xuất kho phải sửa 6 khóa và quên một khóa thì báo cáo sai mà không báo lỗi (STEP 6 Redis).

## Lưu ý

- Các hàm Redis dùng `KEYS` để duyệt toàn bộ dữ liệu. Lệnh này chặn server, **chỉ dùng cho demo**. `q_stagnant_nested` cũng chặn server trong lúc chạy (~0,5 s trên Railway, cùng server với app); giữ tham số nhỏ (20).
- Thời gian Redis đo bằng `os.clock()` bên trong hàm (thời gian CPU phía server).
