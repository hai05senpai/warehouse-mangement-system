#!lua name=qry_demo
-- =============================================================================
-- XỬ LÝ TRUY VẤN TRÊN REDIS: không có SQL, không có bộ tối ưu. Mỗi báo cáo là một đoạn code
-- mà lập trình viên TỰ chọn thuật toán (tự làm "kế hoạch thực thi").
-- 02_load_redis.sh nạp file này bằng FUNCTION LOAD. Gọi: FCALL <tên hàm> 0 [tham số...]
-- Mỗi hàm trả về {số dòng, thời gian chạy phía server, ...}.
--
-- Dữ liệu (database 13), chép từ schema qry_demo của PostgreSQL, mỗi dòng một HASH:
--   prod:{id} {sku}                  inv:{id} {product_id, qty}
--   ro:{id}   {status, ts}           ri:{id}  {order_id, product_id, qty}       phiếu nhập
--   io:{id}   {status, ts}           ii:{id}  {order_id, product_id, qty}       phiếu xuất
--   st:{id}   {status, ts}           si:{id}  {take_id, product_id, diff}       kiểm kê (diff = thực đếm - sổ sách)
--   ts = epoch giây (UTC). Mốc dùng trong demo: 27/08/2026 = 1787788800, 01/10/2026 = 1790812800,
--   01/11/2026 = 1793491200, hết ngày 25/11/2026 ("hôm nay" của dữ liệu) = 1795651200.
-- Bảng gộp tính sẵn (STEP 4 trở đi):
--   agg:onhand        HASH  product_id -> tổng tồn
--   agg:last_issue    ZSET  product_id, score = thời điểm phiếu xuất COMPLETED gần nhất
--   agg:day:{R|I|A}:{ngày} HASH product_id -> tổng nhập / xuất / điều chỉnh trong ngày (ngày = ts / 86400)
-- =============================================================================

local TODAY_END = 1795651200  -- hết ngày 25/11/2026
local DAY = 86400

local function now_us() return os.clock() * 1000000 end
local function ms(t0) return string.format('%.3f ms', (now_us() - t0) / 1000) end

