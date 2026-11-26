# Demo lưu trữ và quản lý dữ liệu: PostgreSQL và Redis (mục 3.1)

Cùng một bảng tồn kho 10.000 dòng (1.000 mặt hàng × 10 vị trí, đủ 6 cột và hai ràng buộc như bảng `inventory` của app) được lưu trên hai hệ:

- **PostgreSQL**: bảng heap theo trang 8 KB. Đo dung lượng 1 dòng và 10.000 dòng, hành vi MVCC khi cập nhật (bản ghi chết, cập nhật HOT), `VACUUM` / `VACUUM FULL`.
- **Redis**: mỗi dòng là một HASH `inv:{product_id}:{location_id}`. Đo RAM mỗi khóa (mã hóa `listpack`) và việc ghi đè tại chỗ.
- **Cả hai**: thời gian đọc và ghi một dòng, đo **phía server** (vòng lặp chạy ngay trong PostgreSQL / trong hàm Lua) để thời gian mạng tới máy chủ không lấn át kết quả.

Dữ liệu demo nằm riêng (schema `storage_demo` trên PostgreSQL, database `12` trên Redis), **không ảnh hưởng dữ liệu của app**.

## Các file

| File                   | Loại        | Dùng để                                                                                   |
| ---------------------- | ----------- | ----------------------------------------------------------------------------------------- |
| `01_load_postgres.sql` | Nạp dữ liệu | Tạo schema `storage_demo`: bảng 1 dòng `inventory_one` và bảng 10.000 dòng `inventory`    |
| `redis_functions.lua`  | Code        | Hàm Lua `s_bench_read`, `s_bench_write` (đo đọc/ghi phía server), `s_overwrite` (ghi đè) |
| `02_measure.py`        | Nạp + đo    | `reset`: nạp lại cả hai hệ; `load` / `bloat` / `clean`: đo toàn bộ → `results.json`       |
| `03_demo_postgres.sql` | **Demo**    | 7 bước demo, mở trong **pgAdmin**                                                          |
| `04_demo_redis.txt`    | **Demo**    | 5 bước demo, dán vào **Redis Insight > Workbench**                                         |
| `ve_bieu_do.py`        | Biểu đồ     | Vẽ `docs/DBMS_report/Images/demo_3_1_plot.png` từ `results.json`                          |
| `results.json`         | Kết quả     | Số đo dùng trong report                                                                    |
| `kich_ban_video.md`    | **Video**   | Kịch bản quay video demo: chuẩn bị, từng cảnh, lời thoại, kết quả mong đợi                |

## Cách dùng

Khác với các demo khác, demo này dùng client Python (không cần `psql` / `redis-cli` trong Docker). Cài một lần:

```bash
python3 -m pip install "psycopg[binary]" redis matplotlib
```

Script đọc hai biến `DATABASE_PUBLIC_URL` và `REDIS_PUBLIC_URL` từ `.env` (URL của PostgreSQL và Redis đã host). Muốn chạy trên Docker cục bộ thì đặt hai biến này trỏ về `postgresql://logistic_user:logistic_password@localhost:5432/logistic_db` và `redis://localhost:6379`.

**1. Trước giờ demo** (tại thư mục gốc dự án): nạp lại dữ liệu về trạng thái ban đầu.

```bash
set -a; source .env; set +a
python3 demo/storage/02_measure.py reset
```

**2. Khi demo:**

- **PostgreSQL:** pgAdmin → Query Tool → mở `03_demo_postgres.sql`. Bôi đen từng STEP, bấm **F5**. pgAdmin chỉ hiện kết quả của câu **cuối** trong vùng bôi đen, nên ở STEP 4–6 chạy từng câu một. Thời gian ở STEP 7 hiện trong tab **Messages**.
- **Redis:** Redis Insight → mở kết nối → bút chì cạnh `db0` → đổi thành **12** → Workbench → chạy từng lệnh trong `04_demo_redis.txt`.

