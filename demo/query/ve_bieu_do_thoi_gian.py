"""Vẽ docs/images/4_3_thoi_gian.png từ số đo demo mục 4.3 (Railway, 26/11/2026, trung vị 3 lần).

Chạy: python3 demo/query/ve_bieu_do_thoi_gian.py   (cần matplotlib)
"""
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt

# PostgreSQL: (nhóm, cách nhanh ms, cách chậm ms)
POSTGRES = [
    ("Nối 1 ngày\nNested Loop | ép Hash", 0.27, 4.85),
    ("Nối cả năm\nHash Join | ép Nested Loop", 15.1, 40.9),
    ("UC-09\nviết lại | câu của app", 47.7, 90.5),
    ("Câu có tham số\ncustom | generic plan", 0.42, 4.47),
]
# UC-08 / UC-09 trên hai hệ: (nhóm, PostgreSQL, Redis bảng gộp, Redis hash viết tay, Redis nested loop ước tính)
COMPARE = [
    ("UC-08 hàng chậm\nluân chuyển", 52.5, 6.4, 144.0, 111942),
    ("UC-09 nhập -\nxuất - tồn", 90.5, 7.6, 295.7, None),
]
OUT = Path(__file__).resolve().parents[2] / "docs" / "images" / "4_3_thoi_gian.png"
FAST, SLOW, PG, HASH, NEST = "#4f81bd", "#c0504d", "#7f7f7f", "#f79646", "#c0504d"


def fmt(v):
    return f"{v:,.0f}".replace(",", ".") if v >= 1000 else f"{v:g}".replace(".", ",")


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
