#!lua name=wms_demo
-- =============================================================================
-- "CHỈ MỤC TỰ DỰNG" TRÊN REDIS. Redis không có CREATE INDEX, nên toàn bộ phần dưới đây
-- là code lập trình viên phải tự viết. 02_load_redis.sh nạp file này bằng FUNCTION LOAD.
-- Gọi trong Redis Insight / redis-cli:  FCALL <tên hàm> 0 [tham số...]
-- Mỗi hàm trả về {số dòng, thời gian chạy phía server}.
--
-- Dữ liệu:  inv:{id}  HASH {product_id, sku, location, zone, qty, reserved}
--           prod:{id} HASH {sku, min}
-- Chỉ mục:  idx:zone:{khu}   SET   id dòng tồn thuộc khu       ~ secondary index trên cột không khóa
--           idx:product:{id} SET   id dòng tồn của mặt hàng    ~ chỉ mục khóa ngoại
--           idx:available    SET   id dòng tồn còn khả dụng
--           idx:sku          ZSET  "sku|product_id" score 0    ~ danh sách có thứ tự, tra tiền tố bằng ZRANGEBYLEX
--           idx:lowstock     ZSET  product_id, score = tổng tồn - ngưỡng (giá trị gộp tính sẵn)
-- =============================================================================

-- os.clock(): thời gian CPU của server (TIME bị "đóng băng" trong suốt một lần chạy hàm từ Redis 7)
local function now_us() return os.clock() * 1000000 end

local function result(n, t0)
  return { n, string.format('%.3f ms', (now_us() - t0) / 1000) }
end

-- ---------------------------------------------------------------------------
-- KHÔNG CÓ CHỈ MỤC: chỉ còn cách duyệt toàn bộ 100.000 khóa (giống Seq Scan)
-- ---------------------------------------------------------------------------
redis.register_function('scan_zone', function(_, args)
  local t0, n = now_us(), 0
  for _, k in ipairs(redis.call('KEYS', 'inv:*')) do
    if string.lower(redis.call('HGET', k, 'zone')) == args[1] then
      redis.call('HGETALL', k); n = n + 1
    end
  end
  return result(n, t0)
end)

redis.register_function('scan_sku', function(_, args)
  local t0, n = now_us(), 0
  for _, k in ipairs(redis.call('KEYS', 'inv:*')) do
    if string.find(string.lower(redis.call('HGET', k, 'sku')), args[1], 1, true) then
      redis.call('HGETALL', k); n = n + 1
    end
  end
  return result(n, t0)
end)

redis.register_function('scan_lowstock', function()
  local t0, total, n = now_us(), {}, 0
  for _, k in ipairs(redis.call('KEYS', 'inv:*')) do
    local r = redis.call('HMGET', k, 'product_id', 'qty')
    total[r[1]] = (total[r[1]] or 0) + tonumber(r[2])
  end
  for _, k in ipairs(redis.call('KEYS', 'prod:*')) do
    if (total[string.sub(k, 6)] or 0) < tonumber(redis.call('HGET', k, 'min')) then n = n + 1 end
  end
  return result(n, t0)
end)

-- ---------------------------------------------------------------------------
-- TỰ XÂY / XÓA CHỈ MỤC (tương đương CREATE INDEX / DROP INDEX)
-- ---------------------------------------------------------------------------
local function drop_all()
  local n = 0
  for _, k in ipairs(redis.call('KEYS', 'idx:*')) do redis.call('DEL', k); n = n + 1 end
  for _, k in ipairs(redis.call('KEYS', 'prod:*')) do redis.call('HDEL', k, 'total') end
  return n
end

redis.register_function('drop_indexes', function()
  local t0 = now_us()
  return result(drop_all(), t0)
end)