Các bước demo làm thay đổi dữ liệu (cập nhật 500 lần, 50.000 lượt ghi), nên muốn demo lại thì chạy lại lệnh `reset`.

**3. Đo lại số liệu cho report** (chạy lần lượt; giữa `bloat` và `clean` là lúc chụp pgAdmin trước và sau `VACUUM FULL`):

```bash
python3 demo/storage/02_measure.py load    # nạp lại, đo dung lượng, MVCC 500 lần, tốc độ (3 lần, lấy trung vị)
python3 demo/storage/02_measure.py bloat   # 50.000 lượt cập nhật -> bảng phình
python3 demo/storage/02_measure.py clean   # sau khi chạy VACUUM FULL: đo lại
python3 demo/storage/ve_bieu_do.py         # vẽ lại biểu đồ
```

**Dọn dẹp** (chạy bằng pgAdmin / Redis Insight, hoặc `psql` / `redis-cli`):

```sql
DROP SCHEMA storage_demo CASCADE;
```

```text
SELECT 12
FLUSHDB
FUNCTION DELETE storage_demo
```

## Kết quả tham khảo (máy chủ host, PostgreSQL 18.7 / Redis 8.2)

| Chỉ số                                  | PostgreSQL                                   | Redis                          |
| --------------------------------------- | -------------------------------------------- | ------------------------------ |
| 1 bản ghi                               | 64 byte; cấp tối thiểu 8 KB heap + 32 KB chỉ mục | 144 byte (`listpack`)          |
| 10.000 bản ghi                          | 672 KB heap (84 trang, 68,8 byte/dòng) + 568 KB chỉ mục | 1.577,7 KB RAM (161,6 byte/khóa) |
| 500 lần cập nhật một dòng               | `ctid` (0,1) → (83,70), vẫn 84 trang, 30 bản ghi chết (nhờ cập nhật HOT) | — |
| 50.000 lượt cập nhật / ghi đè           | 497 trang heap, ~50.000 bản ghi chết; `VACUUM FULL` → 84 trang | Mỗi khóa vẫn 144 byte |
| Đọc 1 dòng (µs mỗi lệnh, phía server)   | 10,4                                         | 1,72                           |
| Ghi 1 dòng, mỗi lệnh commit riêng       | 666,3                                        | —                              |
| Ghi 1 dòng, 1.000 lệnh trong 1 giao dịch | 27,4                                        | 0,35                           |

Thời gian thay đổi giữa các lần chạy; dung lượng và số trang thì ổn định.

## Nhận xét để đưa vào báo cáo

1. **Ở quy mô nhỏ Redis gọn hơn, ở quy mô lớn PostgreSQL gọn hơn.** Một dòng PostgreSQL vẫn tốn nguyên trang 8 KB, nhưng 10.000 dòng chỉ còn 68,8 byte/dòng, ít hơn 161,6 byte/khóa của Redis (Redis phải lưu tên khóa và phần quản lý bảng băm cho từng khóa).
2. **MVCC để lại bản ghi chết, nhưng cập nhật HOT dọn được phần lớn khi trang còn chỗ.** Cập nhật cả bảng nhiều lần thì bảng phình gấp khoảng 6 lần và cần `VACUUM` / `VACUUM FULL`. Redis ghi đè tại chỗ nên không phình.
3. **Phần lớn thời gian ghi của PostgreSQL là chờ ghi WAL xuống đĩa khi commit** (666,3 so với 27,4 µs). Redis trên máy chủ demo không bật AOF nên lệnh ghi không phải chờ đĩa.

## Lưu ý

- Redis trên máy chủ host không bật AOF (chỉ RDB); Redis của app chạy bằng Docker Compose thì bật AOF `everysec`.
- `02_measure.py load` tắt `autovacuum` của bảng demo để số bản ghi chết không bị dọn giữa chừng khi đo.
