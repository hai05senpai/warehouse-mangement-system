# Demo chỉ mục: PostgreSQL và Redis (mục 4.2)

Tra cứu tồn kho (UC-06) và cảnh báo tồn thấp (UC-07) trên **100.000 dòng tồn kho**:

- **PostgreSQL**: `EXPLAIN ANALYZE` trước và sau khi tạo chỉ mục.
- **Redis**: duyệt toàn bộ khóa so với chỉ mục tự dựng bằng `SET` / `SORTED SET`.

Dữ liệu demo nằm riêng (schema `idx_demo` trên PostgreSQL, database `15` trên Redis), **không ảnh hưởng dữ liệu của app**.

Chạy được ở 2 nơi, cùng script và cùng các bước:

- **Server host (Railway)**: dùng khi trình bày; dữ liệu đã nạp sẵn, cả nhóm mở pgAdmin / Redis Insight là demo được.
- **Docker trên máy**: tự chạy ở local, hoặc dự phòng khi mất mạng.

## Các file

| File                   | Loại        | Dùng để                                                                               |
| ---------------------- | ----------- | ------------------------------------------------------------------------------------- |
| `01_load_postgres.sql` | Nạp dữ liệu | Tạo schema `idx_demo` + 100.000 dòng, **không có chỉ mục**                            |
| `02_load_redis.sh`     | Nạp dữ liệu | Chép đúng dữ liệu đó sang Redis database 15 + cài các hàm trong `redis_functions.lua` |
| `redis_functions.lua`  | Code        | "Chỉ mục tự dựng" của Redis: quét, xây chỉ mục, truy vấn qua chỉ mục, cập nhật        |
| `03_demo_postgres.sql` | **Demo**    | Các bước demo, mở trong **pgAdmin**                                                   |
| `04_demo_redis.txt`    | **Demo**    | Các bước demo, dán vào **Redis Insight > Workbench**                                  |

## Cách dùng

**1. Trước giờ demo** (tại thư mục gốc dự án, container đang chạy: `docker compose up -d`):

```bash
docker exec -i logistic-postgres psql -U logistic_user -d logistic_db < demo/indexing/01_load_postgres.sql
bash demo/indexing/02_load_redis.sh
```

Windows PowerShell: `Get-Content demo/indexing/01_load_postgres.sql -Raw -Encoding UTF8 | docker exec -i logistic-postgres psql -U logistic_user -d logistic_db`. Script Redis cần bash (Git Bash hoặc WSL).

Chạy lại 2 lệnh này bất cứ lúc nào để đưa dữ liệu demo về trạng thái ban đầu.

Nạp lên **Railway** thay vì Docker (URL lấy từ `.env`; container Docker vẫn cần chạy vì dùng `psql` / `redis-cli` trong đó làm client):

```bash
set -a; source .env; set +a
docker exec -i logistic-postgres psql "$DATABASE_PUBLIC_URL" < demo/indexing/01_load_postgres.sql
PG_URL="$DATABASE_PUBLIC_URL" REDIS_URL="$REDIS_PUBLIC_URL" bash demo/indexing/02_load_redis.sh
```

Sau buổi demo (STEP 7 của Redis có sửa dữ liệu), chạy lại dòng cuối để đưa Redis về ban đầu. PostgreSQL tự về ban đầu ở STEP 2.

**2. Khi demo:**

- **PostgreSQL:** pgAdmin → Query Tool → mở `03_demo_postgres.sql`. Bôi đen từng STEP, bấm **F5** (hoặc **Shift+F7** để xem plan dạng sơ đồ).
  - Railway: host, port, user, password, database lấy từ `DATABASE_PUBLIC_URL` (`postgresql://user:password@host:port/database`).
  - Docker: `localhost`, cổng `5432` (máy này **5433**), database `logistic_db`.
- **Redis:** Redis Insight → Add database → dán URL → Workbench → chạy từng lệnh trong `04_demo_redis.txt`. Mỗi `FCALL` trả về số dòng và thời gian chạy phía server.
  - Railway: dán `REDIS_PUBLIC_URL` rồi thêm `/15` vào cuối.
  - Docker: `redis://default@127.0.0.1:6379/15`.

**Dọn dẹp** (Railway: thay `-U logistic_user -d logistic_db` bằng `"$DATABASE_PUBLIC_URL"`, thêm `-u "$REDIS_PUBLIC_URL"` sau `redis-cli`):

```bash
docker exec logistic-postgres psql -U logistic_user -d logistic_db -c "DROP SCHEMA idx_demo CASCADE"
docker exec logistic-redis redis-cli -n 15 FLUSHDB
docker exec logistic-redis redis-cli FUNCTION DELETE wms_demo
```

## Dữ liệu demo

| Bảng        | Số dòng | Ghi chú                                                                 |
| ----------- | ------- | ----------------------------------------------------------------------- |
| `products`  | 5.000   | 5% có ngưỡng tối thiểu cao, nên có 250 mặt hàng tồn thấp                |
| `locations` | 2.000   | Khu 01–10: 190 vị trí/khu (khu lớn). Khu 11–20: 10 vị trí/khu (khu nhỏ) |
| `inventory` | 100.000 | Mỗi mặt hàng ở 20 vị trí; ~30% dòng đã bị giữ hết (không khả dụng)      |

Khu có kích thước khác nhau có chủ đích, để thấy **khi nào chỉ mục có lợi và khi nào không**.

## Chỉ mục

