#!/usr/bin/env bash
# =============================================================================
# NẠP DỮ LIỆU DEMO TRANSACTION VÀO REDIS (database 14)
# Dùng container Docker logistic-redis làm client.
# Chạy tại thư mục gốc dự án: bash demo/transaction/03_setup_redis.sh
# Hoặc nạp lên Railway:  REDIS_URL="$REDIS_PUBLIC_URL" bash demo/transaction/03_setup_redis.sh
# =============================================================================

set -euo pipefail

REDIS_URL="${REDIS_URL:-redis://default@127.0.0.1:6379}"
DB=14

cli() {
    docker exec -i logistic-redis redis-cli -u "$REDIS_URL" -n "$DB" "$@"
}

echo "=== Xóa database $DB ==="
cli FLUSHDB

echo "=== Nạp dữ liệu sản phẩm ==="
cli <<'REDIS'
HSET product:1 sku LAP-001 name "Laptop Dell XPS 15" unit "Cái"
HSET product:2 sku PHN-001 name "Điện thoại Samsung S24" unit "Cái"
HSET product:3 sku MOU-001 name "Chuột Logitech MX Master" unit "Cái"
REDIS

echo "=== Nạp dữ liệu tồn kho ==="
cli <<'REDIS'
HSET inventory:1:1 product_id 1 location_id 1 quantity 50 reserved 0
HSET inventory:2:2 product_id 2 location_id 2 quantity 100 reserved 0
HSET inventory:3:3 product_id 3 location_id 3 quantity 200 reserved 0
REDIS

echo "=== Nạp Lua functions ==="
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cli FUNCTION LOAD REPLACE "$(cat "$SCRIPT_DIR/redis_functions.lua")"

echo "=== Kiểm tra dữ liệu ==="
cli HGETALL inventory:1:1
cli HGETALL inventory:2:2
cli HGETALL inventory:3:3

echo ""
echo "Done. Dữ liệu demo transaction ở Redis database $DB."
echo "Mở Redis Insight → chọn database $DB để xem."