redis.register_function('build_indexes', function()
  local t0 = now_us()
  drop_all()  -- dựng lại từ đầu, tránh cộng dồn tổng tồn khi chạy nhiều lần
  for _, k in ipairs(redis.call('KEYS', 'inv:*')) do
    local id = string.sub(k, 5)
    local r = redis.call('HMGET', k, 'product_id', 'zone', 'qty', 'reserved')
    redis.call('SADD', 'idx:zone:' .. string.lower(r[2]), id)
    redis.call('SADD', 'idx:product:' .. r[1], id)
    if tonumber(r[3]) > tonumber(r[4]) then redis.call('SADD', 'idx:available', id) end
    redis.call('HINCRBY', 'prod:' .. r[1], 'total', r[3])
  end
  for _, k in ipairs(redis.call('KEYS', 'prod:*')) do
    local id = string.sub(k, 6)
    local p = redis.call('HMGET', k, 'sku', 'min', 'total')
    redis.call('ZADD', 'idx:sku', 0, string.lower(p[1]) .. '|' .. id)
    redis.call('ZADD', 'idx:lowstock', tonumber(p[3] or 0) - tonumber(p[2]), id)
  end
  return result(#redis.call('KEYS', 'idx:*'), t0)
end)

-- ---------------------------------------------------------------------------
-- CÓ CHỈ MỤC: truy vấn phải viết lại để gọi đúng khóa chỉ mục
-- ---------------------------------------------------------------------------
redis.register_function('idx_zone', function(_, args)
  local t0 = now_us()
  local ids = redis.call('SMEMBERS', 'idx:zone:' .. args[1])
  for _, id in ipairs(ids) do redis.call('HGETALL', 'inv:' .. id) end
  return result(#ids, t0)
end)

-- Redis không có chỉ mục cho "chứa chuỗi": chỉ duyệt được từ điển SKU (5.000) thay vì 100.000 dòng
redis.register_function('idx_sku', function(_, args)
  local t0, n = now_us(), 0
  for _, m in ipairs(redis.call('ZRANGE', 'idx:sku', 0, -1)) do
    local sku, pid = string.match(m, '^(.*)|(%d+)$')
    if string.find(sku, args[1], 1, true) then
      for _, id in ipairs(redis.call('SMEMBERS', 'idx:product:' .. pid)) do
        redis.call('HGETALL', 'inv:' .. id); n = n + 1
      end
    end
  end
  return result(n, t0)
end)

-- Tiền tố thì Redis làm được giống B+-tree: ZRANGEBYLEX trên sorted set
redis.register_function('idx_sku_prefix', function(_, args)
  local t0, n = now_us(), 0
  for _, m in ipairs(redis.call('ZRANGEBYLEX', 'idx:sku', '[' .. args[1], '[' .. args[1] .. '\255')) do
    for _, id in ipairs(redis.call('SMEMBERS', 'idx:product:' .. string.match(m, '|(%d+)$'))) do
      redis.call('HGETALL', 'inv:' .. id); n = n + 1
    end
  end
  return result(n, t0)
end)

redis.register_function('idx_lowstock', function()
  local t0 = now_us()
  local ids = redis.call('ZRANGEBYSCORE', 'idx:lowstock', '-inf', '(0')
  for _, id in ipairs(ids) do redis.call('HGETALL', 'prod:' .. id) end
  return result(#ids, t0)
end)

-- ---------------------------------------------------------------------------
-- CÁI GIÁ: thay đổi tồn kho => ứng dụng phải tự sửa dữ liệu + mọi chỉ mục liên quan
-- FCALL update_stock 0 <inv_id> <qty mới>
-- ---------------------------------------------------------------------------
redis.register_function('update_stock', function(_, args)
  local k = 'inv:' .. args[1]
  local r = redis.call('HMGET', k, 'product_id', 'qty', 'reserved')
  if not r[1] then return redis.error_reply('không có ' .. k) end
  local qty = tonumber(args[2])
  local delta = qty - tonumber(r[2])
  redis.call('HSET', k, 'qty', qty)                                                    -- 1. dữ liệu
  if qty > tonumber(r[3]) then redis.call('SADD', 'idx:available', args[1])
  else redis.call('SREM', 'idx:available', args[1]) end                                -- 2. idx:available
  redis.call('HINCRBY', 'prod:' .. r[1], 'total', delta)                               -- 3. tổng tính sẵn
  local score = redis.call('ZINCRBY', 'idx:lowstock', delta, r[1])                     -- 4. idx:lowstock
  return { 'product ' .. r[1], 'qty ' .. r[2] .. ' -> ' .. qty,
           'total - min = ' .. score .. (tonumber(score) < 0 and ' (vẫn tồn thấp)' or ' (đủ hàng)') }
end)
