# Demo Transaction: PostgreSQL và Redis

Nhập kho (UC-02), xuất kho (UC-03) và điều chuyển (UC-04) trên dữ liệu mẫu:

- **PostgreSQL**: BEGIN / COMMIT / ROLLBACK, SAVEPOINT, CHECK constraint, Isolation levels
- **Redis**: MULTI / EXEC / DISCARD, WATCH (optimistic lock), Lua script (atomic operation)

Dữ liệu demo nằm riêng (schema `txn_demo` trên PostgreSQL, database `14` trên Redis), **không ảnh hưởng dữ liệu của app**.

## Các file

| File                    | Loại         | Dùng để                                                       |
| ----------------------- | ------------ | ------------------------------------------------------------- |
| `01_setup_data.sql`     | Nạp dữ liệu | Tạo schema `txn_demo` + bảng + dữ liệu mẫu trên PostgreSQL  |
| `02_demo_postgres.sql`  | **Demo**     | 8 bước demo, mở trong **pgAdmin**                             |
| `03_setup_redis.sh`     | Nạp dữ liệu | Nạp dữ liệu tương đương vào Redis database 14 + Lua functions |
| `redis_functions.lua`   | Code         | Lua functions: nhập/xuất/điều chuyển atomic trên Redis        |
| `04_demo_redis.txt`     | **Demo**     | 10 bước demo, dán vào **Redis Insight > Workbench**           |

## Cách dùng

**1. Nạp dữ liệu** (tại thư mục gốc dự án, container đang chạy: `docker compose up -d`):

```bash
# PostgreSQL
docker exec -i logistic-postgres psql -U logistic_user -d logistic_db < demo/transaction/01_setup_data.sql

# Redis
bash demo/transaction/03_setup_redis.sh
```

Windows PowerShell (PostgreSQL):
```powershell
Get-Content demo/transaction/01_setup_data.sql -Raw -Encoding UTF8 | docker exec -i logistic-postgres psql -U logistic_user -d logistic_db
```

Nạp lên **Railway** (URL lấy từ `.env`):
```bash
set -a; source .env; set +a
docker exec -i logistic-postgres psql "$DATABASE_PUBLIC_URL" < demo/transaction/01_setup_data.sql
REDIS_URL="$REDIS_PUBLIC_URL" bash demo/transaction/03_setup_redis.sh
```

**2. Khi demo:**

- **PostgreSQL**: pgAdmin → Query Tool → mở `02_demo_postgres.sql`. Bôi đen từng STEP, bấm **F5**.
  - STEP 6, 7, 8 cần **mở 2 tab Query Tool** (2 session) để demo isolation level.
- **Redis**: Redis Insight → chọn database **14** → Workbench → dán từng lệnh trong `04_demo_redis.txt`.

**Dọn dẹp:**
```bash
docker exec logistic-postgres psql -U logistic_user -d logistic_db -c "DROP SCHEMA txn_demo CASCADE"
docker exec logistic-redis redis-cli -n 14 FLUSHDB
docker exec logistic-redis redis-cli FUNCTION DELETE txn_demo
```

## Nội dung demo

### PostgreSQL (8 bước)

| Step | Nội dung                                   | Minh họa                                                            |
| ---- | ------------------------------------------ | ------------------------------------------------------------------- |
| 1    | COMMIT — nhập kho thành công               | BEGIN → INSERT + UPDATE → COMMIT: tồn kho tăng, phiếu được lưu     |
| 2    | ROLLBACK — nhập kho thất bại               | BEGIN → INSERT + UPDATE → ROLLBACK: tồn kho và phiếu không thay đổi |
| 3    | SAVEPOINT — rollback một phần              | Giữ lại phần đúng (nhập laptop), hủy phần lỗi (nhập chuột)        |
| 4    | CHECK constraint — ngăn xuất vượt tồn      | `quantity >= 0`: UPDATE trừ 999 → vi phạm constraint → tự hủy      |
| 5    | Xuất kho hoàn chỉnh — nhiều bước 1 TXN    | Tạo phiếu + giữ chỗ + trừ tồn + cập nhật trạng thái               |
| 6    | Read Committed — isolation mặc định        | Session B không thấy thay đổi chưa commit của Session A             |
| 7    | Repeatable Read — chống Phantom Read       | Cùng 1 query trả kết quả giống nhau suốt transaction                |
| 8    | Serializable — phát hiện xung đột ghi      | 2 session cùng đọc-ghi → PostgreSQL abort 1 session                 |

### Redis (10 bước)

