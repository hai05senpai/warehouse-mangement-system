#!lua name=txn_demo

-- =============================================================================
-- LUA FUNCTIONS CHO DEMO TRANSACTION TRÊN REDIS
-- Các hàm này chạy ATOMIC trên Redis server (tương đương 1 transaction).
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- receipt_stock: Nhập kho atomic — cộng tồn + ghi phiếu nhập trong 1 lệnh
-- FCALL receipt_stock 1 inventory:1:1 20 REC-DEMO-001
-- ─────────────────────────────────────────────────────────────────────────────
redis.register_function('receipt_stock', function(keys, args)
    local inv_key   = keys[1]        -- VD: inventory:1:1
    local add_qty   = tonumber(args[1])
    local receipt_code = args[2]

    -- Đọc tồn hiện tại
    local current = tonumber(redis.call('HGET', inv_key, 'quantity') or 0)
    local new_qty = current + add_qty

    -- Cập nhật tồn
    redis.call('HSET', inv_key, 'quantity', new_qty)

    -- Ghi phiếu nhập
    local receipt_key = 'receipt:' .. receipt_code
    redis.call('HSET', receipt_key,
        'code', receipt_code,
        'inv_key', inv_key,
        'quantity', add_qty,
        'status', 'COMPLETED',
        'old_stock', current,
        'new_stock', new_qty
    )

    return string.format(
        'Nhập kho OK: %s += %d (cũ: %d → mới: %d). Phiếu: %s',
        inv_key, add_qty, current, new_qty, receipt_code
    )
end)

-- ─────────────────────────────────────────────────────────────────────────────
-- issue_stock: Xuất kho atomic — kiểm tra tồn + trừ tồn + ghi phiếu xuất
-- FCALL issue_stock 1 inventory:3:3 30 ISS-DEMO-001
-- Trả lỗi nếu không đủ tồn (nhưng KHÔNG rollback các lệnh trước trong pipeline)
-- ─────────────────────────────────────────────────────────────────────────────
redis.register_function('issue_stock', function(keys, args)
    local inv_key   = keys[1]
    local issue_qty = tonumber(args[1])
    local issue_code = args[2]

    local current  = tonumber(redis.call('HGET', inv_key, 'quantity') or 0)
    local reserved = tonumber(redis.call('HGET', inv_key, 'reserved') or 0)
    local available = current - reserved

    if available < issue_qty then
        return redis.error_reply(string.format(
            'Không đủ tồn kho! Khả dụng: %d, Yêu cầu: %d', available, issue_qty
        ))
    end

    local new_qty = current - issue_qty
    redis.call('HSET', inv_key, 'quantity', new_qty)

    local issue_key = 'issue:' .. issue_code
    redis.call('HSET', issue_key,
        'code', issue_code,
        'inv_key', inv_key,
        'quantity', issue_qty,
        'status', 'COMPLETED',
        'old_stock', current,
        'new_stock', new_qty
    )

    return string.format(
        'Xuất kho OK: %s -= %d (cũ: %d → mới: %d). Phiếu: %s',
        inv_key, issue_qty, current, new_qty, issue_code
    )
end)

-- ─────────────────────────────────────────────────────────────────────────────
-- transfer_stock: Điều chuyển atomic — trừ nguồn + cộng đích trong 1 lệnh
-- FCALL transfer_stock 2 inventory:1:1 inventory:1:2 10
-- ─────────────────────────────────────────────────────────────────────────────
redis.register_function('transfer_stock', function(keys, args)
    local src_key = keys[1]
    local dst_key = keys[2]
    local qty     = tonumber(args[1])

    local src_current  = tonumber(redis.call('HGET', src_key, 'quantity') or 0)
    local src_reserved = tonumber(redis.call('HGET', src_key, 'reserved') or 0)

    if (src_current - src_reserved) < qty then
        return redis.error_reply(string.format(
            'Không đủ tồn nguồn! Khả dụng: %d, Yêu cầu: %d',
            src_current - src_reserved, qty
        ))
    end

    redis.call('HSET', src_key, 'quantity', src_current - qty)

    -- Nếu khóa đích chưa tồn tại, tạo mới
    local dst_current = tonumber(redis.call('HGET', dst_key, 'quantity') or 0)
    redis.call('HSET', dst_key, 'quantity', dst_current + qty)

    return string.format(
        'Điều chuyển OK: %s -= %d (%d→%d), %s += %d (%d→%d)',
        src_key, qty, src_current, src_current - qty,
        dst_key, qty, dst_current, dst_current + qty
    )
end)

-- ─────────────────────────────────────────────────────────────────────────────
-- multi_issue_no_check: Xuất kho KHÔNG kiểm tra tồn (demo lỗi logic)
-- Dùng để so sánh: nếu không dùng Lua mà dùng MULTI/EXEC, không thể kiểm tra
-- điều kiện giữa các lệnh.
-- FCALL multi_issue_no_check 1 inventory:1:1 999
-- ─────────────────────────────────────────────────────────────────────────────
redis.register_function('multi_issue_no_check', function(keys, args)
    local inv_key = keys[1]
    local qty     = tonumber(args[1])

    local current = tonumber(redis.call('HGET', inv_key, 'quantity') or 0)
    local new_qty = current - qty

    -- KHÔNG kiểm tra — xuất bừa, tồn kho có thể âm
    redis.call('HSET', inv_key, 'quantity', new_qty)

    return string.format(
        'Xuất KHÔNG kiểm tra: %s -= %d (cũ: %d → mới: %d) %s',
        inv_key, qty, current, new_qty,
        new_qty < 0 and '⚠ TỒN KHO ÂM!' or ''
    )
end)
