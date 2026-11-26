"""Đo số liệu cho demo lưu trữ (mục 3.1) trên PostgreSQL và Redis đã host.

Chạy tại thư mục gốc dự án (cần psycopg 3 và redis-py):
    set -a; source .env; set +a
    python3 demo/storage/02_measure.py load      # nạp dữ liệu, đo dung lượng, MVCC 500 lần, tốc độ
    python3 demo/storage/02_measure.py bloat     # 50.000 lượt cập nhật -> để lại bản ghi chết (chụp pgAdmin)
    python3 demo/storage/02_measure.py clean     # sau khi chạy VACUUM FULL trong pgAdmin: đo lại

Kết quả ghi vào demo/storage/results.json.
Thời gian đọc/ghi đo phía server (vòng lặp chạy trong server), không gồm thời gian mạng.
"""
import json
import os
import statistics
import sys
from pathlib import Path

import psycopg
import redis

HERE = Path(__file__).resolve().parent
OUT = HERE / "results.json"
PG_URL = os.environ["DATABASE_PUBLIC_URL"]
R = redis.Redis.from_url(os.environ["REDIS_PUBLIC_URL"], db=12, decode_responses=True)


def results():
    return json.loads(OUT.read_text()) if OUT.exists() else {}


def save(data):
    OUT.write_text(json.dumps(data, indent=2, ensure_ascii=False))
    print(json.dumps(data, indent=2, ensure_ascii=False))


def pg():
    return psycopg.connect(PG_URL, autocommit=True)


def stats(c, table="storage_demo.inventory"):
    c.execute("SELECT pg_stat_force_next_flush()")
    row = c.execute(f"""
        SELECT pg_relation_size('{table}') AS heap, pg_indexes_size('{table}') AS idx,
               pg_total_relation_size('{table}') AS total,
               (SELECT n_dead_tup FROM pg_stat_user_tables WHERE relid = '{table}'::regclass) AS dead,
               (SELECT count(*) FROM {table}) AS live""").fetchone()
    return dict(zip(["heap_bytes", "index_bytes", "total_bytes", "dead_tuples", "live_rows"], row))


def used_memory():
    return R.info("memory")["used_memory"]


def pg_timing(c, sql_loop):
    notes = []
    handler = lambda d: notes.append(d.message_primary)
    c.add_notice_handler(handler)
    c.execute(sql_loop)
    c.remove_notice_handler(handler)
    return float(notes[-1])


READ_LOOP = """
DO $$
DECLARE t0 timestamptz; r record;
BEGIN
  t0 := clock_timestamp();
  FOR i IN 1..1000 LOOP
    SELECT * INTO r FROM storage_demo.inventory WHERE product_id = 1 AND location_id = 1;
  END LOOP;
  RAISE NOTICE '%', extract(epoch FROM clock_timestamp() - t0) * 1000;
END $$;"""

# Mỗi UPDATE commit riêng (ghi WAL và chờ fsync như một giao dịch thật của ứng dụng)
WRITE_LOOP = """
DO $$
DECLARE t0 timestamptz;
BEGIN
  t0 := clock_timestamp();
  FOR i IN 1..1000 LOOP
    UPDATE storage_demo.inventory SET quantity = 100 + i % 50, updated_at = now()
    WHERE product_id = 1 AND location_id = 1;
    COMMIT;
  END LOOP;
  RAISE NOTICE '%', extract(epoch FROM clock_timestamp() - t0) * 1000;
END $$;"""

# Cùng 1.000 UPDATE nhưng trong một giao dịch: chỉ commit (và chờ fsync) một lần ở cuối
WRITE_LOOP_ONE_TX = WRITE_LOOP.replace("    COMMIT;\n", "")


