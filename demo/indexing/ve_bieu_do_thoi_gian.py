"""Vẽ docs/DBMS_report/Images/4_2_thoi_gian.png từ số liệu ở hai bảng mục 3.2 của report.

Chạy: python3 demo/indexing/ve_bieu_do_thoi_gian.py   (cần matplotlib)
"""
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt

# (truy vấn, trước ms, sau ms) — trung vị 5 lần đo ngày 25/11/2026
POSTGRES = [
    ("Khu nhỏ\n(500 dòng)", 19.8, 4.3),
    ("Khu lớn (*)\n(9.503 dòng)", 42.4, 28.7),
    ("SKU chứa\n'0123'", 2.4, 0.27),
    ("Tồn thấp\n(SUM, HAVING)", 57.7, 60.1),
]
REDIS = [
    ("Khu nhỏ\n(500 dòng)", 97.3, 4.5),
    ("Khu lớn\n(9.503 dòng)", 127.3, 24.8),
    ("SKU chứa\n'0123'", 108.4, 4.0),
    ("Tồn thấp\n(250 dòng)", 184.9, 0.8),
]
OUT = Path(__file__).resolve().parents[2] / "docs" / "DBMS_report" / "Images" / "4_2_thoi_gian.png"


def fmt(v):
    return f"{v:g}".replace(".", ",")


def panel(ax, title, rows, before_label, after_label):
    x = range(len(rows))
    w = 0.38
    b = ax.bar([i - w / 2 for i in x], [r[1] for r in rows], w, label=before_label, color="#c0504d")
    a = ax.bar([i + w / 2 for i in x], [r[2] for r in rows], w, label=after_label, color="#4f81bd")
    for bars in (b, a):
        for bar in bars:
            h = bar.get_height()
            ax.annotate(fmt(h), (bar.get_x() + bar.get_width() / 2, h), ha="center", va="bottom",
                        fontsize=8, xytext=(0, 2), textcoords="offset points")
    ax.set_yscale("log")
    ax.set_ylim(0.1, 1000)
    ax.set_xticks(list(x), [r[0] for r in rows], fontsize=9)
    ax.set_ylabel("Thời gian (ms, thang log)")
    ax.set_title(title, fontsize=11)
    ax.grid(axis="y", which="major", alpha=0.3)
    ax.legend(fontsize=8, loc="upper left")


fig, (left, right) = plt.subplots(1, 2, figsize=(11, 4.6))
panel(left, "PostgreSQL (EXPLAIN ANALYZE)", POSTGRES, "Trước chỉ mục", "Sau chỉ mục")
panel(right, "Redis (thời gian phía server)", REDIS, "Duyệt 100.000 khóa", "Có chỉ mục tự xây")
fig.tight_layout()
fig.savefig(OUT, dpi=200)
print(OUT)
