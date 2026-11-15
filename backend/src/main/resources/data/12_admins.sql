-- Mật khẩu mặc định cho tất cả tài khoản bên dưới là: admin123 (đã băm SHA-256)
INSERT INTO admins (username, password_hash, full_name, email, phone, role, is_active, created_at, updated_at) VALUES
('admin', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', 'Nguyễn Quản Trị', 'admin@stockroom.vn', '0901234567', 'SUPER_ADMIN', true, NOW(), NOW()),
('manager', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', 'Trần Quản Lý Kho', 'manager@stockroom.vn', '0902345678', 'WAREHOUSE_MANAGER', true, NOW(), NOW()),
('staff01', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', 'Lê Nhân Viên Kiểm Kho', 'staff01@stockroom.vn', '0903456789', 'STAFF', true, NOW(), NOW())
ON CONFLICT (username) DO NOTHING;