def load():
    data = {}
    sql = (HERE / "01_load_postgres.sql").read_text()
    sql = "\n".join(l for l in sql.splitlines() if not l.startswith("\\"))
    with pg() as c:
        for stmt in sql.split(";\n"):  # từng lệnh riêng: VACUUM không chạy được trong khối giao dịch
            if stmt.strip() and not all(l.strip().startswith("--") or not l.strip() for l in stmt.splitlines()):
                c.execute(stmt)
        c.execute("ALTER TABLE storage_demo.inventory SET (autovacuum_enabled = false)")
        one = c.execute("""SELECT pg_column_size(t.*) FROM storage_demo.inventory_one t""").fetchone()[0]
        data["pg_one"] = {"row_bytes": one,
                          "heap_bytes": c.execute("SELECT pg_relation_size('storage_demo.inventory_one')").fetchone()[0],
                          "index_bytes": c.execute("SELECT pg_indexes_size('storage_demo.inventory_one')").fetchone()[0]}
        data["pg_10k"] = stats(c)

    R.flushdb()
    R.function_load((HERE / "redis_functions.lua").read_text(), replace=True)
    before = used_memory()
    pipe = R.pipeline(transaction=False)
    for g in range(10000):
        p, l = g // 10 + 1, g % 10 + 1
        pipe.hset(f"inv:{p}:{l}", mapping={"product_id": p, "location_id": l, "quantity": 100,
                                           "reserved_quantity": 0, "updated_at": "2026-11-26T10:00:00Z"})
    pipe.execute()
    data["redis_one"] = {"memory_usage": R.memory_usage("inv:1:1"), "encoding": R.object("encoding", "inv:1:1")}
    data["redis_10k"] = {"used_memory_delta": used_memory() - before, "keys": R.dbsize()}

    # MVCC: 500 UPDATE liên tiếp trên dòng id = 1
    with pg() as c:
        ctid0 = c.execute("SELECT ctid::text FROM storage_demo.inventory WHERE id = 1").fetchone()[0]
        pages0 = stats(c)["heap_bytes"] // 8192
        for i in range(500):
            c.execute("UPDATE storage_demo.inventory SET quantity = %s, updated_at = now() WHERE id = 1", (100 + i,))
        ctid1 = c.execute("SELECT ctid::text FROM storage_demo.inventory WHERE id = 1").fetchone()[0]
        s1 = stats(c)
        c.execute("VACUUM storage_demo.inventory")
        s2 = stats(c)
        data["mvcc_500"] = {"ctid_before": ctid0, "ctid_after": ctid1, "pages_before": pages0,
                            "pages_after": s1["heap_bytes"] // 8192, "dead_after": s1["dead_tuples"],
                            "dead_after_vacuum": s2["dead_tuples"], "pages_after_vacuum": s2["heap_bytes"] // 8192}
        # Đưa bảng về sạch trước khi đo tốc độ
        c.execute("VACUUM FULL storage_demo.inventory")

    # Tốc độ: 3 lần, lấy trung vị, đo phía server
    reads, writes, writes1, rr, rw = [], [], [], [], []
    for _ in range(3):
        with pg() as c:
            reads.append(pg_timing(c, READ_LOOP))
            writes.append(pg_timing(c, WRITE_LOOP))
            writes1.append(pg_timing(c, WRITE_LOOP_ONE_TX))
        rr.append(float(R.fcall("s_bench_read", 0, 1000)[1].split()[0]))
        rw.append(float(R.fcall("s_bench_write", 0, 1000)[1].split()[0]))
    with pg() as c:
        c.execute("VACUUM FULL storage_demo.inventory")
        data["pg_10k_clean"] = stats(c)
    med = statistics.median
    data["speed_ms_per_1000"] = {"pg_read": med(reads), "pg_write": med(writes), "pg_write_one_tx": med(writes1),
                                 "redis_read": med(rr), "redis_write": med(rw),
                                 "raw": {"pg_read": reads, "pg_write": writes, "pg_write_one_tx": writes1, "redis_read": rr, "redis_write": rw}}
    save(data)


def bloat():
    data = results()
    with pg() as c:
        for _ in range(5):  # 5 x 10.000 dòng = 50.000 lượt cập nhật
            c.execute("UPDATE storage_demo.inventory SET quantity = quantity + 1, updated_at = now()")
        data["pg_after_50k"] = stats(c)
    before = used_memory()
    R.fcall("s_overwrite", 0, 50000)
    data["redis_after_50k"] = {"used_memory_delta_vs_before_overwrite": used_memory() - before,
                               "memory_usage_inv_1_1": R.memory_usage("inv:1:1"),
                               "used_memory_db_total_delta": data["redis_10k"]["used_memory_delta"]
                               + used_memory() - before}
    save(data)


def clean():
    data = results()
    with pg() as c:
        data["pg_after_vacuum_full"] = stats(c)
    save(data)


if __name__ == "__main__":
    {"load": load, "bloat": bloat, "clean": clean}[sys.argv[1]]()
