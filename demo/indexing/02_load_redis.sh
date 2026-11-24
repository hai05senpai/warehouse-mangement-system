#!/usr/bin/env bash
# =============================================================================
# NẠP DỮ LIỆU DEMO CHỈ MỤC VÀO REDIS (chạy 1 lần trước khi demo, SAU 01_load_postgres.sql)
#   bash demo/indexing/02_load_redis.sh
#
# 1. Xóa database 15 (app dùng database 0, không bị ảnh hưởng).
# 2. Lấy đúng 100.000 dòng từ schema idx_demo của PostgreSQL, nạp vào Redis.
#    KHÔNG xây chỉ mục: việc đó làm trong 04_demo_redis.txt (FCALL build_indexes).
# 3. Cài các hàm demo trong redis_functions.lua (FUNCTION LOAD).
# Chạy lại bất cứ lúc nào để đưa dữ liệu Redis về trạng thái ban đầu.
#
# Mặc định dùng Postgres/Redis trong Docker. Để nạp lên server host (Railway), đặt PG_URL và REDIS_URL:
#   PG_URL="$DATABASE_PUBLIC_URL" REDIS_URL="$REDIS_PUBLIC_URL" bash demo/indexing/02_load_redis.sh
# (container Docker vẫn cần chạy: dùng psql/redis-cli có sẵn trong đó làm client)
# =============================================================================
set -euo pipefail
cd "$(dirname "$0")"

if [ -n "${PG_URL:-}" ]; then PSQL=(docker exec -i logistic-postgres psql "$PG_URL" -qAt)
else PSQL=(docker exec -i logistic-postgres psql -qAt -U logistic_user -d logistic_db); fi
if [ -n "${REDIS_URL:-}" ]; then R() { docker exec -i logistic-redis redis-cli -u "$REDIS_URL" --no-auth-warning -n 15 "$@"; }
else R() { docker exec -i logistic-redis redis-cli -n 15 "$@"; }; fi

R FLUSHDB >/dev/null
"${PSQL[@]}" <<'SQL' | R --pipe
SELECT format('HSET prod:%s sku %s min %s', id, sku, min_quantity) FROM idx_demo.products;
SELECT format('HSET inv:%s product_id %s sku %s location %s zone "%s" qty %s reserved %s',
              i.id, i.product_id, p.sku, l.code, l.zone, i.quantity, i.reserved_quantity)
FROM idx_demo.inventory i JOIN idx_demo.products p ON p.id = i.product_id JOIN idx_demo.locations l ON l.id = i.location_id;
SQL

R -x FUNCTION LOAD REPLACE < redis_functions.lua >/dev/null
echo "Đã nạp $(R DBSIZE) khóa vào Redis database 15 (5.000 prod + 100.000 inv)."
echo "Đã cài hàm: $(R FUNCTION LIST LIBRARYNAME wms_demo | grep -A1 '^name$' | grep -v -e '^name$' -e '^--$' | tr '\n' ' ')"
