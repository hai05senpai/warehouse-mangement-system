"""Vẽ docs/DBMS_report/Images/4_3_thoi_gian.png từ demo/query/results.json (mục 3.3).

Chạy: python3 demo/query/ve_bieu_do_thoi_gian.py   (cần matplotlib)
"""
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt

import json

D = json.loads((Path(__file__).parent / "results.json").read_text())  # tạo bằng 05_measure.py
P, R = D["postgres_ms"], D["redis_ms"]
# PostgreSQL: (nhóm, cách nhanh ms, cách chậm ms)
POSTGRES = [
    ("Nối 1 ngày\nNested Loop | ép Hash", P["join_1day"], P["forced_hash_1day"]),
    ("Nối cả năm\nHash Join | ép Nested Loop", P["join_year"], P["forced_nested_year"]),
    ("UC-09\nviết lại | câu của app", P["uc09_rewrite"], P["uc09_app"]),
    ("Câu có tham số\ncustom | generic plan", P["param_custom"], P["param_generic"]),
]
# UC-08 / UC-09 trên hai hệ: (nhóm, PostgreSQL, Redis bảng gộp, Redis hash viết tay, Redis nested loop ước tính)
COMPARE = [
    ("UC-08 hàng chậm\nluân chuyển", P["uc08"], R["stagnant_agg"], R["stagnant_scan"], R["stagnant_nested_est_5000"]),
    ("UC-09 nhập -\nxuất - tồn", P["uc09_app"], R["inout_agg"], R["inout_scan"], None),
]
OUT = Path(__file__).resolve().parents[2] / "docs" / "DBMS_report" / "Images" / "4_3_thoi_gian.png"
FAST, SLOW, PG, HASH, NEST = "#4f81bd", "#c0504d", "#7f7f7f", "#f79646", "#c0504d"


def fmt(v):
    s = f"{v:,.0f}" if v >= 1000 else (f"{v:.1f}" if v >= 1 else f"{v:.2f}")
    return s.replace(",", "X").replace(".", ",").replace("X", ".")


def label(ax, bars):
    for bar in bars:
        h = bar.get_height()
        if h > 0:
            ax.annotate(fmt(h), (bar.get_x() + bar.get_width() / 2, h), ha="center", va="bottom",
                        fontsize=8, xytext=(0, 2), textcoords="offset points")


fig, (left, right) = plt.subplots(1, 2, figsize=(12, 4.8), gridspec_kw={"width_ratios": [1.35, 1]})

x = range(len(POSTGRES))
w = 0.38
label(left, left.bar([i - w / 2 for i in x], [r[1] for r in POSTGRES], w, color=FAST, label="Cách nhanh (bộ tối ưu chọn / viết lại)"))
label(left, left.bar([i + w / 2 for i in x], [r[2] for r in POSTGRES], w, color=SLOW, label="Cách chậm (bị ép / câu gốc / generic)"))
left.set_xticks(list(x), [r[0] for r in POSTGRES], fontsize=8)
left.set_title("PostgreSQL: cùng kết quả, kế hoạch khác nhau", fontsize=11)

x = range(len(COMPARE))
w = 0.2
series = [(1, PG, "PostgreSQL (câu của app)"), (2, FAST, "Redis: bảng gộp tính sẵn"),
          (3, HASH, "Redis: hash join viết tay"), (4, NEST, "Redis: nested loop viết tay (ước tính)")]
for j, (col, color, name) in enumerate(series):
    xs = [i + (j - 1.5) * w for i in x]
    label(right, right.bar(xs, [r[col] or 0 for r in COMPARE], w, color=color, label=name))
right.set_xticks(list(x), [r[0] for r in COMPARE], fontsize=9)
right.set_title("Hai báo cáo trên PostgreSQL và Redis", fontsize=11)

for ax, top, where in ((left, 1e3, "upper left"), (right, 1e7, "upper right")):
    ax.set_yscale("log")
    ax.set_ylim(0.1, top)
    ax.set_ylabel("Thời gian (ms, thang log)")
    ax.grid(axis="y", which="major", alpha=0.3)
    ax.legend(fontsize=7.5, loc=where)

fig.tight_layout()
fig.savefig(OUT, dpi=200)
print(OUT)