-- Đọc toàn bộ phiếu (ro / io / st) có status COMPLETED vào bảng băm id -> ts  (bước "build" của hash join)
local function completed_orders(prefix)
  local orders = {}
  for _, k in ipairs(redis.call('KEYS', prefix .. ':*')) do
    local r = redis.call('HMGET', k, 'status', 'ts')
    if r[1] == 'COMPLETED' then orders[string.sub(k, #prefix + 2)] = tonumber(r[2]) end
  end
  return orders
end

local function on_hand()
  local total = {}
  for _, k in ipairs(redis.call('KEYS', 'inv:*')) do
    local r = redis.call('HMGET', k, 'product_id', 'qty')
    total[r[1]] = (total[r[1]] or 0) + tonumber(r[2])
  end
  return total
end

local function inout_row(id, closing, since, period)
  local opening = (closing[id] or 0) - (since[id] or 0)
  local p = period[id] or { R = 0, I = 0, A = 0 }
  return string.format('%s: dau ky %d | nhap %d | xuat %d | dieu chinh %d | cuoi ky %d',
    redis.call('HGET', 'prod:' .. id, 'sku'), opening, p.R, p.I, p.A, opening + p.R - p.I + p.A)
end

-- ---------------------------------------------------------------------------
-- UC-08 hàng chậm luân chuyển, KHÔNG có bảng gộp: tự viết phép nối
-- ---------------------------------------------------------------------------
-- Kế hoạch "hash anti join" viết tay: băm phiếu xuất gần đây, quét dòng xuất một lần,
-- đánh dấu mặt hàng đã xuất, rồi lấy mặt hàng còn tồn mà không bị đánh dấu.
-- FCALL q_stagnant_scan 0 <mốc thời gian>
redis.register_function('q_stagnant_scan', function(_, args)
  local t0, cutoff = now_us(), tonumber(args[1])
  local recent = {}
  for id, ts in pairs(completed_orders('io')) do
    if ts >= cutoff then recent[id] = true end
  end
  local issued = {}
  for _, k in ipairs(redis.call('KEYS', 'ii:*')) do
    local r = redis.call('HMGET', k, 'order_id', 'product_id')
    if recent[r[1]] then issued[r[2]] = true end
  end
  local n = 0
  for pid, qty in pairs(on_hand()) do
    if qty > 0 and not issued[pid] then n = n + 1 end
  end
  return { n, ms(t0) }
end)

-- Cùng câu hỏi, nhưng chọn "nested loop" không có chỉ mục: với MỖI mặt hàng quét lại toàn bộ dòng xuất.
-- Chạy trên <số mặt hàng> mặt hàng đầu rồi ước tính cho cả 5.000. Không có bộ tối ưu nào ngăn cách viết này.
-- FCALL q_stagnant_nested 0 <mốc thời gian> <số mặt hàng>
redis.register_function('q_stagnant_nested', function(_, args)
  local t0, cutoff, limit = now_us(), tonumber(args[1]), tonumber(args[2])
  local lines = redis.call('KEYS', 'ii:*')
  local n = 0
  for pid = 1, limit do
    local issued = false
    for _, k in ipairs(lines) do
      local r = redis.call('HMGET', k, 'product_id', 'order_id')
      if tonumber(r[1]) == pid then
        local o = redis.call('HMGET', 'io:' .. r[2], 'status', 'ts')
        if o[1] == 'COMPLETED' and tonumber(o[2]) >= cutoff then issued = true; break end
      end
    end
    if not issued then n = n + 1 end
  end
  local elapsed = (now_us() - t0) / 1000
  return { n, string.format('%.3f ms', elapsed),
           string.format('uoc tinh cho 5000 mat hang: %.0f ms', elapsed * 5000 / limit) }
end)

-- ---------------------------------------------------------------------------
-- UC-09 nhập - xuất - tồn, KHÔNG có bảng gộp: hash join + hash aggregate viết tay
-- FCALL q_inout_scan 0 <đầu kỳ> <cuối kỳ>    (cuối kỳ không tính)
-- Trả thêm một dòng mẫu (AC-00005) để đối chiếu với PostgreSQL.
-- ---------------------------------------------------------------------------
redis.register_function('q_inout_scan', function(_, args)
  local t0, start, stop = now_us(), tonumber(args[1]), tonumber(args[2])
  local since, period = {}, {}
  local function scan(order_prefix, line_prefix, order_field, qty_field, kind, sign)
    local orders = completed_orders(order_prefix)
    for _, k in ipairs(redis.call('KEYS', line_prefix .. ':*')) do
      local r = redis.call('HMGET', k, order_field, 'product_id', qty_field)
      local ts = orders[r[1]]
      if ts and ts >= start then
        local q = tonumber(r[3])
        since[r[2]] = (since[r[2]] or 0) + sign * q
        if ts < stop then
          period[r[2]] = period[r[2]] or { R = 0, I = 0, A = 0 }
          period[r[2]][kind] = period[r[2]][kind] + q
        end
      end
    end
  end
  scan('ro', 'ri', 'order_id', 'qty', 'R', 1)
  scan('io', 'ii', 'order_id', 'qty', 'I', -1)
  scan('st', 'si', 'take_id', 'diff', 'A', 1)
  local closing = on_hand()
  local n = #redis.call('KEYS', 'prod:*')
  return { n, ms(t0), inout_row('5', closing, since, period) }
end)

-- ---------------------------------------------------------------------------
-- CÁCH CỦA REDIS: tính sẵn kết quả gộp khi GHI, để lúc ĐỌC chỉ tra khóa
-- ---------------------------------------------------------------------------
local function drop_agg()
  local n = 0
  for _, k in ipairs(redis.call('KEYS', 'agg:*')) do redis.call('DEL', k); n = n + 1 end
  return n
end

redis.register_function('q_drop_agg', function()
  local t0 = now_us()
  return { drop_agg(), ms(t0) }
end)

redis.register_function('q_build_agg', function()
  local t0 = now_us()
  drop_agg()
  for pid, qty in pairs(on_hand()) do redis.call('HSET', 'agg:onhand', pid, qty) end
  local function add(order_prefix, line_prefix, order_field, qty_field, kind)
    local orders = completed_orders(order_prefix)
    for _, k in ipairs(redis.call('KEYS', line_prefix .. ':*')) do
      local r = redis.call('HMGET', k, order_field, 'product_id', qty_field)
      local ts = orders[r[1]]
      if ts then
        redis.call('HINCRBY', 'agg:day:' .. kind .. ':' .. math.floor(ts / DAY), r[2], r[3])
        if kind == 'I' then
          local last = redis.call('ZSCORE', 'agg:last_issue', r[2])
          if not last or tonumber(last) < ts then redis.call('ZADD', 'agg:last_issue', ts, r[2]) end
        end
      end
    end
  end
  add('ro', 'ri', 'order_id', 'qty', 'R')
  add('io', 'ii', 'order_id', 'qty', 'I')
  add('st', 'si', 'take_id', 'diff', 'A')
  return { #redis.call('KEYS', 'agg:*'), ms(t0) }
end)

-- UC-08 từ bảng gộp: 5.000 lần tra ZSCORE thay vì quét 30.000 dòng xuất
-- FCALL q_stagnant_agg 0 <mốc thời gian>
redis.register_function('q_stagnant_agg', function(_, args)
  local t0, cutoff, n = now_us(), tonumber(args[1]), 0
  local onhand = redis.call('HGETALL', 'agg:onhand')
  for i = 1, #onhand, 2 do
    if tonumber(onhand[i + 1]) > 0 then
      local last = redis.call('ZSCORE', 'agg:last_issue', onhand[i])
      if not last or tonumber(last) < cutoff then n = n + 1 end
    end
  end
  return { n, ms(t0) }
end)

-- UC-09 từ bảng gộp: cộng các HASH theo ngày từ đầu kỳ đến hôm nay (~56 ngày x 3 loại)
-- FCALL q_inout_agg 0 <đầu kỳ> <cuối kỳ>
redis.register_function('q_inout_agg', function(_, args)
  local t0, start, stop = now_us(), tonumber(args[1]), tonumber(args[2])
  local since, period = {}, {}
  local sign = { R = 1, I = -1, A = 1 }
  for day = math.floor(start / DAY), math.floor((TODAY_END - 1) / DAY) do
    for kind, s in pairs(sign) do
      local h = redis.call('HGETALL', 'agg:day:' .. kind .. ':' .. day)
      for i = 1, #h, 2 do
        local pid, q = h[i], tonumber(h[i + 1])
        since[pid] = (since[pid] or 0) + s * q
        if day * DAY < stop then
          period[pid] = period[pid] or { R = 0, I = 0, A = 0 }
          period[pid][kind] = period[pid][kind] + q
        end
      end
    end
  end
  local closing = {}
  local onhand = redis.call('HGETALL', 'agg:onhand')
  for i = 1, #onhand, 2 do closing[onhand[i]] = tonumber(onhand[i + 1]) end
  return { #onhand / 2, ms(t0), inout_row('5', closing, since, period) }
end)

-- ---------------------------------------------------------------------------
-- CÁI GIÁ: mỗi phiếu xuất mới, ứng dụng phải tự sửa dữ liệu gốc VÀ mọi bảng gộp
-- FCALL q_issue 0 <inv_id> <số lượng>   (xuất hàng vào cuối ngày 25/11/2026)
-- ---------------------------------------------------------------------------
redis.register_function('q_issue', function(_, args)
  local k = 'inv:' .. args[1]
  local r = redis.call('HMGET', k, 'product_id', 'qty')
  if not r[1] then return redis.error_reply('khong co ' .. k) end
  local qty, ts = tonumber(args[2]), TODAY_END - 1
  if qty > tonumber(r[2]) then return redis.error_reply('khong du hang tai ' .. k) end
  local oid = redis.call('INCR', 'seq:io') + 100000
  local lid = redis.call('INCR', 'seq:ii') + 100000
  redis.call('HSET', 'io:' .. oid, 'status', 'COMPLETED', 'ts', ts)                          -- 1. phiếu xuất
  redis.call('HSET', 'ii:' .. lid, 'order_id', oid, 'product_id', r[1], 'qty', qty)         -- 2. dòng xuất
  redis.call('HINCRBY', k, 'qty', -qty)                                                    -- 3. tồn tại vị trí
  redis.call('HINCRBY', 'agg:onhand', r[1], -qty)                                          -- 4. tổng tồn
  redis.call('ZADD', 'agg:last_issue', ts, r[1])                                           -- 5. lần xuất gần nhất
  redis.call('HINCRBY', 'agg:day:I:' .. math.floor(ts / DAY), r[1], qty)                   -- 6. xuất theo ngày
  return { 'product ' .. r[1], 'io:' .. oid .. ' / ii:' .. lid, '6 khoa da sua' }
end)
