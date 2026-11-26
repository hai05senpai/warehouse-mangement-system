#!lua name=storage_demo
-- =============================================================================
-- DEMO LƯU TRỮ (mục 3.1) TRÊN REDIS. 02_load_redis.py nạp file này bằng FUNCTION LOAD.
-- Dữ liệu: inv:{product_id}:{location_id}  HASH {product_id, location_id, quantity,
--          reserved_quantity, updated_at}  (database 12)
-- Thời gian đo bằng os.clock() bên trong hàm, tức thời gian phía server, không gồm mạng.
-- =============================================================================

local function now_us() return os.clock() * 1000000 end

-- Đọc n lần dòng inv:1:1 bằng HGETALL. Trả {số lệnh, tổng ms, µs trung bình mỗi lệnh}
redis.register_function{function_name = 's_bench_read', flags = {'no-writes'}, callback = function(_, args)
  local n, t0 = tonumber(args[1]), now_us()
  for _ = 1, n do redis.call('HGETALL', 'inv:1:1') end
  local us = now_us() - t0
  return { n, string.format('%.3f ms', us / 1000), string.format('%.2f us/lenh', us / n) }
end}

-- Ghi n lần trường quantity của dòng inv:1:1 bằng HSET (ghi đè tại chỗ)
redis.register_function('s_bench_write', function(_, args)
  local n, t0 = tonumber(args[1]), now_us()
  for i = 1, n do redis.call('HSET', 'inv:1:1', 'quantity', 100 + i % 50) end
  local us = now_us() - t0
  return { n, string.format('%.3f ms', us / 1000), string.format('%.2f us/lenh', us / n) }
end)

-- Ghi đè n lượt rải đều trên 10.000 khóa (giống 50.000 lượt UPDATE bên PostgreSQL)
redis.register_function('s_overwrite', function(_, args)
  local n, t0 = tonumber(args[1]), now_us()
  for i = 0, n - 1 do
    local g = i % 10000
    redis.call('HSET', 'inv:' .. (math.floor(g / 10) + 1) .. ':' .. (g % 10 + 1), 'quantity', 100 + i % 97)
  end
  return { n, string.format('%.3f ms', (now_us() - t0) / 1000) }
end)
