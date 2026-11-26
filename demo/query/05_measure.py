"""Đo số liệu cho demo xử lý truy vấn (mục 3.3) trên PostgreSQL và Redis đã host.

Chạy tại thư mục gốc dự án (cần psycopg 3 và redis-py), sau khi đã nạp dữ liệu demo:
    set -a; source .env; set +a
    python3 demo/query/05_measure.py

Cách đo giống mục 3.2: mỗi phép đo chạy 6 lần, bỏ lần đầu, lấy trung vị.
PostgreSQL: chạy lần lượt mọi câu trong 03_demo_postgres.sql, lấy "Execution Time" của từng EXPLAIN ANALYZE.
Redis: thời gian phía server do chính các hàm Lua trả về. Kết quả ghi vào demo/query/results.json.
"""
import json
import os
import re
import statistics
from pathlib import Path

import psycopg
import redis

HERE = Path(__file__).resolve().parent
RUNS = 6
LABELS = ["uc08", "join_1day", "join_year", "join_merge", "forced_hash_1day", "forced_nested_year",
          "uc09_app", "uc09_rewrite", "param_custom", "param_generic"]


def statements():
    sql = "\n".join(l for l in (HERE / "03_demo_postgres.sql").read_text().splitlines()
                    if not l.lstrip().startswith("--"))
    return [s.strip() for s in sql.split(";") if s.strip()]


def pg_run():
    times, buffers = [], []
    with psycopg.connect(os.environ["DATABASE_PUBLIC_URL"], autocommit=True) as c:
        for stmt in statements():
            rows = c.execute(stmt).fetchall() if stmt.upper().startswith(("EXPLAIN", "SELECT")) else c.execute(stmt)
            if not stmt.upper().startswith("EXPLAIN"):
                continue
            plan = "\n".join(r[0] for r in rows)
            m = re.search(r"Execution Time: ([\d.]+) ms", plan)
            if m:
                times.append(float(m.group(1)))
                b = re.search(r"Buffers: shared hit=(\d+)", plan)
                buffers.append(int(b.group(1)) if b else None)
    assert len(times) == len(LABELS), times
    return dict(zip(LABELS, times)), dict(zip(LABELS, buffers))


def ms(reply):
    return float(reply[1].split()[0])


def redis_run(r):
    r.fcall("q_drop_agg", 0)
    out = {"stagnant_scan": ms(r.fcall("q_stagnant_scan", 0, 1787788800))}
    nested = r.fcall("q_stagnant_nested", 0, 1787788800, 20)
    out["stagnant_nested_20"] = ms(nested)
    out["stagnant_nested_est_5000"] = out["stagnant_nested_20"] * 5000 / 20
    out["inout_scan"] = ms(r.fcall("q_inout_scan", 0, 1790812800, 1793491200))
    out["build_agg"] = ms(r.fcall("q_build_agg", 0))
    out["stagnant_agg"] = ms(r.fcall("q_stagnant_agg", 0, 1787788800))
    out["inout_agg"] = ms(r.fcall("q_inout_agg", 0, 1790812800, 1793491200))
    r.fcall("q_drop_agg", 0)
    return out


def median_drop_first(runs):
    keys = runs[0].keys()
    return {k: statistics.median([run[k] for run in runs[1:]]) for k in keys}


if __name__ == "__main__":
    pg_runs, pg_buf = [], None
    for _ in range(RUNS):
        t, pg_buf = pg_run()
        pg_runs.append(t)
    r = redis.Redis.from_url(os.environ["REDIS_PUBLIC_URL"], db=13, decode_responses=True)
    redis_runs = [redis_run(r) for _ in range(RUNS)]
    result = {"method": f"{RUNS} lan, bo lan dau, lay trung vi",
              "postgres_ms": median_drop_first(pg_runs), "postgres_buffers": pg_buf,
              "redis_ms": median_drop_first(redis_runs),
              "raw": {"postgres": pg_runs, "redis": redis_runs}}
    (HERE / "results.json").write_text(json.dumps(result, indent=2, ensure_ascii=False))
    print(json.dumps({k: result[k] for k in ("postgres_ms", "postgres_buffers", "redis_ms")}, indent=2))