| Step | Nội dung                                   | Minh họa                                                            |
| ---- | ------------------------------------------ | ------------------------------------------------------------------- |
| 1    | Xem dữ liệu ban đầu                       | HGETALL các key tồn kho                                             |
| 2    | MULTI/EXEC — batch atomic                  | Nhập kho: HINCRBY + HSET chạy cùng lúc                             |
| 3    | DISCARD — hủy batch chưa chạy              | MULTI → DISCARD: không có gì thay đổi                               |
| 4    | Hạn chế MULTI/EXEC — không kiểm tra được   | Xuất 999 (tồn 70): HINCRBY -999 → tồn kho ÂM!                     |
| 5    | Lua nhập kho — atomic có logic             | FCALL receipt_stock: cộng tồn + ghi phiếu trong 1 lệnh             |
| 6    | Lua xuất kho — có kiểm tra tồn             | FCALL issue_stock: từ chối nếu không đủ tồn                        |
| 7    | Lua điều chuyển — trừ nguồn + cộng đích    | FCALL transfer_stock: atomic trên 2 key                             |
| 8    | WATCH/MULTI — Optimistic locking           | Key bị sửa giữa WATCH và EXEC → giao dịch bị hủy                  |
| 9    | So sánh MULTI vs Lua                       | MULTI trừ bừa → âm; Lua kiểm tra → từ chối                        |
| 10   | Reset dữ liệu                             | FLUSHDB                                                             |

## Bảng so sánh

| Tiêu chí                      | PostgreSQL                                                 | Redis                                                      |
| ------------------------------ | ---------------------------------------------------------- | ---------------------------------------------------------- |
| **Mô hình transaction**       | ACID đầy đủ (Atomicity, Consistency, Isolation, Durability) | Atomic execution (Lua / MULTI), không có ACID đầy đủ       |
| **BEGIN / COMMIT / ROLLBACK** | Có đầy đủ                                                  | MULTI/EXEC/DISCARD (chỉ hủy queue, không rollback đã EXEC) |
| **SAVEPOINT**                 | Có — rollback từng phần trong transaction                   | Không có                                                   |
| **Kiểm tra điều kiện**        | CHECK constraint, trigger tự động                           | Phải tự viết trong Lua script                               |
| **Isolation levels**          | 3 mức: Read Committed, Repeatable Read, Serializable        | Không có — single-threaded nên mọi lệnh đều serializable   |
| **Concurrent transactions**   | Nhiều session song song, có lock + MVCC                     | Single-threaded; đồng thời = queued tuần tự                |
| **Rollback khi lỗi**          | Tự động rollback toàn bộ transaction                        | Lua: trả lỗi nhưng các lệnh đã chạy KHÔNG rollback        |
| **Durability**                | WAL — fsync sau mỗi commit                                 | AOF/RDB — có thể mất vài giây dữ liệu khi crash           |
| **Đọc-kiểm tra-ghi atomic**  | Tự nhiên trong 1 transaction                                | Chỉ được trong Lua script (MULTI/EXEC không đọc giữa chừng)|
| **Độ phức tạp triển khai**    | Thấp — SQL chuẩn                                           | Cao — phải viết Lua, tự quản lý logic nghiệp vụ            |

## Kết luận

**PostgreSQL phù hợp hơn cho hệ thống kho hàng** vì:

1. **ACID đầy đủ**: Nhập/xuất kho cần đảm bảo tính toàn vẹn — nếu 1 bước lỗi, toàn bộ giao dịch phải rollback. PostgreSQL làm điều này tự nhiên với BEGIN/ROLLBACK, trong khi Redis chỉ có DISCARD (hủy queue chưa chạy) và Lua script (không rollback lệnh đã chạy).

2. **Ràng buộc tại tầng DB**: CHECK constraint (`quantity >= 0`) ngăn xuất vượt tồn ở mọi trường hợp, kể cả khi app có bug. Redis không có cơ chế tương đương — phải tự kiểm tra trong Lua.

3. **Isolation levels**: Kho hàng có nhiều người cùng thao tác, cần đảm bảo đọc dữ liệu nhất quán. PostgreSQL có MVCC với 3 mức isolation. Redis single-threaded nên mặc định serializable nhưng không có cơ chế cho nhiều bước đọc-ghi trong 1 "transaction" thực sự.

4. **SAVEPOINT**: Cho phép rollback từng phần — ví dụ nhập kho nhiều mặt hàng, 1 cái lỗi thì chỉ bỏ cái đó, giữ lại các cái đúng. Redis không có khả năng này.

**Redis phù hợp cho**: cache (báo cáo tồn thấp), distributed lock (chống xuất đồng thời ở tầng ứng dụng), và dữ liệu tạm. Trong app WMS này, Redis được dùng đúng vai trò đó: lock key `lock:inventory:*` và cache key `stockReport::*`.
