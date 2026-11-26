"""Vẽ biểu đồ demo lưu trữ (mục 3.1) từ demo/storage/results.json.

Chạy: python3 demo/storage/ve_bieu_do.py   (cần matplotlib)
Ghi đè docs/DBMS_report/Images/demo_3_1_plot.png.
"""
import json
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt

ROOT = Path(__file__).resolve().parents[2]
d = json.loads((Path(__file__).parent / "results.json").read_text())
OUT = ROOT / "docs" / "DBMS_report" / "Images" / "demo_3_1_plot.png"
kb = lambda b: b / 1024


def fmt(v):
    s = f"{v:,.1f}" if v >= 10 else (f"{v:.2f}" if v >= 0.1 else f"{v:.3f}")
    return s.replace(",", "X").replace(".", ",").replace("X", ".")


def label(ax, bars):
    for b in bars:
        ax.annotate(fmt(b.get_height()), (b.get_x() + b.get_width() / 2, b.get_height()), ha="center",
                    va="bottom", fontsize=8, xytext=(0, 2), textcoords="offset points")


p1, p10, pb = d["pg_one"], d["pg_10k"], d["pg_after_50k"]
groups = ["1 bản ghi", "10.000 bản ghi", "Sau 50.000 lượt ghi đè"]
heap = [kb(p1["heap_bytes"]), kb(p10["heap_bytes"]), kb(pb["heap_bytes"])]
total = [kb(p1["heap_bytes"] + p1["index_bytes"]), kb(p10["heap_bytes"] + p10["index_bytes"]), kb(pb["total_bytes"])]
red = [d["redis_one"]["memory_usage"] / 1024, kb(d["redis_10k"]["used_memory_delta"]),
       kb(d["redis_after_50k"]["used_memory_db_total_delta"])]

s = d["speed_ms_per_1000"]  # ms cho 1.000 lệnh = µs mỗi lệnh
ops = ["Đọc 1 dòng\n(SELECT | HGETALL)", "Ghi 1 dòng\n(UPDATE | HSET)"]

fig, (left, right) = plt.subplots(1, 2, figsize=(12, 4.6))
x = range(3)
w = 0.27
label(left, left.bar([i - w for i in x], heap, w, color="#4f81bd", label="PostgreSQL (heap)"))
label(left, left.bar(list(x), total, w, color="#2c4d75", label="PostgreSQL (heap + chỉ mục)"))
label(left, left.bar([i + w for i in x], red, w, color="#f79646", label="Redis (HASH trong RAM)"))
left.set_xticks(list(x), groups, fontsize=9)
left.set_yscale("log")
left.set_ylim(0.05, 3e4)
left.set_ylabel("Dung lượng (KB, thang log)")
left.set_title("Dung lượng lưu trữ", fontsize=11)

x = range(2)
w = 0.27
label(right, right.bar([-w, 1 - w], [s["pg_read"], s["pg_write"]], w, color="#4f81bd",
                       label="PostgreSQL (mỗi lệnh ghi commit riêng)"))
label(right, right.bar([1], [s["pg_write_one_tx"]], w, color="#2c4d75", label="PostgreSQL (1.000 lệnh ghi trong 1 giao dịch)"))
label(right, right.bar([0 + w, 1 + w], [s["redis_read"], s["redis_write"]], w, color="#f79646", label="Redis"))
right.set_xticks(list(x), ops, fontsize=9)
right.set_yscale("log")
right.set_ylim(0.1, 1e4)
right.set_ylabel("Thời gian mỗi lệnh phía server (µs, thang log)")
right.set_title("Tốc độ đọc và ghi một dòng tồn kho", fontsize=11)

for ax in (left, right):
    ax.grid(axis="y", which="major", alpha=0.3)
    ax.legend(fontsize=7.5, loc="upper left")
fig.tight_layout()
fig.savefig(OUT, dpi=200)
print(OUT)
