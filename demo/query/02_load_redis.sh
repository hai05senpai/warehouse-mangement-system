#!/usr/bin/env bash
# =============================================================================
# NẠP DỮ LIỆU DEMO XỬ LÝ TRUY VẤN VÀO REDIS (chạy 1 lần trước khi demo, SAU 01_load_postgres.sql)
#   bash demo/query/02_load_redis.sh
#
# 1. Xóa database 13 (app dùng database 0; demo chỉ mục dùng 15, demo giao dịch dùng 14).
# 2. Chép đúng dữ liệu schema qry_demo của PostgreSQL sang Redis, mỗi dòng một HASH.
#    KHÔNG tạo bảng gộp: việc đó làm trong 04_demo_redis.txt (FCALL q_build_agg).
# 3. Cài các hàm demo trong redis_functions.lua (FUNCTION LOAD).
# Chạy lại bất cứ lúc nào để đưa dữ liệu Redis về trạng thái ban đầu.
#
# Mặc định dùng Postgres/Redis trong Docker. Để nạp lên server host (Railway), đặt PG_URL và REDIS_URL:
#   PG_URL="$DATABASE_PUBLIC_URL" REDIS_URL="$REDIS_PUBLIC_URL" bash demo/query/02_load_redis.sh
# (container Docker vẫn cần chạy: dùng psql/redis-cli có sẵn trong đó làm client)
# =============================================================================
set -euo pipefail
cd "$(dirname "$0")"

if [ -n "${PG_URL:-}" ]; then PSQL=(docker exec -i logistic-postgres psql "$PG_URL" -qAt)
else PSQL=(docker exec -i logistic-postgres psql -qAt -U logistic_user -d logistic_db); fi
if [ -n "${REDIS_URL:-}" ]; then R() { docker exec -i logistic-redis redis-cli -u "$REDIS_URL" --no-auth-warning -n 13 "$@"; }
else R() { docker exec -i logistic-redis redis-cli -n 13 "$@"; }; fi

R FLUSHDB >/dev/null
"${PSQL[@]}" <<'SQL' | R --pipe >/dev/null
SET search_path = qry_demo;
SELECT format('HSET prod:%s sku %s', id, sku) FROM products;
SELECT format('HSET inv:%s product_id %s qty %s', id, product_id, quantity) FROM inventory;
SELECT format('HSET ro:%s status %s ts %s', id, status, extract(epoch FROM receipt_date)::bigint) FROM receipt_orders;
SELECT format('HSET ri:%s order_id %s product_id %s qty %s', id, receipt_order_id, product_id, quantity) FROM receipt_items;
SELECT format('HSET io:%s status %s ts %s', id, status, extract(epoch FROM issue_date)::bigint) FROM issue_orders;
SELECT format('HSET ii:%s order_id %s product_id %s qty %s', id, issue_order_id, product_id, quantity) FROM issue_items;
SELECT format('HSET st:%s status %s ts %s', id, status, extract(epoch FROM stock_take_date)::bigint) FROM stock_takes;
SELECT format('HSET si:%s take_id %s product_id %s diff %s', id, stock_take_id, product_id, actual_qty - system_qty)
FROM stock_take_items;
SQL

R -x FUNCTION LOAD REPLACE < redis_functions.lua >/dev/null
echo "Đã nạp $(R DBSIZE) khóa vào Redis database 13."