| Chỉ mục PostgreSQL                             | Loại                                        | Phục vụ                                                                   | Chỉ mục tự dựng trên Redis                               |
| ---------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------- |
| `locations (lower(zone))`                      | B+-tree, chỉ mục biểu thức (function-based) | Lọc theo khu                                                              | `SET idx:zone:{khu}`                                     |
| `inventory (location_id)`                      | B+-tree                                     | Từ vị trí sang các dòng tồn (PostgreSQL không tự đánh chỉ mục khóa ngoại) | (gộp trong `idx:zone`)                                   |
| `products USING gin (lower(sku) gin_trgm_ops)` | GIN trigram                                 | SKU **chứa** chuỗi (`LIKE '%x%'`)                                         | Không có; chỉ duyệt được từ điển SKU `ZSET idx:sku`      |
| `UNIQUE (product_id, location_id)` _(có sẵn)_  | B+-tree nhiều cột                           | Tra theo `product_id` (cột đầu của khóa ghép)                             | `SET idx:product:{id}`                                   |
| _(không có)_                                   |                                             | Tổng tồn dưới ngưỡng                                                      | `ZSET idx:lowstock` (điểm = tổng tồn − ngưỡng, tính sẵn) |

## Kết quả tham khảo (MacBook, Docker; đơn vị ms)

| Truy vấn                     | Số dòng | PG trước |                          PG sau | Redis quét hết |    Redis có chỉ mục |
| ---------------------------- | ------: | -------: | ------------------------------: | -------------: | ------------------: |
| Khu nhỏ `Khu 15` (0,5% bảng) |     500 |       ~8 |                          **~1** |        ~90–150 |                ~1,3 |
| Khu lớn `Khu 05` (9,5% bảng) |   9.503 |      ~20 |              ~18 (vẫn Seq Scan) |            ~90 |                 ~27 |
| SKU chứa `0123`              |     220 |     ~0,8 | **~0,03** (riêng bảng products) |            ~95 |                 ~10 |
| SKU tiền tố `lap-0012`       |      20 |        – |                               – |              – |            **~0,2** |
| Tồn thấp (`SUM`, `HAVING`)   |     250 |      ~20 |                 ~20 (không đổi) |           ~125 |            **~1,5** |
| Xây chỉ mục                  |         |          |                vài ms / chỉ mục |                | ~550 (tự viết code) |

Trên Railway (đo ngày 24/11/2026): khu nhỏ PG 23 → 5 ms, khu lớn ~29 ms (vẫn Seq Scan), SKU chứa 2 → 0,1 ms, tồn thấp ~93 ms; Redis quét hết 115–180 ms, có chỉ mục: khu nhỏ ~1,9, tồn thấp ~1,7, tiền tố ~0,5 ms. Kết luận giống hệt trên Docker.

Số liệu thay đổi theo máy và giữa các lần chạy. Khi trình bày, nhấn vào **loại phép quét** (`Seq Scan` / `Index Scan`) và **số block** (`Buffers`), thời gian chỉ là phụ.
Thời gian Redis đo bằng `os.clock()` bên trong hàm, gồm cả việc lấy đủ các dòng kết quả (`HGETALL`).

## Nhận xét để đưa vào báo cáo

1. **Chỉ mục chỉ có lợi khi điều kiện đủ chọn lọc.** Khu nhỏ (500 dòng) nhanh hơn ~8 lần. Với khu lớn, planner **vẫn chọn Seq Scan**: PostgreSQL lưu bảng dạng heap không sắp xếp, nên mọi chỉ mục đều là _secondary index_ (Chapter 3); 9.500 dòng nằm rải gần hết 834 block, nhảy theo chỉ mục tốn hơn đọc tuần tự. Ở dữ liệu này điểm chuyển khoảng 1% bảng.
2. **Chỉ mục phải khớp biểu thức trong truy vấn** (Chapter 3, function-based index). App lọc `lower(zone)`, nên chỉ mục trên `zone` trơn bị bỏ qua (STEP 7).
3. **`LIKE '%x%'` không dùng được B+-tree**, cần GIN trigram (`pg_trgm`). B+-tree chỉ phục vụ tiền tố `LIKE 'x%'`.
4. **Hash chỉ phục vụ phép `=`**; tìm theo tiền tố hoặc khoảng cần B+-tree (STEP 9).
5. **Truy vấn gộp toàn bảng (UC-07) không được chỉ mục cứu**: `SUM` theo mọi mặt hàng vẫn phải đọc hết bảng. Redis nhanh nhờ **tính sẵn** tổng tồn trong `idx:lowstock`, đổi lại mỗi lần ghi đều phải cập nhật.
6. **PostgreSQL: chỉ mục khai báo một lần**; DBMS tự xây, tự cập nhật trong cùng giao dịch, planner tự quyết định dùng hay không, câu SQL không đổi.
   **Redis: chỉ mục là code của ứng dụng.** Phải tự xây, tự cập nhật (`update_stock` sửa 1 HASH và 3 chỉ mục), và truy vấn phải viết lại để gọi đúng khóa chỉ mục. Mất chỉ mục thì kết quả **sai mà không báo lỗi** (STEP 8), trong khi PostgreSQL chỉ chậm đi. Redis cũng không có chỉ mục "chứa chuỗi" nếu không cài thêm module (RediSearch).

## Lưu ý

- Các hàm Redis dùng `KEYS` để mô phỏng "quét toàn bộ". Lệnh này chặn server, **chỉ dùng cho demo**, không dùng trong app.
- Truy vấn demo viết lại từ `InventoryRepository.search` / `findLowStock` với giá trị cụ thể. App gửi tham số dạng `(:sku = '' OR ...)`; PostgreSQL rút gọn được điều kiện này ở các lần chạy đầu (custom plan), nhưng nếu chuyển sang generic plan thì có thể không dùng chỉ mục. Điểm này thuộc mục 4.3 (xử lý truy vấn).
